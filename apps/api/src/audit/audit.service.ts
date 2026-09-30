import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  organizationId: string;
  actorUserId?: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Append-only audit trail. There is deliberately no update/delete method —
 * see docs/security.md "Audit logging". Called from services after a
 * sensitive mutation commits, inside the same transaction where practical.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    await this.prisma.client.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        actorUserId: entry.actorUserId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        before: entry.before as never,
        after: entry.after as never,
      },
    });
  }
}
