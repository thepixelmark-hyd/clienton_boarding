/**
 * Deterministic demo data for a realistic digital agency, per docs/product.md
 * §112. Run with `pnpm db:seed`. Safe to re-run: it upserts by natural keys
 * (org slug, user email) rather than blindly inserting duplicates.
 *
 * This is development/demo fixture data — the running application never
 * depends on it existing (docs/product.md §87 "no mock data in production").
 */
import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import {
  computeReadiness,
  getFormTemplate,
  type ReadinessField,
} from "@clientos/shared";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "DemoPass123";

async function hashDemoPassword() {
  return argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

async function main() {
  const passwordHash = await hashDemoPassword();

  // ---------------------------------------------------------------------
  // Organization + team
  // ---------------------------------------------------------------------
  const org = await prisma.organization.upsert({
    where: { slug: "meridian-digital" },
    update: {},
    create: { name: "Meridian Digital", slug: "meridian-digital", currency: "INR", timezone: "Asia/Kolkata" },
  });

  const team = [
    { email: "alex@meridian.agency", fullName: "Alex Rivera", role: "OWNER" as const },
    { email: "jordan@meridian.agency", fullName: "Jordan Lee", role: "PROJECT_MANAGER" as const },
    { email: "sam@meridian.agency", fullName: "Sam Chen", role: "EMPLOYEE" as const },
    { email: "taylor@meridian.agency", fullName: "Taylor Brooks", role: "ACCOUNT_MANAGER" as const },
  ];

  const users: Record<string, { id: string }> = {};
  for (const member of team) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {},
      create: { email: member.email, fullName: member.fullName, passwordHash },
    });
    users[member.email] = user;
    await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: {},
      create: { organizationId: org.id, userId: user.id, role: member.role },
    });
  }

  const pm = users["jordan@meridian.agency"];
  const designer = users["sam@meridian.agency"];

  // ---------------------------------------------------------------------
  // Clients + contacts
  // ---------------------------------------------------------------------
  const clientDefs = [
    {
      key: "abc-technologies",
      name: "ABC Technologies",
      industry: "Enterprise Software",
      website: "https://abctechnologies.example",
      contact: { fullName: "Morgan Patel", email: "morgan@abctechnologies.example", title: "VP Marketing", isDecisionMaker: true },
    },
    {
      key: "nova-healthcare",
      name: "Nova Healthcare",
      industry: "Healthcare",
      website: "https://novahealthcare.example",
      contact: { fullName: "Riley Kim", email: "riley@novahealthcare.example", title: "Director of Digital", isPrimary: true },
    },
    {
      key: "digital-fiber",
      name: "Digital Fiber",
      industry: "Telecommunications",
      website: "https://digitalfiber.example",
      contact: { fullName: "Casey Nguyen", email: "casey@digitalfiber.example", title: "Growth Marketing Lead" },
    },
    {
      key: "acme-retail",
      name: "Acme Retail",
      industry: "Retail",
      website: "https://acmeretail.example",
      contact: { fullName: "Drew Martinez", email: "drew@acmeretail.example", title: "Finance Director", isBillingContact: true },
    },
  ];

  const clients: Record<string, Awaited<ReturnType<typeof prisma.client.create>>> = {};
  for (const def of clientDefs) {
    let client = await prisma.client.findFirst({ where: { organizationId: org.id, name: def.name } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          organizationId: org.id,
          name: def.name,
          industry: def.industry,
          website: def.website,
          status: "ACTIVE",
          onboardingStatus: "COMPLETED",
        },
      });
      await prisma.contact.create({
        data: { organizationId: org.id, clientId: client.id, ...def.contact },
      });
      await prisma.clientTimelineEvent.create({
        data: { organizationId: org.id, clientId: client.id, type: "CLIENT_CREATED", title: "Client created" },
      });
    }
    clients[def.key] = client;
  }

  // ---------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------
  async function ensureProject(
    clientKey: string,
    name: string,
    type: string,
    status: "PLANNING" | "ACTIVE" | "ON_HOLD",
  ) {
    const client = clients[clientKey];
    let project = await prisma.project.findFirst({ where: { organizationId: org.id, clientId: client.id, name } });
    if (!project) {
      project = await prisma.project.create({
        data: {
          organizationId: org.id,
          clientId: client.id,
          name,
          type,
          status,
          startDate: new Date(Date.now() - 14 * 86_400_000),
          targetEndDate: new Date(Date.now() + 30 * 86_400_000),
          contractValue: 450000,
          budgetHours: 240,
        },
      });
      await prisma.projectMember.create({ data: { projectId: project.id, userId: pm.id, role: "LEAD" } });
      await prisma.projectMember.create({ data: { projectId: project.id, userId: designer.id, role: "CONTRIBUTOR" } });
      await prisma.clientTimelineEvent.create({
        data: { organizationId: org.id, clientId: client.id, type: "PROJECT_CREATED", title: `Project created: ${name}` },
      });
    }
    return project;
  }

  const brandProject = await ensureProject("abc-technologies", "Brand Identity Refresh", "Brand Identity", "ACTIVE");
  const websiteProject = await ensureProject("nova-healthcare", "Patient Portal Website", "Website", "ACTIVE");
  const marketingProject = await ensureProject("digital-fiber", "Q1 Digital Marketing Campaign", "Digital Marketing", "PLANNING");
  const appProject = await ensureProject("acme-retail", "Mobile Shopping App", "Mobile App Development", "ON_HOLD");

  // ---------------------------------------------------------------------
  // Deliverables + tasks (including one deliberately overdue task so the
  // demo shows a WATCH/AT_RISK project, not everything green)
  // ---------------------------------------------------------------------
  async function ensureDeliverable(projectId: string, name: string) {
    let d = await prisma.deliverable.findFirst({ where: { projectId, name } });
    if (!d) d = await prisma.deliverable.create({ data: { organizationId: org.id, projectId, name } });
    return d;
  }

  const logoDeliverable = await ensureDeliverable(brandProject.id, "Logo Design");
  await ensureDeliverable(brandProject.id, "Brand Guidelines");
  const homepageDeliverable = await ensureDeliverable(websiteProject.id, "Homepage Design");

  async function ensureTask(
    projectId: string,
    title: string,
    opts: { status?: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"; dueInDays?: number; assigneeId?: string; deliverableId?: string } = {},
  ) {
    const existing = await prisma.task.findFirst({ where: { projectId, title } });
    if (existing) return existing;
    return prisma.task.create({
      data: {
        organizationId: org.id,
        projectId,
        title,
        status: opts.status ?? "TODO",
        assigneeId: opts.assigneeId,
        deliverableId: opts.deliverableId,
        dueDate: opts.dueInDays !== undefined ? new Date(Date.now() + opts.dueInDays * 86_400_000) : undefined,
      },
    });
  }

  await ensureTask(brandProject.id, "Competitor logo audit", { status: "DONE", assigneeId: designer.id, deliverableId: logoDeliverable.id });
  await ensureTask(brandProject.id, "Logo concept exploration", { status: "IN_REVIEW", assigneeId: designer.id, dueInDays: -2, deliverableId: logoDeliverable.id });
  await ensureTask(brandProject.id, "Brand guideline document", { status: "TODO", assigneeId: designer.id, dueInDays: 10 });

  await ensureTask(websiteProject.id, "Information architecture", { status: "DONE", assigneeId: pm.id });
  await ensureTask(websiteProject.id, "Homepage wireframes", { status: "IN_PROGRESS", assigneeId: designer.id, dueInDays: 5, deliverableId: homepageDeliverable.id });
  await ensureTask(websiteProject.id, "Accessibility review", { status: "TODO", dueInDays: 20 });

  await ensureTask(marketingProject.id, "Campaign brief", { status: "TODO", assigneeId: pm.id, dueInDays: 3 });
  await ensureTask(appProject.id, "Feature scoping workshop", { status: "TODO", dueInDays: 15 });

  // ---------------------------------------------------------------------
  // Requirements: a fully-answered, READY logo questionnaire for the brand
  // project, and a partially-answered, MISSING website discovery for the
  // website project — demonstrating both ends of requirement readiness.
  // ---------------------------------------------------------------------
  async function ensureRequirementFromTemplate(
    projectId: string,
    clientId: string,
    templateKey: string,
    answers: Record<string, unknown>,
  ) {
    const template = getFormTemplate(templateKey)!;
    let form = await prisma.form.findFirst({ where: { projectId, templateKey } });
    if (form) return; // already seeded

    form = await prisma.form.create({
      data: {
        organizationId: org.id,
        projectId,
        clientId,
        templateKey: template.templateKey,
        name: template.name,
        description: template.description,
      },
    });
    const createdFields = await Promise.all(
      template.fields.map((f, index) =>
        prisma.formField.create({
          data: {
            formId: form!.id,
            key: f.key,
            label: f.label,
            helpText: f.helpText,
            type: f.type,
            required: f.required,
            order: index,
            options: f.options as never,
            conditionalRule: f.conditionalRule as never,
          },
        }),
      ),
    );
    const submission = await prisma.formSubmission.create({
      data: { formId: form.id, organizationId: org.id, clientId, status: "SUBMITTED", submittedAt: new Date() },
    });
    for (const field of createdFields) {
      const value = answers[field.key];
      if (value === undefined) continue;
      await prisma.formResponse.create({
        data: {
          submissionId: submission.id,
          fieldId: field.id,
          valueText: typeof value === "string" ? value : undefined,
          valueJson: typeof value === "string" ? undefined : (value as never),
        },
      });
    }

    const readinessFields: ReadinessField[] = template.fields.map((f) => ({
      key: f.key,
      label: f.label,
      required: f.required,
      conditionalRule: f.conditionalRule,
    }));
    const readiness = computeReadiness(readinessFields, answers);

    const requirement = await prisma.requirement.create({
      data: {
        organizationId: org.id,
        projectId,
        submissionId: submission.id,
        title: template.name,
        readiness: readiness.readiness,
        missingFields: readiness.missingFields as never,
        conflicts: readiness.conflicts as never,
      },
    });

    if (template.templateKey === "logo-design") {
      await prisma.deliverableRequirement.create({
        data: { deliverableId: logoDeliverable.id, requirementId: requirement.id },
      });
    }
  }

  await ensureRequirementFromTemplate(brandProject.id, clients["abc-technologies"].id, "logo-design", {
    businessName: "ABC Technologies",
    slogan: "Systems that scale with you",
    companyOffering: "Cloud infrastructure monitoring and cost-optimization tools for mid-market SaaS companies.",
    primaryMessage: "Enterprise-grade reliability without enterprise-grade complexity.",
    uniqueSellingProposition: "One-click cost anomaly detection that competitors charge extra for.",
    targetMarket: "Engineering leaders at Series B-D SaaS companies, 50-500 employees.",
    logoUsage: ["website", "business_cards", "social_media"],
    preferredColors: ["navy", "gray"],
    colorsToAvoid: ["green"],
    colorsToAvoidNote: "Associated with a competitor.",
    competitors: "Datadog (too expensive), New Relic (too complex onboarding).",
    shortTermGoals: "Close 20 new mid-market logos in the next 2 quarters.",
    longTermGoals: "Become the default monitoring layer for Series B+ SaaS companies in APAC.",
    brandAdjectives: ["trustworthy", "modern", "professional", "reliable", "approachable"],
    additionalNotes: "Current logo feels dated — like a 2014 startup, not a company with enterprise customers now.",
  });

  await ensureRequirementFromTemplate(websiteProject.id, clients["nova-healthcare"].id, "website-discovery", {
    websiteExists: "yes",
    currentUrl: "https://novahealthcare.example",
    // currentSiteProblems intentionally left blank -> MISSING, demonstrating
    // an incomplete brief a PM still needs to follow up on.
    pageCount: 12,
    ecommerceNeeded: "no",
  });

  console.log("\nSeed complete.\n");
  console.log(`Organization: ${org.name} (${org.slug})`);
  console.log("Sign in with any of:");
  for (const member of team) {
    console.log(`  ${member.email}  /  ${DEMO_PASSWORD}  (${member.role})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
