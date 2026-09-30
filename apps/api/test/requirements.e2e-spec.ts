import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { signupOrg } from "./helpers";

describe("Requirements engine (e2e)", () => {
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

  async function setupProject(cookie: string) {
    const client = await request(app.getHttpServer())
      .post("/api/v1/clients")
      .set("Cookie", cookie)
      .send({ name: "Requirements Test Client" });
    const project = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Requirements Test Project" });
    return project.body.id as string;
  }

  it("instantiates the Logo Design template with all 19 fields", async () => {
    const { cookie } = await signupOrg(app, { email: "req1@requirements-test.example" });
    const projectId = await setupProject(cookie);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set("Cookie", cookie)
      .send({ templateKey: "logo-design" });
    expect(res.status).toBe(201);

    const submission = await request(app.getHttpServer())
      .get(`/api/v1/forms/${res.body.form.id}/submissions/${res.body.submission.id}`)
      .set("Cookie", cookie);
    expect(submission.body.form.fields).toHaveLength(19);
    expect(submission.body.form.fields.map((f: { key: string }) => f.key)).toContain("packagingType");
  });

  it("does not require packaging fields when packaging is not selected as logo usage", async () => {
    const { cookie } = await signupOrg(app, { email: "req2@requirements-test.example" });
    const projectId = await setupProject(cookie);

    const instantiate = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set("Cookie", cookie)
      .send({ templateKey: "logo-design" });
    const { form, submission } = instantiate.body;

    const fieldsRes = await request(app.getHttpServer())
      .get(`/api/v1/forms/${form.id}/submissions/${submission.id}`)
      .set("Cookie", cookie);
    const fieldByKey = (key: string) => fieldsRes.body.form.fields.find((f: { key: string }) => f.key === key);

    const requiredFields = [
      "businessName",
      "companyOffering",
      "primaryMessage",
      "uniqueSellingProposition",
      "targetMarket",
      "logoUsage",
      "competitors",
      "shortTermGoals",
      "longTermGoals",
      "brandAdjectives",
    ];
    const responses = requiredFields.map((key) => ({
      fieldId: fieldByKey(key).id,
      value: key === "logoUsage" ? ["website"] : key === "brandAdjectives" ? ["modern", "bold", "friendly", "professional", "warm"] : `Answer for ${key}`,
    }));

    await request(app.getHttpServer())
      .put(`/api/v1/forms/${form.id}/submissions/${submission.id}/responses`)
      .set("Cookie", cookie)
      .send({ responses });

    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/forms/${form.id}/submissions/${submission.id}/submit`)
      .set("Cookie", cookie);

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.readiness).toBe("READY");
  });

  it("requires packaging fields once packaging is selected as logo usage", async () => {
    const { cookie } = await signupOrg(app, { email: "req3@requirements-test.example" });
    const projectId = await setupProject(cookie);

    const instantiate = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set("Cookie", cookie)
      .send({ templateKey: "logo-design" });
    const { form, submission } = instantiate.body;

    const fieldsRes = await request(app.getHttpServer())
      .get(`/api/v1/forms/${form.id}/submissions/${submission.id}`)
      .set("Cookie", cookie);
    const logoUsageField = fieldsRes.body.form.fields.find((f: { key: string }) => f.key === "logoUsage");

    await request(app.getHttpServer())
      .put(`/api/v1/forms/${form.id}/submissions/${submission.id}/responses`)
      .set("Cookie", cookie)
      .send({ responses: [{ fieldId: logoUsageField.id, value: ["packaging"] }] });

    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/forms/${form.id}/submissions/${submission.id}/submit`)
      .set("Cookie", cookie);

    expect(submitRes.body.readiness).toBe("MISSING");
    const missingKeys = submitRes.body.missingFields.map((f: { key: string }) => f.key);
    expect(missingKeys).toContain("packagingType");
    expect(missingKeys).toContain("packagingDimensions");
  });

  it("preserves original FormResponse rows even after the Requirement is created", async () => {
    const { cookie } = await signupOrg(app, { email: "req4@requirements-test.example" });
    const projectId = await setupProject(cookie);

    const instantiate = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set("Cookie", cookie)
      .send({ templateKey: "logo-design" });
    const { form, submission } = instantiate.body;

    const fieldsRes = await request(app.getHttpServer())
      .get(`/api/v1/forms/${form.id}/submissions/${submission.id}`)
      .set("Cookie", cookie);
    const businessNameField = fieldsRes.body.form.fields.find((f: { key: string }) => f.key === "businessName");

    await request(app.getHttpServer())
      .put(`/api/v1/forms/${form.id}/submissions/${submission.id}/responses`)
      .set("Cookie", cookie)
      .send({ responses: [{ fieldId: businessNameField.id, value: "Original Client Answer" }] });

    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/forms/${form.id}/submissions/${submission.id}/submit`)
      .set("Cookie", cookie);

    const requirementRes = await request(app.getHttpServer())
      .get(`/api/v1/requirements/${submitRes.body.id}`)
      .set("Cookie", cookie);

    const savedResponse = requirementRes.body.submission.responses.find(
      (r: { fieldId: string }) => r.fieldId === businessNameField.id,
    );
    expect(savedResponse.valueText).toBe("Original Client Answer");
  });

  it("cannot edit a submission after it has been submitted", async () => {
    const { cookie } = await signupOrg(app, { email: "req5@requirements-test.example" });
    const projectId = await setupProject(cookie);

    const instantiate = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set("Cookie", cookie)
      .send({ templateKey: "website-discovery" });
    const { form, submission } = instantiate.body;

    await request(app.getHttpServer())
      .post(`/api/v1/forms/${form.id}/submissions/${submission.id}/submit`)
      .set("Cookie", cookie);

    const fieldsRes = await request(app.getHttpServer())
      .get(`/api/v1/forms/${form.id}/submissions/${submission.id}`)
      .set("Cookie", cookie);
    const anyField = fieldsRes.body.form.fields[0];

    const lateEdit = await request(app.getHttpServer())
      .put(`/api/v1/forms/${form.id}/submissions/${submission.id}/responses`)
      .set("Cookie", cookie)
      .send({ responses: [{ fieldId: anyField.id, value: "too late" }] });
    expect(lateEdit.status).toBe(400);
  });
});
