export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** A stable name for what kind of email this is (e.g. "staff-invitation",
   * "client-portal-invitation") — recorded on EmailLog so delivery can be
   * audited/tested by template without parsing subject lines. */
  template: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
