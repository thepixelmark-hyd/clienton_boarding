import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

describe("Form builder and file uploads (e2e)", () => {
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

  // -------------------------------------------------------------------
  // Form builder
  // -------------------------------------------------------------------

  it("builds a custom org-level template with fields, then instantiates it onto a project", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@builder-test.example" });

    const form = await api(app)
      .post("/api/v1/forms")
      .set("Cookie", cookie)
      .send({ name: "Custom Brand Brief" });
    expect(form.status).toBe(201);
    expect(form.body.isTemplate).toBe(true);

    const fieldA = await api(app)
      .post(`/api/v1/forms/${form.body.id}/fields`)
      .set("Cookie", cookie)
      .send({ key: "companyName", label: "Company name", type: "SHORT_TEXT", required: true });
    expect(fieldA.status).toBe(201);

    const fieldB = await api(app)
      .post(`/api/v1/forms/${form.body.id}/fields`)
      .set("Cookie", cookie)
      .send({
        key: "tier",
        label: "Package tier",
        type: "SINGLE_SELECT",
        required: true,
        options: [
          { value: "basic", label: "Basic" },
          { value: "premium", label: "Premium" },
        ],
      });
    expect(fieldB.status).toBe(201);

    const duplicateKey = await api(app)
      .post(`/api/v1/forms/${form.body.id}/fields`)
      .set("Cookie", cookie)
      .send({ key: "companyName", label: "Dup", type: "SHORT_TEXT" });
    expect(duplicateKey.status).toBe(400);

    const reordered = await api(app)
      .patch(`/api/v1/forms/${form.body.id}/fields-order`)
      .set("Cookie", cookie)
      .send({ fieldIds: [fieldB.body.id, fieldA.body.id] });
    expect(reordered.status).toBe(200);
    expect(reordered.body[0].key).toBe("tier");

    const updated = await api(app)
      .patch(`/api/v1/forms/${form.body.id}/fields/${fieldA.body.id}`)
      .set("Cookie", cookie)
      .send({ label: "Full company name" });
    expect(updated.status).toBe(200);
    expect(updated.body.label).toBe("Full company name");

    const deleted = await api(app)
      .delete(`/api/v1/forms/${form.body.id}/fields/${fieldB.body.id}`)
      .set("Cookie", cookie);
    expect(deleted.status).toBe(200);

    // Instantiate the template onto a real project.
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Builder Client" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Builder Project" });
    const submission = await api(app)
      .post(`/api/v1/forms/${form.body.id}/submissions`)
      .set("Cookie", cookie)
      .send({ projectId: project.body.id });
    expect(submission.status).toBe(201);
    expect(submission.body.form.id).not.toBe(form.body.id); // a fresh copy, not the template itself
    expect(submission.body.form.fields).toHaveLength(1);

    // The original template is untouched by instantiation and still editable.
    const templateStillEditable = await api(app)
      .post(`/api/v1/forms/${form.body.id}/fields`)
      .set("Cookie", cookie)
      .send({ key: "newField", label: "New field", type: "SHORT_TEXT" });
    expect(templateStillEditable.status).toBe(201);
  });

  it("locks a non-template form's fields once a submission exists against it", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@lock-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Lock Client" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Lock Project" });

    const form = await api(app)
      .post("/api/v1/forms")
      .set("Cookie", cookie)
      .send({ name: "Project-scoped form", projectId: project.body.id, clientId: client.body.id });
    expect(form.body.isTemplate).toBe(false);

    await api(app)
      .post(`/api/v1/forms/${form.body.id}/fields`)
      .set("Cookie", cookie)
      .send({ key: "q1", label: "Question 1", type: "SHORT_TEXT" });

    await api(app)
      .post(`/api/v1/forms/${form.body.id}/submissions`)
      .set("Cookie", cookie)
      .send({ projectId: project.body.id });

    const blockedAdd = await api(app)
      .post(`/api/v1/forms/${form.body.id}/fields`)
      .set("Cookie", cookie)
      .send({ key: "q2", label: "Question 2", type: "SHORT_TEXT" });
    expect(blockedAdd.status).toBe(400);
  });

  // -------------------------------------------------------------------
  // File uploads
  // -------------------------------------------------------------------

  async function setupLogoSubmission(cookie: string) {
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Upload Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Upload Project" });
    const instantiate = await api(app)
      .post(`/api/v1/projects/${project.body.id}/requirements`)
      .set("Cookie", cookie)
      .send({ templateKey: "logo-design" });
    const formId = instantiate.body.form.id as string;
    const submissionId = instantiate.body.submission.id as string;
    const submission = await api(app)
      .get(`/api/v1/forms/${formId}/submissions/${submissionId}`)
      .set("Cookie", cookie);
    const referenceField = submission.body.form.fields.find((f: { key: string }) => f.key === "referenceImages");
    return { formId, submissionId, fieldId: referenceField.id as string };
  }

  it("accepts a valid PNG upload (by real magic bytes) and can download/delete it", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@upload-test.example" });
    const { formId, submissionId, fieldId } = await setupLogoSubmission(cookie);

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const upload = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/fields/${fieldId}/files`)
      .set("Cookie", cookie)
      .attach("file", pngBuffer, "inspiration.png");
    expect(upload.status).toBe(201);
    expect(upload.body.mimeType).toBe("image/png");

    const list = await api(app)
      .get(`/api/v1/forms/${formId}/submissions/${submissionId}/fields/${fieldId}/files`)
      .set("Cookie", cookie);
    expect(list.body).toHaveLength(1);

    const download = await api(app).get(`/api/v1/files/${upload.body.id}`).set("Cookie", cookie);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toBe("image/png");

    const del = await api(app).delete(`/api/v1/files/${upload.body.id}`).set("Cookie", cookie);
    expect(del.status).toBe(200);

    const afterDelete = await api(app).get(`/api/v1/files/${upload.body.id}`).set("Cookie", cookie);
    expect(afterDelete.status).toBe(404);
  });

  it("rejects a file whose content doesn't match its claimed type (magic-byte sniffing)", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@spoof-test.example" });
    const { formId, submissionId, fieldId } = await setupLogoSubmission(cookie);

    const fakePng = Buffer.from("<html>not an image at all</html>");
    const upload = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/fields/${fieldId}/files`)
      .set("Cookie", cookie)
      .attach("file", fakePng, "inspiration.png");
    expect(upload.status).toBe(400);
  });

  it("rejects uploading a file to a field that isn't an upload type", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@wrong-field-test.example" });
    const { formId, submissionId } = await setupLogoSubmission(cookie);
    const submission = await api(app)
      .get(`/api/v1/forms/${formId}/submissions/${submissionId}`)
      .set("Cookie", cookie);
    const textField = submission.body.form.fields.find((f: { key: string }) => f.key === "businessName");

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const upload = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/fields/${textField.id}/files`)
      .set("Cookie", cookie)
      .attach("file", pngBuffer, "x.png");
    expect(upload.status).toBe(400);
  });

  it("404s downloading a file that belongs to another organization", async () => {
    const orgA = await signupOrg(app, { email: "a@file-cross-test.example" });
    const orgB = await signupOrg(app, { email: "b@file-cross-test.example" });
    const { formId, submissionId, fieldId } = await setupLogoSubmission(orgA.cookie);

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const upload = await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/fields/${fieldId}/files`)
      .set("Cookie", orgA.cookie)
      .attach("file", pngBuffer, "x.png");

    const crossTenantDownload = await api(app).get(`/api/v1/files/${upload.body.id}`).set("Cookie", orgB.cookie);
    expect(crossTenantDownload.status).toBe(404);
  });
});
