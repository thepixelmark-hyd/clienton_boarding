import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

describe("Project templates: authoring, validation, instantiation (e2e)", () => {
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

  function websiteBlueprint() {
    return {
      name: "Website Redesign",
      description: "Standard website engagement",
      phases: [
        { key: "discovery", name: "Discovery", order: 0, startOffsetDays: 0, endOffsetDays: 14 },
        { key: "build", name: "Build", order: 1, startOffsetDays: 15, endOffsetDays: 45 },
      ],
      milestones: [{ key: "kickoff", name: "Kickoff complete", phaseKey: "discovery", dueOffsetDays: 3 }],
      tasks: [
        {
          key: "brief",
          title: "Collect creative brief",
          phaseKey: "discovery",
          milestoneKey: "kickoff",
          priority: "HIGH",
          dueOffsetDays: 5,
        },
        {
          key: "wireframes",
          title: "Wireframes",
          phaseKey: "build",
          dependsOnKeys: ["brief"],
          dueOffsetDays: 20,
        },
        {
          key: "wireframes-review",
          title: "Internal review of wireframes",
          parentKey: "wireframes",
          dueOffsetDays: 22,
        },
      ],
    };
  }

  it("creates a template and rejects a blueprint with a dangling reference", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@templates-test.example" });

    const bad = await api(app)
      .post("/api/v1/project-templates")
      .set("Cookie", cookie)
      .send({ name: "Broken", phases: [], milestones: [], tasks: [{ key: "a", title: "A", milestoneKey: "ghost" }] });
    expect(bad.status).toBe(400);
    expect(bad.body.details.errors.some((e: string) => e.includes("unknown milestone key"))).toBe(true);

    const good = await api(app).post("/api/v1/project-templates").set("Cookie", cookie).send(websiteBlueprint());
    expect(good.status).toBe(201);
    expect(good.body.name).toBe("Website Redesign");
  });

  it("rejects a dependency cycle across tasks", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@templates-cycle-test.example" });
    const res = await api(app)
      .post("/api/v1/project-templates")
      .set("Cookie", cookie)
      .send({
        name: "Cyclic",
        phases: [],
        milestones: [],
        tasks: [
          { key: "a", title: "A", dependsOnKeys: ["b"] },
          { key: "b", title: "B", dependsOnKeys: ["a"] },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.details.errors.some((e: string) => e.includes("Circular dependency"))).toBe(true);
  });

  it("instantiating a template creates real Project/Phase/Milestone/Task rows with resolved relationships and offset dates", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@templates-instantiate-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Template Client" });
    const template = await api(app).post("/api/v1/project-templates").set("Cookie", cookie).send(websiteBlueprint());

    const startDate = new Date("2026-01-01T00:00:00.000Z").toISOString();
    const instantiated = await api(app)
      .post(`/api/v1/project-templates/${template.body.id}/instantiate`)
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Acme Website", startDate });
    expect(instantiated.status).toBe(201);
    expect(instantiated.body.sourceTemplateId).toBe(template.body.id);

    const project = await api(app).get(`/api/v1/projects/${instantiated.body.id}`).set("Cookie", cookie);
    expect(project.body.phases).toHaveLength(2);
    const discoveryPhase = project.body.phases.find((p: { name: string }) => p.name === "Discovery");
    expect(new Date(discoveryPhase.endDate).toISOString().slice(0, 10)).toBe("2026-01-15");
    expect(project.body.milestones).toHaveLength(1);
    expect(new Date(project.body.milestones[0].dueDate).toISOString().slice(0, 10)).toBe("2026-01-04");

    const tasks = await api(app).get(`/api/v1/projects/${instantiated.body.id}/tasks`).set("Cookie", cookie);
    expect(tasks.body).toHaveLength(3);
    const brief = tasks.body.find((t: { title: string }) => t.title === "Collect creative brief");
    expect(brief.priority).toBe("HIGH");
    const wireframes = tasks.body.find((t: { title: string }) => t.title === "Wireframes");
    expect(wireframes.dependenciesFrom).toHaveLength(1);
    expect(wireframes.dependenciesFrom[0].blockingTask.title).toBe("Collect creative brief");
    expect(wireframes.subtasks).toHaveLength(1);
  });

  it("a template cannot be instantiated for a client in a different organization", async () => {
    const { cookie: ownerA } = await signupOrg(app, { email: "owner-a@templates-cross-org-test.example" });
    const { cookie: ownerB } = await signupOrg(app, { email: "owner-b@templates-cross-org-test.example" });
    const clientB = await api(app).post("/api/v1/clients").set("Cookie", ownerB).send({ name: "Org B Client" });
    const templateA = await api(app)
      .post("/api/v1/project-templates")
      .set("Cookie", ownerA)
      .send(websiteBlueprint());

    const res = await api(app)
      .post(`/api/v1/project-templates/${templateA.body.id}/instantiate`)
      .set("Cookie", ownerB)
      .send({ clientId: clientB.body.id, name: "Cross org attempt" });
    expect(res.status).toBe(404);
  });

  it("updating a template re-validates the merged blueprint, and deleting it does not touch already-instantiated projects", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@templates-update-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Update Client" });
    const template = await api(app).post("/api/v1/project-templates").set("Cookie", cookie).send(websiteBlueprint());

    const instantiated = await api(app)
      .post(`/api/v1/project-templates/${template.body.id}/instantiate`)
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Kept Project" });

    const badUpdate = await api(app)
      .patch(`/api/v1/project-templates/${template.body.id}`)
      .set("Cookie", cookie)
      .send({ milestones: [{ key: "kickoff", name: "Kickoff", phaseKey: "ghost-phase" }] });
    expect(badUpdate.status).toBe(400);

    const del = await api(app).delete(`/api/v1/project-templates/${template.body.id}`).set("Cookie", cookie);
    expect(del.status).toBe(200);

    const stillThere = await api(app).get(`/api/v1/projects/${instantiated.body.id}`).set("Cookie", cookie);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.phases).toHaveLength(2);
  });
});
