// Lightweight client for the auth API.

const BASE = '/api/auth';

async function request(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const authApi = {
  me: () => request('/me'),
  signup: ({ email, password, name, remember }) =>
    request('/signup', { method: 'POST', body: { email, password, name, remember } }),
  login: ({ email, password, remember }) =>
    request('/login', { method: 'POST', body: { email, password, remember } }),
  logout: () => request('/logout', { method: 'POST' }),
  forgotPassword: (email) =>
    request('/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: ({ token, password }) =>
    request('/reset-password', { method: 'POST', body: { token, password } }),
};

export function oauthUrl(provider, { remember = false } = {}) {
  return `/api/auth/${provider}?remember=${remember ? '1' : '0'}`;
}

export function getProvidersFromMe(me) {
  return me?.providers || { google: false, microsoft: false };
}

// UI helper: inject Google/Microsoft buttons (hidden if provider not enabled).
export function renderOAuthButtons(container, { providers, remember = () => false }) {
  container.innerHTML = '';

  const make = (provider, label, iconSvg) => {
    const a = document.createElement('a');
    a.className = 'btn oauth-btn';
    a.dataset.provider = provider;
    a.href = oauthUrl(provider, { remember: remember() });
    a.innerHTML = `${iconSvg}<span>${label}</span>`;
    a.addEventListener('click', (e) => {
      // Update href right before navigation so the latest "remember" value is used.
      a.href = oauthUrl(provider, { remember: remember() });
    });
    return a;
  };

  const googleIcon = `
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.2 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.6-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C39.7 36 44 30.4 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>`;
  const microsoftIcon = `
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect width="20" height="20" x="4"  y="4"  fill="#F25022"/>
      <rect width="20" height="20" x="24" y="4"  fill="#7FBA00"/>
      <rect width="20" height="20" x="4"  y="24" fill="#00A4EF"/>
      <rect width="20" height="20" x="24" y="24" fill="#FFB900"/>
    </svg>`;

  if (providers.google) {
    container.appendChild(make('google', 'Continue with Google', googleIcon));
  }
  if (providers.microsoft) {
    container.appendChild(make('microsoft', 'Continue with Microsoft', microsoftIcon));
  }

  if (!providers.google && !providers.microsoft) {
    const note = document.createElement('p');
    note.className = 'message info';
    note.textContent = 'Single sign-on is not configured on this server.';
    container.appendChild(note);
  }
}

export function showMessage(el, text, type = 'error') {
  if (!el) return;
  el.className = `message ${type}`;
  el.textContent = text;
  el.classList.remove('hidden');
}

export function clearMessage(el) {
  if (!el) return;
  el.classList.add('hidden');
  el.textContent = '';
}
