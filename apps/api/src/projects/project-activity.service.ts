import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ProjectActivityEntry {
  organizationId: string;
  projectId: string;
  type: string;
  title: string;
  description?: string;
  actorUserId?: string;
  actorContactId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * A real, append-only feed of what happened on a project — written
 * alongside the mutation that caused it (see callers in tasks.service.ts,
 * projects.service.ts, deliverables.service.ts, ...), not derived from
 * AuditLog after the fact. Distinct from AuditLog: AuditLog is a generic
 * before/after diff for every sensitive mutation across the whole app
 * (security.md); this is a human-readable, project-scoped narrative meant
 * to be read directly in the product (product.md "project activity").
 */
@Injectable()
export class ProjectActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: ProjectActivityEntry) {
    await this.prisma.client.projectActivityEvent.create({
      data: {
        organizationId: entry.organizationId,
        projectId: entry.projectId,
        type: entry.type,
        title: entry.title,
        description: entry.description,
        actorUserId: entry.actorUserId,
        actorContactId: entry.actorContactId,
        metadata: entry.metadata as never,
      },
    });
  }

  async list(organizationId: string, projectId: string, limit = 50) {
    return this.prisma.client.projectActivityEvent.findMany({
      where: { organizationId, projectId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }
}
