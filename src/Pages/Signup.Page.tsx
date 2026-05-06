import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { MessageBanner } from "../components/MessageBanner";
import { OAuthButtons } from "../components/OAuthButtons";
import { PasswordField } from "../components/PasswordField";
import { useAuth } from "../providers/AuthProvider";
import { getNextPath } from "../utils/authRedirect";
import type { AuthMessage } from "../types/auth.types";

function formatSeconds(ms: number) {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { providers, signup, verifySignup, resendSignupCode } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<
    string | null
  >(null);
  const [verificationExpiresAt, setVerificationExpiresAt] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [maxResends, setMaxResends] = useState(10);
  const [resendsUsed, setResendsUsed] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  React.useEffect(() => {
    if (!pendingVerificationEmail) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [pendingVerificationEmail]);

  const expiresInMs = Math.max(0, verificationExpiresAt - now);
  const resendInMs = Math.max(0, resendAvailableAt - now);
  const canResend =
    !!pendingVerificationEmail && resendInMs === 0 && resendsUsed < maxResends;
  const remainingResends = Math.max(0, maxResends - resendsUsed);

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Plan your modules in seconds"
    >
      <form
        className="auth-form"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage(null);
          if (pendingVerificationEmail) {
            if (!/^\d{6}$/.test(verificationCode.trim())) {
              setMessage({
                type: "error",
                text: "Please enter the 6-digit code sent to your email.",
              });
              return;
            }

            setSubmitting(true);
            try {
              await verifySignup({
                email: pendingVerificationEmail,
                code: verificationCode.trim(),
              });
              navigate(getNextPath(searchParams), { replace: true });
              return;
            } catch (error) {
              const text =
                error.message ||
                "Could not verify your email. Please request a new code.";
              setMessage({ type: "error", text });
              setSubmitting(false);
              if (/expired/i.test(text)) {
                setPendingVerificationEmail(null);
                setVerificationCode("");
              }
              return;
            }
          }

          if (!email.trim()) {
            setMessage({
              type: "error",
              text: "Please enter an email address.",
            });
            return;
          }
          if (password.length < 8) {
            setMessage({
              type: "error",
              text: "Password must be at least 8 characters.",
            });
            return;
          }

          setSubmitting(true);
          try {
            const response = await signup({
              name: name.trim(),
              email: email.trim(),
              password,
              remember,
            });

            if (response.pendingVerification) {
              const nextEmail = response.email || email.trim().toLowerCase();
              const nowTs = Date.now();
              setPendingVerificationEmail(nextEmail);
              setVerificationCode("");
              setVerificationExpiresAt(nowTs + (response.expiresInMs || 0));
              setResendAvailableAt(nowTs + (response.resendAvailableInMs || 0));
              setMaxResends(response.maxResends || 10);
              setResendsUsed(response.resendsUsed || 0);
              setSubmitting(false);
              setMessage({
                type: "info",
                text: "We sent a verification code to your email.",
              });
              return;
            }

            navigate(getNextPath(searchParams), { replace: true });
          } catch (error) {
            setMessage({
              type: "error",
              text: error.message || "Could not create account.",
            });
            setSubmitting(false);
          }
        }}
      >
        {!pendingVerificationEmail ? (
          <>
            <div className="field">
              <label htmlFor="name">
                Name <span className="field-optional">(optional)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <PasswordField
              id="signup-password"
              name="password"
              label="Password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={setPassword}
            />
            <div className="row">
              <label htmlFor="signup-remember-me">
                <input
                  id="signup-remember-me"
                  name="rememberMe"
                  type="checkbox"
                  autoComplete="off"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Remember me
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="signup-code">Verification code</label>
              <input
                id="signup-code"
                name="signupCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(event.target.value.replace(/\D/g, ""))
                }
              />
            </div>
            <p className="helper-text">
              Enter the 6-digit code sent to{" "}
              <strong>{pendingVerificationEmail}</strong>.
            </p>
            <p className="helper-text">
              Code expires in {formatSeconds(expiresInMs)}. Resends left:{" "}
              {remainingResends}.
            </p>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                className="btn"
                disabled={!canResend || submitting}
                onClick={async () => {
                  if (!pendingVerificationEmail) return;
                  setMessage(null);
                  setSubmitting(true);
                  try {
                    const response = await resendSignupCode({
                      email: pendingVerificationEmail,
                    });
                    const nowTs = Date.now();
                    setResendAvailableAt(
                      nowTs + (response.resendAvailableInMs || 0),
                    );
                    setVerificationExpiresAt(
                      nowTs + (response.expiresInMs || 0),
                    );
                    setResendsUsed(response.resendsUsed || 0);
                    setMaxResends(response.maxResends || 10);
                    setMessage({
                      type: "success",
                      text: "A new code has been sent.",
                    });
                  } catch (error) {
                    setMessage({
                      type: "error",
                      text:
                        error.message ||
                        "Could not send a new code. Please try again.",
                    });
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {canResend
                  ? "I didn't get the code"
                  : `Resend in ${formatSeconds(resendInMs)}`}
              </button>
            </div>
          </>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {pendingVerificationEmail ? "Verify email" : "Create account"}
        </button>
        <MessageBanner message={message} />
      </form>
      {!pendingVerificationEmail ? (
        <>
          <div className="divider">or</div>
          <OAuthButtons providers={providers} remember={remember} />
          <p className="alt-link">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </>
      ) : null}
    </AuthLayout>
  );
}
