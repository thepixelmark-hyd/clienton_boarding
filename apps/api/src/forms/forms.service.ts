import { Injectable } from "@nestjs/common";
import { computeReadiness, getFormTemplate, isFieldVisible, FORM_TEMPLATES } from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { Errors } from "../common/errors";

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

    const fieldIds = await this.prisma.client.formField.findMany({
      where: { formId, id: { in: responses.map((r) => r.fieldId) } },
      select: { id: true },
    });
    const validIds = new Set(fieldIds.map((f) => f.id));

    await this.prisma.client.$transaction(
      responses
        .filter((r) => validIds.has(r.fieldId))
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

  async submit(organizationId: string, actorUserId: string, formId: string, submissionId: string) {
    const submission = await this.getSubmission(organizationId, formId, submissionId);
    if (submission.status === "SUBMITTED") {
      throw Errors.validation("This submission has already been submitted.");
    }

    const answers = this.answersMap(submission);
    const readinessInput = submission.form.fields.map((f) => ({
      key: f.key,
      label: f.label,
      required: f.required,
      conditionalRule: f.conditionalRule,
    }));
    const readinessResult = computeReadiness(readinessInput, answers);

    const result = await this.prisma.client.$transaction(async (tx) => {
      await tx.formSubmission.update({
        where: { id: submissionId },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
      const requirement = await tx.requirement.create({
        data: {
          organizationId,
          projectId: submission.form.projectId,
          submissionId,
          title: submission.form.name,
          readiness: readinessResult.readiness,
          missingFields: readinessResult.missingFields as never,
          conflicts: readinessResult.conflicts as never,
        },
      });
      if (submission.form.clientId) {
        await tx.clientTimelineEvent.create({
          data: {
            organizationId,
            clientId: submission.form.clientId,
            type: "REQUIREMENT_SUBMITTED",
            title: `Requirements submitted: ${submission.form.name}`,
          },
        });
      }
      return requirement;
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Requirement",
      entityId: result.id,
      action: "SUBMITTED",
      after: { readiness: result.readiness },
    });

    return this.getRequirement(organizationId, result.id);
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
}
