import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { MessageBanner } from "../components/MessageBanner";
import { OAuthButtons } from "../components/OAuthButtons";
import { PasswordField } from "../components/PasswordField";
import { useAuth } from "../providers/AuthProvider";
import { getNextPath } from "../utils/authRedirect";
import type { AuthMessage } from "../types/auth.types";

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { providers, signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);

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
            await signup({
              name: name.trim(),
              email: email.trim(),
              password,
              remember,
            });
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
          <label>
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember me
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          Create account
        </button>
        <MessageBanner message={message} />
      </form>
      <div className="divider">or</div>
      <OAuthButtons providers={providers} remember={remember} />
      <p className="alt-link">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
