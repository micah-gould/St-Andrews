import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../auth/authClient";
import { AuthLayout } from "../components/AuthLayout";
import { MessageBanner } from "../components/MessageBanner";
import { PasswordField } from "../components/PasswordField";
import type { AuthMessage } from "../types/auth.types";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(
    token
      ? null
      : { type: "error", text: "This reset link is missing or invalid." },
  );

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick something at least 8 characters long."
    >
      <form
        className="auth-form"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage(null);
          if (!token) {
            setMessage({
              type: "error",
              text: "This reset link is missing or invalid.",
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
          if (password !== confirm) {
            setMessage({ type: "error", text: "Passwords do not match." });
            return;
          }

          setSubmitting(true);
          try {
            await authApi.resetPassword({ token, password });
            navigate("/login?reset=1", { replace: true });
          } catch (error) {
            setMessage({
              type: "error",
              text: error.message || "Could not reset password.",
            });
            setSubmitting(false);
          }
        }}
      >
        <PasswordField
          id="reset-password"
          name="password"
          label="New password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={setPassword}
        />
        <PasswordField
          id="reset-confirm"
          name="confirm"
          label="Confirm password"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={setConfirm}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !token}
        >
          Update password
        </button>
        <MessageBanner message={message} />
      </form>
      <p className="alt-link">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
