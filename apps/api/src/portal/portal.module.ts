import { Module } from "@nestjs/common";
import { PortalAuthController } from "./portal-auth.controller";
import { PortalAuthService } from "./portal-auth.service";
import { PortalController } from "./portal.controller";
import { PortalPermissionsGuard } from "./portal-permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { ClientsModule } from "../clients/clients.module";
import { FormsModule } from "../forms/forms.module";

@Module({
  imports: [AuditModule, ClientsModule, FormsModule],
  controllers: [PortalAuthController, PortalController],
  providers: [PortalAuthService, PortalPermissionsGuard],
})
export class PortalModule {}
