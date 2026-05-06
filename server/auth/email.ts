function logSuppressedEmail({
  to,
  subject,
  text,
  debugLabel,
}: {
  to: string;
  subject: string;
  text: string;
  debugLabel: string;
}) {
  console.log(`\n[email:disabled] ${debugLabel}`);
  console.log(`  To: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Text: ${text}\n`);
}

type SignupVerificationPayload = {
  to: string;
  code: string;
  name?: string | null;
};

export async function sendSignupVerificationEmail({
  to,
  code,
  name,
}: SignupVerificationPayload) {
  const greeting = name ? `Hi ${name},` : "Hello,";
  const subject = "Verify your email";
  const text = `${greeting}

Use this verification code to finish creating your account:

${code}

This code expires in 15 minutes. If you did not try to sign up, you can safely ignore this email.`;

  logSuppressedEmail({
    to,
    subject,
    text,
    debugLabel: "Signup verification email",
  });

  return { disabled: true };
}

export async function sendPasswordResetEmail({ to, resetUrl, name }) {
  const greeting = name ? `Hi ${name},` : "Hello,";
  const subject = "Reset your password";
  const text = `${greeting}

We received a request to reset your password. Click the link below to choose a new one. This link is valid for 1 hour.

${resetUrl}

If you did not request this, you can safely ignore this email.`;

  logSuppressedEmail({
    to,
    subject,
    text,
    debugLabel: "Password reset email",
  });

  return { disabled: true };
}
