import { Inject, Injectable } from "@nestjs/common";
import { EMAIL_PROVIDER, type EmailProvider } from "./email-provider.interface";
import {
  clientPortalInvitationEmail,
  requirementSubmittedEmail,
  staffInvitationEmail,
} from "./templates/render";

@Injectable()
export class EmailService {
  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}

  async sendStaffInvitation(params: {
    to: string;
    organizationId: string;
    organizationName: string;
    inviteUrl: string;
  }) {
    const { subject, html, text } = staffInvitationEmail(params);
    await this.provider.send({
      to: params.to,
      subject,
      html,
      text,
      template: "staff-invitation",
      organizationId: params.organizationId,
      metadata: { inviteUrl: params.inviteUrl },
    });
  }

  async sendClientPortalInvitation(params: {
    to: string;
    organizationId: string;
    organizationName: string;
    clientName: string;
    inviteUrl: string;
  }) {
    const { subject, html, text } = clientPortalInvitationEmail(params);
    await this.provider.send({
      to: params.to,
      subject,
      html,
      text,
      template: "client-portal-invitation",
      organizationId: params.organizationId,
      metadata: { inviteUrl: params.inviteUrl },
    });
  }

  async sendRequirementSubmitted(params: {
    to: string;
    organizationId: string;
    clientName: string;
    formName: string;
    requirementUrl: string;
  }) {
    const { subject, html, text } = requirementSubmittedEmail(params);
    await this.provider.send({
      to: params.to,
      subject,
      html,
      text,
      template: "requirement-submitted",
      organizationId: params.organizationId,
      metadata: { requirementUrl: params.requirementUrl },
    });
  }
}
