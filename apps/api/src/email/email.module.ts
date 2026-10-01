import { Module } from "@nestjs/common";
import { EMAIL_PROVIDER } from "./email-provider.interface";
import { ConsoleEmailProvider } from "./providers/console-email.provider";
import { SmtpEmailProvider } from "./providers/smtp-email.provider";
import { EmailService } from "./email.service";

@Module({
  providers: [
    ConsoleEmailProvider,
    SmtpEmailProvider,
    {
      // Real delivery only when SMTP is actually configured — otherwise the
      // console/log+EmailLog provider, never a silent no-op either way (see
      // ConsoleEmailProvider's own comment on why that distinction matters).
      provide: EMAIL_PROVIDER,
      useFactory: (consoleProvider: ConsoleEmailProvider, smtpProvider: SmtpEmailProvider) =>
        process.env.SMTP_HOST ? smtpProvider : consoleProvider,
      inject: [ConsoleEmailProvider, SmtpEmailProvider],
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
