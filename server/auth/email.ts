import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendPasswordResetEmail({ to, resetUrl, name }) {
  const subject = 'Reset your password';
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const text = `${greeting}

We received a request to reset your password. Click the link below to choose a new one. This link is valid for 1 hour.

${resetUrl}

If you did not request this, you can safely ignore this email.`;

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color:#222;">
      <h2 style="margin:0 0 16px;">Reset your password</h2>
      <p>${greeting}</p>
      <p>We received a request to reset your password. Click the button below to choose a new one. This link is valid for 1 hour.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}"
           style="background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block;">
          Reset password
        </a>
      </p>
      <p style="font-size:12px;color:#666;">Or copy and paste this URL into your browser:<br>${resetUrl}</p>
      <p style="font-size:12px;color:#666;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  if (!resend) {
    console.log('\n[email:dev-fallback] Password reset email (no RESEND_API_KEY set)');
    console.log(`  To: ${to}`);
    console.log(`  Reset URL: ${resetUrl}\n`);
    return { dev: true };
  }

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error('Failed to send email.');
  }

  return data;
}
