import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { EmailMessage, EmailProvider } from "../email-provider.interface";

/**
 * The default provider when SMTP_HOST isn't configured (true of this
 * sandbox, and of a fresh clone before anyone sets production secrets — see
 * .env.example). Never silently "pretends" to send: it logs loudly and
 * writes a real, queryable EmailLog row, so a test or a developer can assert
 * an email was triggered without standing up a mail server. This is the
 * same honesty principle as the local-disk StorageProvider — a working dev
 * implementation behind the real interface, not a mock standing in for one.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `[email:console] to=${message.to} template=${message.template} subject="${message.subject}" ` +
        "(SMTP_HOST not configured — logged only, not actually delivered; see docs/security.md)",
    );
    await this.prisma.client.emailLog.create({
      data: {
        organizationId: message.organizationId,
        to: message.to,
        subject: message.subject,
        template: message.template,
        metadata: message.metadata as never,
        provider: "console",
      },
    });
  }
}
