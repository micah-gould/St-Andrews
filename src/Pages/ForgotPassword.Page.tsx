import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../auth/authClient';
import { AuthLayout } from '../components/AuthLayout';
import { MessageBanner } from '../components/MessageBanner';
import type { AuthMessage } from '../types/auth.types';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a link.">
      <form
        className="auth-form"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage(null);
          if (!email.trim()) {
            setMessage({ type: 'error', text: 'Please enter your email address.' });
            return;
          }

          setSubmitting(true);
          try {
            await authApi.forgotPassword(email.trim());
            setMessage({ type: 'success', text: 'If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).' });
          } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Could not send reset email.' });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="forgot-email">Email</label>
          <input id="forgot-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>Send reset link</button>
        <MessageBanner message={message} />
      </form>
      <p className="alt-link"><Link to="/login">Back to sign in</Link></p>
    </AuthLayout>
  );
}
