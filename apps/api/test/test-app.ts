import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/** Boots a real Nest application (all guards/filters/modules wired) against
 * the clientos_test Postgres database, for Supertest to exercise over HTTP. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix("api/v1");
  await app.init();
  return app;
}

export function getPrisma(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

/** Wipes every table between test files so they don't interfere with each
 * other, without re-running migrations (fast). Order respects FK dependency
 * (children before parents) since we don't rely on cascade here. */
export async function truncateAll(prisma: PrismaService) {
  const tableNames = [
    "email_logs",
    "audit_logs",
    "csat_responses",
    "time_entries",
    "change_requests",
    "approvals",
    "comments",
    "asset_versions",
    "assets",
    "deliverable_requirements",
    "requirement_versions",
    "requirements",
    "form_response_files",
    "form_responses",
    "form_submissions",
    "form_fields",
    "forms",
    "task_dependencies",
    "tasks",
    "milestones",
    "project_phases",
    "project_members",
    "projects",
    "client_timeline_events",
    "client_invitations",
    "client_onboarding_items",
    "client_portal_sessions",
    "client_portal_users",
    "contacts",
    "clients",
    "team_members",
    "teams",
    "invitations",
    "sessions",
    "memberships",
    "users",
    "organizations",
  ];
  await prisma.client.$transaction(
    tableNames.map((name) => prisma.client.$executeRawUnsafe(`TRUNCATE TABLE "${name}" CASCADE`)),
  );
}
