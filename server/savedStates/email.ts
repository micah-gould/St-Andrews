// Email helpers for access-request notifications.
// Falls back to console logging when RESEND_API_KEY is not set.

import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

export async function sendAccessRequestEmail({
  to,
  ownerName,
  requesterEmail,
  requesterName,
  stateName,
  requestedRole,
  message,
  manageUrl,
}) {
  const displayRequester = requesterName
    ? `${requesterName} (${requesterEmail})`
    : requesterEmail;
  const subject = `Access request for "${stateName}"`;
  const greeting = ownerName ? `Hi ${ownerName},` : "Hello,";
  const textBody = `${greeting}

${displayRequester} is requesting ${requestedRole} access to your saved plan "${stateName}".
${message ? `\nTheir note:\n${message}\n` : ""}
Review this request: ${manageUrl}

You can approve, change the level, or deny in the Share dialog.`;

  const htmlBody = `
    <div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;color:#222">
      <h2 style="margin:0 0 16px">Access request</h2>
      <p>${greeting}</p>
      <p><strong>${escapeHtml(displayRequester)}</strong> is requesting
      <strong>${escapeHtml(requestedRole)}</strong> access to your saved plan
      <strong>${escapeHtml(stateName)}</strong>.</p>
      ${message ? `<blockquote style="border-left:3px solid #ccc;margin:16px 0;padding:4px 12px;color:#555;">${escapeHtml(message)}</blockquote>` : ""}
      <p style="margin:24px 0">
        <a href="${manageUrl}"
           style="background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block;">
          Review request
        </a>
      </p>
      <p style="font-size:12px;color:#666;">Or paste this into your browser:<br>${escapeHtml(manageUrl)}</p>
    </div>
  `;

  if (!resend) {
    console.log(
      "\n[email:dev-fallback] Access request email (no RESEND_API_KEY set)",
    );
    console.log(`  To: ${to}`);
    console.log(`  From requester: ${displayRequester}`);
    console.log(`  Role: ${requestedRole}`);
    console.log(`  State: ${stateName}`);
    console.log(`  Manage URL: ${manageUrl}\n`);
    return { dev: true };
  }

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });
  if (error) {
    console.error("[email] access-request send failed", error);
    throw new Error("Failed to send email.");
  }
  return data;
}
