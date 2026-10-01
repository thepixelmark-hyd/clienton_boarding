import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { PrismaService } from "../../prisma/prisma.service";
import type { EmailMessage, EmailProvider } from "../email-provider.interface";

/**
 * Real SMTP delivery via nodemailer, used only when SMTP_HOST is set (see
 * EmailModule). Still writes EmailLog — delivery being real doesn't mean it
 * stops being auditable the same way the console provider is.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly transport: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly prisma: PrismaService) {
    this.transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_PORT === "465",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    this.from = process.env.EMAIL_FROM ?? "ClientOS <notifications@example.com>";
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch (err) {
      // An email failure is never allowed to break the mutation that
      // triggered it (an invitation row is still created even if the
      // invite email bounces) — logged loudly instead, same as
      // ConsoleEmailProvider's "always record, never throw" contract.
      this.logger.error(`Failed to send email to ${message.to} (template=${message.template})`, err as Error);
    }

    await this.prisma.client.emailLog.create({
      data: {
        organizationId: message.organizationId,
        to: message.to,
        subject: message.subject,
        template: message.template,
        metadata: message.metadata as never,
        provider: "smtp",
      },
    });
  }
}
