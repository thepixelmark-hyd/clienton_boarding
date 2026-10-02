import { Injectable } from "@nestjs/common";
import {
  computeReadiness,
  detectConflicts,
  generateRequirementSummary,
  getFormTemplate,
  isFieldVisible,
  validateFieldValue,
  FORM_TEMPLATES,
  type ConflictRule,
  type CreateFormFieldInput,
  type CreateFormInput,
  type ManualConflict,
  type ReviewRequirementInput,
  type UpdateFormFieldInput,
} from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { Errors } from "../common/errors";

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  listTemplates() {
    return FORM_TEMPLATES.map((t) => ({
      templateKey: t.templateKey,
      name: t.name,
      description: t.description,
      fieldCount: t.fields.length,
    }));
  }

  /** Instantiates a built-in template onto a project: a Form (with copied
   * fields) plus a DRAFT FormSubmission ready to be filled in. */
  async instantiateOnProject(
    organizationId: string,
    actorUserId: string,
    projectId: string,
    templateKey: string,
  ) {
    const template = getFormTemplate(templateKey);
    if (!template) throw Errors.validation(`Unknown form template: ${templateKey}`);

    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      select: { id: true, clientId: true },
    });
    if (!project) throw Errors.notFound("Project");

    const result = await this.prisma.client.$transaction(async (tx) => {
      const form = await tx.form.create({
        data: {
          organizationId,
          projectId,
          clientId: project.clientId,
          templateKey: template.templateKey,
          name: template.name,
          description: template.description,
          conflictRules: (template.conflictRules ?? null) as never,
        },
      });
      await tx.formField.createMany({
        data: template.fields.map((f, index) => ({
          formId: form.id,
          key: f.key,
          label: f.label,
          helpText: f.helpText,
          type: f.type,
          required: f.required,
          order: index,
          options: f.options as never,
          minSelections: f.minSelections,
          maxSelections: f.maxSelections,
          conditionalRule: f.conditionalRule as never,
        })),
      });
      const submission = await tx.formSubmission.create({
        data: { formId: form.id, organizationId, clientId: project.clientId, status: "DRAFT" },
      });
      return { form, submission };
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Form",
      entityId: result.form.id,
      action: "CREATED",
      after: { templateKey, projectId },
    });

    return result;
  }

  async getSubmission(organizationId: string, formId: string, submissionId: string) {
    const submission = await this.prisma.client.formSubmission.findFirst({
      where: { id: submissionId, formId, organizationId },
      include: { responses: true, form: { include: { fields: { orderBy: { order: "asc" } } } } },
    });
    if (!submission) throw Errors.notFound("Form submission");
    return submission;
  }

  /** Upserts responses. Safe to call repeatedly — this is the autosave path
   * and never discards a client-entered answer (product.md §76). */
  async saveResponses(
    organizationId: string,
    formId: string,
    submissionId: string,
    responses: { fieldId: string; value?: unknown }[],
  ) {
    const submission = await this.prisma.client.formSubmission.findFirst({
      where: { id: submissionId, formId, organizationId },
    });
    if (!submission) throw Errors.notFound("Form submission");
    if (submission.status === "SUBMITTED") {
      throw Errors.validation("This submission has already been submitted and cannot be edited.");
    }

    const fields = await this.prisma.client.formField.findMany({
      where: { formId, id: { in: responses.map((r) => r.fieldId) } },
    });
    const fieldById = new Map(fields.map((f) => [f.id, f]));

    // Shape validation (is this a well-formed NUMBER/EMAIL/MULTI_SELECT/...
    // answer?) happens here, before anything is stored — separate from
    // readiness, which only asks whether a required field is empty.
    const fieldErrors: Record<string, string> = {};
    for (const r of responses) {
      const field = fieldById.get(r.fieldId);
      if (!field) continue;
      const error = validateFieldValue(
        { type: field.type, options: field.options as never, minSelections: field.minSelections, maxSelections: field.maxSelections },
        r.value,
      );
      if (error) fieldErrors[field.key] = error;
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw Errors.validation("Some answers need attention.", { fieldErrors });
    }

    await this.prisma.client.$transaction(
      responses
        .filter((r) => fieldById.has(r.fieldId))
        .map((r) =>
          this.prisma.client.formResponse.upsert({
            where: { submissionId_fieldId: { submissionId, fieldId: r.fieldId } },
            create: {
              submissionId,
              fieldId: r.fieldId,
              valueText: typeof r.value === "string" ? r.value : undefined,
              valueJson: typeof r.value === "string" ? undefined : (r.value as never),
            },
            update: {
              valueText: typeof r.value === "string" ? r.value : null,
              valueJson: typeof r.value === "string" ? undefined : (r.value as never),
            },
          }),
        ),
    );

    return this.getSubmission(organizationId, formId, submissionId);
  }

  /**
   * Submits (or re-submits, after a reviewer reopened it — see
   * reopenSubmission) a DRAFT submission. Conflicts come from two sources
   * merged together: automatic (the Form's `conflictRules`, copied from its
   * template at instantiation — see packages/shared/src/forms/conflict.ts)
   * and any a reviewer already flagged manually on a prior version, which
   * carry forward unless this resubmission's answers no longer trigger them
   * (a resubmit is the client's attempt to resolve exactly this).
   */
  async submit(
    organizationId: string,
    actorUserId: string | undefined,
    formId: string,
    submissionId: string,
    submittedByContactId?: string,
  ) {
    const submission = await this.getSubmission(organizationId, formId, submissionId);
    if (submission.status === "SUBMITTED") {
      throw Errors.validation("This submission has already been submitted.");
    }

    const existingRequirement = await this.prisma.client.requirement.findUnique({ where: { submissionId } });
    if (existingRequirement && existingRequirement.readiness !== "NEEDS_CLARIFICATION") {
      // Reaching SUBMITTED again on a submission whose Requirement wasn't
      // reopened via reviewRequirement/reopenSubmission would mean the
      // submission's own status got out of sync with its Requirement — this
      // should be unreachable through the normal API surface, but fail loud
      // rather than silently overwrite a requirement a reviewer already
      // marked READY/CONFLICTING without going through reopen.
      throw Errors.validation("This requirement must be reopened by a reviewer before it can be resubmitted.");
    }

    const answers = this.answersMap(submission);
    const readinessInput = submission.form.fields.map((f) => ({
      key: f.key,
      label: f.label,
      required: f.required,
      conditionalRule: f.conditionalRule,
    }));
    const autoConflicts = detectConflicts(submission.form.conflictRules as ConflictRule[] | null, answers);
    const readinessResult = computeReadiness(readinessInput, answers, autoConflicts);
    const summary = generateRequirementSummary(submission.form.fields, answers);
    const changeNote = existingRequirement ? "Resubmitted after clarification" : "Submitted";

    const requirementId = await this.prisma.client.$transaction(async (tx) => {
      await tx.formSubmission.update({
        where: { id: submissionId },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          ...(submittedByContactId ? { submittedByContactId } : {}),
        },
      });

      const version = (existingRequirement?.version ?? 0) + 1;
      const requirement = existingRequirement
        ? await tx.requirement.update({
            where: { id: existingRequirement.id },
            data: {
              summary,
              readiness: readinessResult.readiness,
              missingFields: readinessResult.missingFields as never,
              conflicts: readinessResult.conflicts as never,
              reviewedById: null,
              reviewedAt: null,
              reviewNote: null,
              version,
            },
          })
        : await tx.requirement.create({
            data: {
              organizationId,
              projectId: submission.form.projectId,
              submissionId,
              title: submission.form.name,
              summary,
              readiness: readinessResult.readiness,
              missingFields: readinessResult.missingFields as never,
              conflicts: readinessResult.conflicts as never,
              version,
            },
          });

      await tx.requirementVersion.create({
        data: {
          requirementId: requirement.id,
          version,
          summary,
          readiness: readinessResult.readiness,
          missingFields: readinessResult.missingFields as never,
          conflicts: readinessResult.conflicts as never,
          changedById: actorUserId,
          changeNote,
        },
      });

      if (submission.form.clientId) {
        await tx.clientTimelineEvent.create({
          data: {
            organizationId,
            clientId: submission.form.clientId,
            type: existingRequirement ? "REQUIREMENT_RESUBMITTED" : "REQUIREMENT_SUBMITTED",
            title: `${existingRequirement ? "Requirements re-submitted" : "Requirements submitted"}: ${submission.form.name}`,
          },
        });
      }

      return requirement.id;
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Requirement",
      entityId: requirementId,
      action: existingRequirement ? "RESUBMITTED" : "SUBMITTED",
      after: { readiness: readinessResult.readiness },
    });

    if (submission.form.clientId) {
      await this.notifyRequirementSubmitted(organizationId, submission.form.clientId, submission.form.name, requirementId);
    }

    return this.getRequirement(organizationId, requirementId);
  }

  /** Notifies the people most likely to act on a client's submission —
   * owners, admins, and account managers — rather than every org member. */
  private async notifyRequirementSubmitted(
    organizationId: string,
    clientId: string,
    formName: string,
    requirementId: string,
  ) {
    const [client, recipients] = await Promise.all([
      this.prisma.client.client.findUnique({ where: { id: clientId }, select: { name: true } }),
      this.prisma.client.membership.findMany({
        where: { organizationId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "ACCOUNT_MANAGER"] } },
        include: { user: { select: { email: true } } },
      }),
    ]);
    if (!client) return;

    const requirementUrl = `${process.env.WEB_APP_URL ?? "http://localhost:9003"}/requirements/${requirementId}`;
    await Promise.all(
      recipients.map((m) =>
        this.email.sendRequirementSubmitted({
          to: m.user.email,
          organizationId,
          clientName: client.name,
          formName,
          requirementUrl,
        }),
      ),
    );
  }

  /** A reviewer's decision on a submitted requirement: send it back for
   * clarification (optionally flagging specific field-pair contradictions
   * they noticed that the automatic rules didn't catch) or mark it ready.
   * Always versioned — see RequirementVersion. */
  async reviewRequirement(
    organizationId: string,
    actorUserId: string,
    requirementId: string,
    input: ReviewRequirementInput,
  ) {
    const requirement = await this.prisma.client.requirement.findFirst({
      where: { id: requirementId, organizationId, deletedAt: null },
    });
    if (!requirement) throw Errors.notFound("Requirement");

    const existingConflicts = (requirement.conflicts as ManualConflict[] | null) ?? [];
    const conflicts = input.decision === "NEEDS_CLARIFICATION"
      ? [...existingConflicts, ...(input.addConflicts ?? [])]
      : existingConflicts;
    const version = requirement.version + 1;

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.requirement.update({
        where: { id: requirementId },
        data: {
          readiness: input.decision,
          reviewNote: input.note ?? null,
          reviewedById: actorUserId,
          reviewedAt: new Date(),
          conflicts: conflicts as never,
          version,
        },
      });
      await tx.requirementVersion.create({
        data: {
          requirementId,
          version,
          summary: result.summary,
          readiness: result.readiness,
          missingFields: result.missingFields as never,
          conflicts: conflicts as never,
          changedById: actorUserId,
          changeNote: input.note ?? `Reviewed: ${input.decision}`,
        },
      });
      return result;
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Requirement",
      entityId: requirementId,
      action: "REVIEWED",
      before: { readiness: requirement.readiness },
      after: { readiness: updated.readiness },
    });

    return this.getRequirement(organizationId, requirementId);
  }

  /** Unlocks a NEEDS_CLARIFICATION requirement's submission for editing
   * again. Only reachable from that one state — an already-READY or
   * already-CONFLICTING requirement needs a new review decision first,
   * not a silent reopen. */
  async reopenSubmission(organizationId: string, actorUserId: string, requirementId: string) {
    const requirement = await this.prisma.client.requirement.findFirst({
      where: { id: requirementId, organizationId, deletedAt: null },
      include: { submission: true },
    });
    if (!requirement) throw Errors.notFound("Requirement");
    if (requirement.readiness !== "NEEDS_CLARIFICATION") {
      throw Errors.validation("Only a requirement marked \"needs clarification\" can be reopened.");
    }

    await this.prisma.client.formSubmission.update({
      where: { id: requirement.submissionId },
      data: { status: "DRAFT", submittedAt: null },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Requirement",
      entityId: requirementId,
      action: "REOPENED",
    });

    return this.getSubmission(organizationId, requirement.submission.formId, requirement.submissionId);
  }

  /** Staff-edited summary — distinct from the auto-generated starting point
   * `submit()` writes (see packages/shared/src/forms/summary.ts). Versioned
   * like every other Requirement change. */
  async updateSummary(organizationId: string, actorUserId: string, requirementId: string, summary: string) {
    const requirement = await this.prisma.client.requirement.findFirst({
      where: { id: requirementId, organizationId, deletedAt: null },
    });
    if (!requirement) throw Errors.notFound("Requirement");

    const version = requirement.version + 1;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.requirement.update({ where: { id: requirementId }, data: { summary, version } });
      await tx.requirementVersion.create({
        data: {
          requirementId,
          version,
          summary,
          readiness: requirement.readiness,
          missingFields: requirement.missingFields as never,
          conflicts: requirement.conflicts as never,
          changedById: actorUserId,
          changeNote: "Summary edited",
        },
      });
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Requirement",
      entityId: requirementId,
      action: "SUMMARY_UPDATED",
    });

    return this.getRequirement(organizationId, requirementId);
  }

  async listVersions(organizationId: string, requirementId: string) {
    const requirement = await this.prisma.client.requirement.findFirst({
      where: { id: requirementId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!requirement) throw Errors.notFound("Requirement");

    return this.prisma.client.requirementVersion.findMany({
      where: { requirementId },
      orderBy: { version: "desc" },
    });
  }

  async getRequirement(organizationId: string, id: string) {
    const requirement = await this.prisma.client.requirement.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        submission: {
          include: { responses: true, form: { include: { fields: { orderBy: { order: "asc" } } } } },
        },
      },
    });
    if (!requirement) throw Errors.notFound("Requirement");
    return requirement;
  }

  async listForProject(organizationId: string, projectId: string) {
    return this.prisma.client.requirement.findMany({
      where: { organizationId, projectId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { submission: { include: { form: { select: { name: true, templateKey: true } } } } },
    });
  }

  /** Re-derives visible-field readiness for display without re-submitting —
   * used by the requirement detail screen. */
  visibleFieldsWithAnswers(submission: Awaited<ReturnType<FormsService["getSubmission"]>>) {
    const answers = this.answersMap(submission);
    return submission.form.fields
      .filter((f) => isFieldVisible(f.conditionalRule, answers))
      .map((f) => ({ ...f, value: answers[f.key] }));
  }

  private answersMap(submission: {
    responses: { fieldId: string; valueText: string | null; valueJson: unknown }[];
    form: { fields: { id: string; key: string }[] };
  }): Record<string, unknown> {
    const fieldKeyById = new Map(submission.form.fields.map((f) => [f.id, f.key]));
    const answers: Record<string, unknown> = {};
    for (const response of submission.responses) {
      const key = fieldKeyById.get(response.fieldId);
      if (!key) continue;
      answers[key] = response.valueJson ?? response.valueText;
    }
    return answers;
  }

  // -------------------------------------------------------------------
  // Form builder — staff-authored forms as real rows (Form.isTemplate),
  // the alternative entry point to the hardcoded FORM_TEMPLATES catalog.
  // -------------------------------------------------------------------

  async listForms(organizationId: string, isTemplate?: boolean) {
    return this.prisma.client.form.findMany({
      where: { organizationId, ...(isTemplate !== undefined ? { isTemplate } : {}) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { fields: true, submissions: true } } },
    });
  }

  async createForm(organizationId: string, actorUserId: string, input: CreateFormInput) {
    if (input.clientId) {
      const client = await this.prisma.client.client.findFirst({
        where: { id: input.clientId, organizationId, deletedAt: null },
      });
      if (!client) throw Errors.notFound("Client");
    }
    if (input.projectId) {
      const project = await this.prisma.client.project.findFirst({
        where: { id: input.projectId, organizationId, deletedAt: null },
      });
      if (!project) throw Errors.notFound("Project");
    }
    // Neither client nor project given -> a reusable org-level template.
    const isTemplate = !input.clientId && !input.projectId;

    const form = await this.prisma.client.form.create({
      data: {
        organizationId,
        clientId: input.clientId,
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        isTemplate,
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Form",
      entityId: form.id,
      action: "CREATED",
      after: { name: form.name, isTemplate },
    });

    return form;
  }

  /** Public: also used directly by FormsController's GET /forms/:formId
   * (the form-builder UI's "load current fields" call) in addition to every
   * builder mutation method below. */
  async getFormOrThrow(organizationId: string, formId: string) {
    const form = await this.prisma.client.form.findFirst({
      where: { id: formId, organizationId },
      include: { fields: { orderBy: { order: "asc" } }, _count: { select: { submissions: true } } },
    });
    if (!form) throw Errors.notFound("Form");
    return form;
  }

  /**
   * The client portal's extra scoping check: everything else here already
   * filters by `organizationId`, which is correct for staff (one org = one
   * tenant) but not strict enough for a portal user — two different clients
   * in the *same* organization must not be able to reach each other's forms
   * by guessing a formId, even though both would pass the organizationId
   * check. Every PortalController method calls this before delegating to
   * the methods above.
   */
  async assertFormBelongsToClient(organizationId: string, clientId: string, formId: string): Promise<void> {
    const form = await this.prisma.client.form.findFirst({ where: { id: formId, organizationId, clientId } });
    if (!form) throw Errors.notFound("Form");
  }

  /**
   * Lists *submissions* assigned to this client, not just Requirement rows —
   * a Requirement only exists after `submit()` runs, but the portal needs to
   * show a client their still-DRAFT, not-yet-filled-in forms too (that's the
   * whole point of assigning one), each with its Requirement data attached
   * once it exists.
   */
  async listForClientPortal(organizationId: string, clientId: string) {
    return this.prisma.client.formSubmission.findMany({
      where: { organizationId, form: { clientId } },
      orderBy: { createdAt: "desc" },
      include: {
        form: { select: { id: true, name: true, templateKey: true } },
        requirement: { select: { id: true, readiness: true, version: true, summary: true } },
      },
    });
  }

  /** A non-template form's fields lock once any submission exists against
   * it — editing the question list out from under an already-filled-in (or
   * in-progress) answer set would silently change what those answers mean.
   * A template has no submissions directly against it (instantiating it
   * creates a copy), so it stays editable indefinitely. */
  private assertFieldsEditable(form: { isTemplate: boolean; _count: { submissions: number } }) {
    if (!form.isTemplate && form._count.submissions > 0) {
      throw Errors.validation("This form already has a submission and its fields can no longer be changed.");
    }
  }

  async addField(organizationId: string, actorUserId: string, formId: string, input: CreateFormFieldInput) {
    const form = await this.getFormOrThrow(organizationId, formId);
    this.assertFieldsEditable(form);

    const existing = await this.prisma.client.formField.findUnique({
      where: { formId_key: { formId, key: input.key } },
    });
    if (existing) throw Errors.validation(`A field with key "${input.key}" already exists on this form.`);

    const field = await this.prisma.client.formField.create({
      data: {
        formId,
        key: input.key,
        label: input.label,
        helpText: input.helpText,
        type: input.type,
        required: input.required ?? false,
        order: form.fields.length,
        options: input.options as never,
        minSelections: input.minSelections,
        maxSelections: input.maxSelections,
        conditionalRule: input.conditionalRule as never,
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "FormField",
      entityId: field.id,
      action: "CREATED",
      after: { key: field.key, type: field.type },
    });

    return field;
  }

  async updateField(
    organizationId: string,
    actorUserId: string,
    formId: string,
    fieldId: string,
    input: UpdateFormFieldInput,
  ) {
    const form = await this.getFormOrThrow(organizationId, formId);
    this.assertFieldsEditable(form);

    const field = form.fields.find((f) => f.id === fieldId);
    if (!field) throw Errors.notFound("Form field");

    const updated = await this.prisma.client.formField.update({
      where: { id: fieldId },
      data: {
        label: input.label,
        helpText: input.helpText,
        type: input.type,
        required: input.required,
        options: input.options as never,
        minSelections: input.minSelections,
        maxSelections: input.maxSelections,
        conditionalRule: input.conditionalRule as never,
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "FormField",
      entityId: fieldId,
      action: "UPDATED",
      before: field,
      after: updated,
    });

    return updated;
  }

  async deleteField(organizationId: string, actorUserId: string, formId: string, fieldId: string) {
    const form = await this.getFormOrThrow(organizationId, formId);
    this.assertFieldsEditable(form);

    const field = form.fields.find((f) => f.id === fieldId);
    if (!field) throw Errors.notFound("Form field");

    await this.prisma.client.formField.delete({ where: { id: fieldId } });
    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "FormField",
      entityId: fieldId,
      action: "DELETED",
    });

    return { success: true };
  }

  async reorderFields(organizationId: string, actorUserId: string, formId: string, fieldIds: string[]) {
    const form = await this.getFormOrThrow(organizationId, formId);
    this.assertFieldsEditable(form);

    const existingIds = new Set(form.fields.map((f) => f.id));
    if (fieldIds.length !== form.fields.length || !fieldIds.every((id) => existingIds.has(id))) {
      throw Errors.validation("The field list must include every field on this form exactly once.");
    }

    await this.prisma.client.$transaction(
      fieldIds.map((id, index) => this.prisma.client.formField.update({ where: { id }, data: { order: index } })),
    );

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Form",
      entityId: formId,
      action: "FIELDS_REORDERED",
    });

    return this.prisma.client.formField.findMany({ where: { formId }, orderBy: { order: "asc" } });
  }

  /** Starts a fresh DRAFT submission against an existing Form (builder-
   * authored or template-instantiated) for a project — the generic
   * counterpart to instantiateOnProject, which only works for the hardcoded
   * catalog. Lets a reusable template or a previously-built custom form be
   * filled in again for a different project. */
  async createSubmission(organizationId: string, actorUserId: string, formId: string, projectId: string) {
    const form = await this.prisma.client.form.findFirst({ where: { id: formId, organizationId } });
    if (!form) throw Errors.notFound("Form");

    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      select: { id: true, clientId: true },
    });
    if (!project) throw Errors.notFound("Project");

    let targetFormId = form.id;
    if (form.isTemplate) {
      // Instantiating a DB-authored template works the same way as a
      // hardcoded one: copy its fields into a fresh, independent Form tied
      // to this project, so editing the template later never reaches back
      // into an already-instantiated copy.
      const fields = await this.prisma.client.formField.findMany({ where: { formId: form.id }, orderBy: { order: "asc" } });
      const copy = await this.prisma.client.$transaction(async (tx) => {
        const newForm = await tx.form.create({
          data: {
            organizationId,
            projectId,
            clientId: project.clientId,
            templateKey: form.templateKey,
            name: form.name,
            description: form.description,
            conflictRules: form.conflictRules as never,
          },
        });
        await tx.formField.createMany({
          data: fields.map((f) => ({
            formId: newForm.id,
            key: f.key,
            label: f.label,
            helpText: f.helpText,
            type: f.type,
            required: f.required,
            order: f.order,
            options: f.options as never,
            minSelections: f.minSelections,
            maxSelections: f.maxSelections,
            conditionalRule: f.conditionalRule as never,
          })),
        });
        return newForm;
      });
      targetFormId = copy.id;
    }

    const submission = await this.prisma.client.formSubmission.create({
      data: { formId: targetFormId, organizationId, clientId: project.clientId, status: "DRAFT" },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "FormSubmission",
      entityId: submission.id,
      action: "CREATED",
      after: { formId: targetFormId, projectId },
    });

    return { form: await this.getFormOrThrow(organizationId, targetFormId), submission };
  }
}
