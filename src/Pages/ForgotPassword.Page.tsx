import React from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";

export function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link."
    >
      <div className="auth-form">
        <p className="helper-text">
          Sorry, we are unable to help you, please create a new account with a
          new email.
        </p>
        <Link to="/signup" className="btn btn-primary">
          Create new account
        </Link>
      </div>
      <p className="alt-link">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
