import type { INestApplication } from "@nestjs/common";
import type { Response } from "supertest";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

function portalCookie(res: Response): string {
  const raw = res.headers["set-cookie"];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = cookies.find((c: string) => c.startsWith("clientos_portal_session="));
  if (!found) throw new Error("No portal session cookie set in response");
  return found.split(";")[0];
}

describe("Client portal: project dashboard, visibility filtering, tenant isolation (e2e)", () => {
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

  async function setupClientWithPortalUser(cookie: string, emailPrefix: string) {
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: `${emailPrefix} Co` });
    await api(app)
      .post(`/api/v1/clients/${client.body.id}/invitations`)
      .set("Cookie", cookie)
      .send({ email: `${emailPrefix}@portal-project-test.example`, role: "CLIENT_MANAGER" });
    const emailLog = await getPrisma(app).client.emailLog.findFirstOrThrow({
      where: { to: `${emailPrefix}@portal-project-test.example`, template: "client-portal-invitation" },
    });
    const token = new URL((emailLog.metadata as { inviteUrl: string }).inviteUrl).searchParams.get("token")!;
    const accept = await api(app).post(`/api/v1/portal/auth/invitations/${token}/accept`).send({ password: "PortalPass123" });
    return { clientId: client.body.id as string, portalCookie: portalCookie(accept) };
  }

  it("the portal project detail shows milestones/deliverables fully, only CLIENT_VISIBLE tasks, and real progress numbers", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@portal-dashboard-test.example" });
    const { clientId, portalCookie: pCookie } = await setupClientWithPortalUser(cookie, "client-mgr");

    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId, name: "Visible Project" });
    const projectId = project.body.id as string;

    await api(app).post(`/api/v1/projects/${projectId}/milestones`).set("Cookie", cookie).send({ name: "Kickoff" });
    const deliverable = await api(app)
      .post(`/api/v1/projects/${projectId}/deliverables`)
      .set("Cookie", cookie)
      .send({ name: "Homepage" });
    await api(app)
      .patch(`/api/v1/deliverables/${deliverable.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "IN_REVIEW", version: 1 });

    const internalTask = await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Internal planning notes" });
    await api(app)
      .patch(`/api/v1/tasks/${internalTask.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "DONE", version: internalTask.body.version });
    await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Share homepage draft", visibility: "CLIENT_VISIBLE" });

    const list = await api(app).get("/api/v1/portal/projects").set("Cookie", pCookie);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(projectId);

    const detail = await api(app).get(`/api/v1/portal/projects/${projectId}`).set("Cookie", pCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.milestones).toHaveLength(1);
    expect(detail.body.deliverables).toHaveLength(1);
    expect(detail.body.visibleTasks).toHaveLength(1);
    expect(detail.body.visibleTasks[0].title).toBe("Share homepage draft");
    expect(detail.body.visibleTasks.some((t: { title: string }) => t.title === "Internal planning notes")).toBe(false);
    expect(detail.body.progress.totalTasks).toBe(2);
    expect(detail.body.progress.doneTasks).toBe(1);
    expect(detail.body.waitingOnYou.deliverablesInReview).toHaveLength(1);
  });

  it("a portal user for Client A cannot read Client B's project in the same organization", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@portal-cross-client-test.example" });
    const { portalCookie: pCookieA } = await setupClientWithPortalUser(cookie, "client-a");
    const { clientId: clientBId } = await setupClientWithPortalUser(cookie, "client-b");

    const projectB = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: clientBId, name: "Client B Project" });

    const res = await api(app).get(`/api/v1/portal/projects/${projectB.body.id}`).set("Cookie", pCookieA);
    expect(res.status).toBe(404);

    const list = await api(app).get("/api/v1/portal/projects").set("Cookie", pCookieA);
    expect(list.body).toHaveLength(0);
  });

  it("a VIEWER portal role can read the project dashboard but cannot be used to mutate anything project-related", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@portal-viewer-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Viewer Co" });
    await api(app)
      .post(`/api/v1/clients/${client.body.id}/invitations`)
      .set("Cookie", cookie)
      .send({ email: "viewer@portal-project-test.example", role: "VIEWER" });
    const emailLog = await getPrisma(app).client.emailLog.findFirstOrThrow({
      where: { to: "viewer@portal-project-test.example", template: "client-portal-invitation" },
    });
    const token = new URL((emailLog.metadata as { inviteUrl: string }).inviteUrl).searchParams.get("token")!;
    const accept = await api(app).post(`/api/v1/portal/auth/invitations/${token}/accept`).send({ password: "PortalPass123" });
    const viewerCookie = portalCookie(accept);

    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Viewer Project" });

    const res = await api(app).get(`/api/v1/portal/projects/${project.body.id}`).set("Cookie", viewerCookie);
    expect(res.status).toBe(200);
  });
});
