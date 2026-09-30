import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { prisma } from "@clientos/database";

/**
 * Thin NestJS wrapper around the shared Prisma client singleton so it
 * participates in Nest's lifecycle (clean disconnect on shutdown) and can be
 * injected like any other provider.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = prisma;

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
