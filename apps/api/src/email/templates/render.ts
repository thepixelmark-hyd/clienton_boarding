/** Minimal, dependency-free HTML email shell. No templating engine — these
 * are the only three emails this phase sends, and each is a handful of
 * lines; pulling in MJML/react-email for that would be solving a problem
 * this codebase doesn't have yet. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family: -apple-system, sans-serif; color: #1a1a1a; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="margin: 0 0 16px;">${escapeHtml(title)}</h2>
  ${bodyHtml}
  <p style="color: #666; font-size: 12px; margin-top: 32px;">ClientOS</p>
</body></html>`;
}

export function staffInvitationEmail(params: { organizationName: string; inviteUrl: string }) {
  const subject = `You're invited to join ${params.organizationName} on ClientOS`;
  const text = `You've been invited to join ${params.organizationName} on ClientOS. Accept your invitation: ${params.inviteUrl}`;
  const html = shell(
    subject,
    `<p>You've been invited to join <strong>${escapeHtml(params.organizationName)}</strong> on ClientOS.</p>
     <p><a href="${params.inviteUrl}" style="color: #2563eb;">Accept your invitation</a></p>`,
  );
  return { subject, html, text };
}

export function clientPortalInvitationEmail(params: {
  organizationName: string;
  clientName: string;
  inviteUrl: string;
}) {
  const subject = `${params.organizationName} invited you to their client portal`;
  const text = `${params.organizationName} invited you to the ${params.clientName} client portal. Accept your invitation: ${params.inviteUrl}`;
  const html = shell(
    subject,
    `<p><strong>${escapeHtml(params.organizationName)}</strong> invited you to the
      <strong>${escapeHtml(params.clientName)}</strong> client portal, where you can track project
      requirements and onboarding.</p>
     <p><a href="${params.inviteUrl}" style="color: #2563eb;">Accept your invitation</a></p>`,
  );
  return { subject, html, text };
}

export function requirementSubmittedEmail(params: { clientName: string; formName: string; requirementUrl: string }) {
  const subject = `${params.clientName} submitted: ${params.formName}`;
  const text = `${params.clientName} submitted their response to "${params.formName}". Review it: ${params.requirementUrl}`;
  const html = shell(
    subject,
    `<p><strong>${escapeHtml(params.clientName)}</strong> submitted their response to
      <strong>${escapeHtml(params.formName)}</strong>.</p>
     <p><a href="${params.requirementUrl}" style="color: #2563eb;">Review the submission</a></p>`,
  );
  return { subject, html, text };
}
