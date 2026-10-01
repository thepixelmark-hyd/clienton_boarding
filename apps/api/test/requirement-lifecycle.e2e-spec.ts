import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

describe("Requirement lifecycle: conflicts, review, reopen, versioning (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(getPrisma(app));
  });

  async function setupLogoRequirement(cookie: string) {
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Conflict Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Logo Project" });
    const instantiate = await api(app)
      .post(`/api/v1/projects/${project.body.id}/requirements`)
      .set("Cookie", cookie)
      .send({ templateKey: "logo-design" });
    return {
      formId: instantiate.body.form.id as string,
      submissionId: instantiate.body.submission.id as string,
    };
  }

  function baseLogoAnswers(overrides: Record<string, unknown> = {}) {
    return {
      businessName: "Acme",
      companyOffering: "Widgets",
      primaryMessage: "Reliable widgets for everyone",
      uniqueSellingProposition: "Faster delivery",
      targetMarket: "Small businesses",
      logoUsage: ["website"],
      competitors: "Widgetco",
      shortTermGoals: "Grow 20%",
      longTermGoals: "Market leader",
      brandAdjectives: ["modern", "bold", "trustworthy", "friendly", "reliable"],
      ...overrides,
    };
  }

  async function fillAndGetFieldIds(cookie: string, formId: string, submissionId: string) {
    const submission = await api(app)
      .get(`/api/v1/forms/${formId}/submissions/${submissionId}`)
      .set("Cookie", cookie);
    const fieldIdByKey = new Map<string, string>(
      submission.body.form.fields.map((f: { id: string; key: string }) => [f.key, f.id]),
    );
    return fieldIdByKey;
  }

  async function saveAnswers(cookie: string, formId: string, submissionId: string, answers: Record<string, unknown>) {
    const fieldIdByKey = await fillAndGetFieldIds(cookie, formId, submissionId);
    const responses = Object.entries(answers)
      .filter(([key]) => fieldIdByKey.has(key))
      .map(([key, value]) => ({ fieldId: fieldIdByKey.get(key), value }));
    return api(app)
      .put(`/api/v1/forms/${formId}/submissions/${submissionId}/responses`)
      .set("Cookie", cookie)
      .send({ responses });
  }

  it("auto-detects a conflict when preferred and avoided colors overlap", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@conflict-test.example" });
    const { formId, submissionId } = await setupLogoRequirement(cookie);

    const save = await saveAnswers(
      cookie,
      formId,
      submissionId,
      baseLogoAnswers({ preferredColors: ["navy", "gold"], colorsToAvoid: ["gold"] }),
    );
    expect(save.status).toBe(200);

    const submit = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/submit`)
      .set("Cookie", cookie);
    expect(submit.status).toBe(201);
    expect(submit.body.readiness).toBe("CONFLICTING");
    expect(submit.body.conflicts).toHaveLength(1);
    expect(submit.body.conflicts[0]).toMatchObject({ fieldAKey: "preferredColors", fieldBKey: "colorsToAvoid" });
    expect(submit.body.version).toBe(1);
    // Auto-generated from the first few answered text fields.
    expect(submit.body.summary).toContain("Acme");
  });

  it("does not flag a conflict when colors don't overlap, and readiness is READY", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@no-conflict-test.example" });
    const { formId, submissionId } = await setupLogoRequirement(cookie);

    await saveAnswers(
      cookie,
      formId,
      submissionId,
      baseLogoAnswers({ preferredColors: ["navy"], colorsToAvoid: ["red"] }),
    );
    const submit = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/submit`)
      .set("Cookie", cookie);
    expect(submit.body.readiness).toBe("READY");
    expect(submit.body.conflicts).toHaveLength(0);
  });

  it("rejects a malformed answer (bad email / wrong multi-select option) before saving", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-test.example" });
    const { formId, submissionId } = await setupLogoRequirement(cookie);
    const fieldIdByKey = await fillAndGetFieldIds(cookie, formId, submissionId);

    const badSelect = await api(app)
      .put(`/api/v1/forms/${formId}/submissions/${submissionId}/responses`)
      .set("Cookie", cookie)
      .send({ responses: [{ fieldId: fieldIdByKey.get("logoUsage"), value: ["not-a-real-option"] }] });
    expect(badSelect.status).toBe(400);
    expect(badSelect.body.code).toBe("VALIDATION_ERROR");
  });

  it("enforces MULTI_SELECT minSelections on brandAdjectives", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@min-select-test.example" });
    const { formId, submissionId } = await setupLogoRequirement(cookie);
    const fieldIdByKey = await fillAndGetFieldIds(cookie, formId, submissionId);

    const tooFew = await api(app)
      .put(`/api/v1/forms/${formId}/submissions/${submissionId}/responses`)
      .set("Cookie", cookie)
      .send({ responses: [{ fieldId: fieldIdByKey.get("brandAdjectives"), value: ["modern"] }] });
    expect(tooFew.status).toBe(400);
  });

  it("full review cycle: submit -> request clarification -> reopen -> edit -> resubmit -> mark ready, with version history", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@review-cycle-test.example" });
    const { formId, submissionId } = await setupLogoRequirement(cookie);

    await saveAnswers(cookie, formId, submissionId, baseLogoAnswers());
    const submit = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/submit`)
      .set("Cookie", cookie);
    expect(submit.body.readiness).toBe("READY");
    const requirementId = submit.body.id as string;

    // A reviewer notices something the auto-rules couldn't catch and sends
    // it back with a manually-flagged conflict.
    const review = await api(app)
      .post(`/api/v1/requirements/${requirementId}/review`)
      .set("Cookie", cookie)
      .send({
        decision: "NEEDS_CLARIFICATION",
        note: "Short-term and long-term goals seem to conflict.",
        addConflicts: [{ fieldAKey: "shortTermGoals", fieldBKey: "longTermGoals", note: "Seem contradictory." }],
      });
    expect(review.status).toBe(201);
    expect(review.body.readiness).toBe("NEEDS_CLARIFICATION");
    expect(review.body.conflicts).toHaveLength(1);
    expect(review.body.version).toBe(2);

    // Can't resubmit without reopening first.
    const blockedResubmit = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/submit`)
      .set("Cookie", cookie);
    expect(blockedResubmit.status).toBe(400);

    const reopen = await api(app).post(`/api/v1/requirements/${requirementId}/reopen`).set("Cookie", cookie);
    expect(reopen.status).toBe(201);
    expect(reopen.body.status).toBe("DRAFT");

    await saveAnswers(cookie, formId, submissionId, { shortTermGoals: "Grow sustainably, aligned with long-term plan" });
    const resubmit = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/submit`)
      .set("Cookie", cookie);
    expect(resubmit.status).toBe(201);
    expect(resubmit.body.version).toBe(3);
    // A fresh resubmission clears the prior reviewer note/decision for re-review.
    expect(resubmit.body.reviewedAt).toBeNull();

    const markReady = await api(app)
      .post(`/api/v1/requirements/${requirementId}/review`)
      .set("Cookie", cookie)
      .send({ decision: "READY" });
    expect(markReady.body.readiness).toBe("READY");
    expect(markReady.body.version).toBe(4);

    const versions = await api(app).get(`/api/v1/requirements/${requirementId}/versions`).set("Cookie", cookie);
    expect(versions.body).toHaveLength(4);
    expect(versions.body.map((v: { version: number }) => v.version)).toEqual([4, 3, 2, 1]);
  });

  it("lets staff edit the requirement summary, bumping the version", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@summary-test.example" });
    const { formId, submissionId } = await setupLogoRequirement(cookie);
    await saveAnswers(cookie, formId, submissionId, baseLogoAnswers());
    const submit = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/submit`)
      .set("Cookie", cookie);

    const edited = await api(app)
      .patch(`/api/v1/requirements/${submit.body.id}/summary`)
      .set("Cookie", cookie)
      .send({ summary: "Hand-written summary for the design team." });
    expect(edited.status).toBe(200);
    expect(edited.body.summary).toBe("Hand-written summary for the design team.");
    expect(edited.body.version).toBe(submit.body.version + 1);
  });

  it("rejects reopening a requirement that isn't marked needs-clarification", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@reopen-guard-test.example" });
    const { formId, submissionId } = await setupLogoRequirement(cookie);
    await saveAnswers(cookie, formId, submissionId, baseLogoAnswers());
    const submit = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/submit`)
      .set("Cookie", cookie);
    expect(submit.body.readiness).toBe("READY");

    const reopen = await api(app).post(`/api/v1/requirements/${submit.body.id}/reopen`).set("Cookie", cookie);
    expect(reopen.status).toBe(400);
  });
});
