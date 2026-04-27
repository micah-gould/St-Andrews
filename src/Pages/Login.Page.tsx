import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { MessageBanner } from '../components/MessageBanner';
import { OAuthButtons } from '../components/OAuthButtons';
import { PasswordField } from '../components/PasswordField';
import { useAuth } from '../providers/AuthProvider';
import { getNextPath } from '../utils/authRedirect';
import type { AuthMessage } from '../types/auth.types';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, providers } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(() => {
    if (searchParams.get('error') === 'oauth') {
      return { type: 'error', text: 'Single sign-on failed. Please try again or use email/password.' };
    }
    if (searchParams.get('reset') === '1') {
      return { type: 'success', text: 'Password updated. You can sign in with your new password.' };
    }
    return null;
  });

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue">
      <form
        className="auth-form"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage(null);
          if (!email.trim() || !password) {
            setMessage({ type: 'error', text: 'Please enter your email and password.' });
            return;
          }

          setSubmitting(true);
          try {
            await login({ email: email.trim(), password, remember });
            navigate(getNextPath(searchParams), { replace: true });
          } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Could not sign in.' });
            setSubmitting(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <PasswordField id="password" name="password" label="Password" autoComplete="current-password" value={password} onChange={setPassword} />
        <div className="row">
          <label>
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Remember me
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>Sign in</button>
        <MessageBanner message={message} />
      </form>
      <div className="divider">or</div>
      <OAuthButtons providers={providers} remember={remember} />
      <p className="alt-link">Don't have an account? <Link to="/signup">Create one</Link></p>
    </AuthLayout>
  );
}
