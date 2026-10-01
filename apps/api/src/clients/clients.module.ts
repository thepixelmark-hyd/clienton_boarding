import { Module } from "@nestjs/common";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [AuditModule, EmailModule, StorageModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
