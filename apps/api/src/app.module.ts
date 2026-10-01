import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { ClientsModule } from "./clients/clients.module";
import { ProjectsModule } from "./projects/projects.module";
import { FormsModule } from "./forms/forms.module";
import { PortalModule } from "./portal/portal.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { SessionAuthGuard } from "./common/guards/session-auth.guard";
import { PortalAuthGuard } from "./portal/portal-auth.guard";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Generous global default (this is a belt-and-suspenders backstop, not
    // the primary control) — the meaningful limit is the tighter one applied
    // directly to /auth/login and /auth/signup (see auth.controller.ts),
    // scoped there rather than globally so it doesn't throttle routine
    // polling (e.g. GET /auth/me) under normal or test-suite traffic.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    ClientsModule,
    ProjectsModule,
    FormsModule,
    PortalModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // Order matters: staff session resolution, then portal session
    // resolution (a no-op unless a portal cookie is present — see
    // PortalAuthGuard's own comment on why it must run here and not as a
    // module-local guard), then CSRF (needs authSource from whichever of
    // the two set it), then permission checks.
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: PortalAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
