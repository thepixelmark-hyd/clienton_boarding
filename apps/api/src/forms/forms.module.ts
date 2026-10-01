import { Module } from "@nestjs/common";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { FormsUploadService } from "./forms-upload.service";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [AuditModule, EmailModule, StorageModule],
  controllers: [FormsController],
  providers: [FormsService, FormsUploadService],
  exports: [FormsService, FormsUploadService],
})
export class FormsModule {}
