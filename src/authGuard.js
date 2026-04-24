// Auth guard for the main app: requires a logged-in user.
// Also exposes the current user globally and adds a sign-out button to the toolbar.

import { authApi } from './auth/authClient.js';

function redirectToLogin() {
  // Preserve where the user was trying to go (for post-login redirect, future use).
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/login.html?next=${next}`);
}

async function init() {
  let me;
  try {
    me = await authApi.me();
  } catch (err) {
    console.warn('[authGuard] failed to fetch /me', err);
    redirectToLogin();
    return;
  }

  if (!me?.user) {
    redirectToLogin();
    return;
  }

  window.__currentUser = me.user;
  document.documentElement.dataset.authed = 'true';

  // Inject a sign-out button into the toolbar if present.
  const toolbarRight = document.querySelector('#toolbar .toolbar-right');
  if (toolbarRight && !document.getElementById('sign-out-btn')) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-left:0.5rem;';

    const label = document.createElement('span');
    label.textContent = me.user.name || me.user.email;
    label.style.cssText = 'font-size:0.78rem;color:var(--text-muted);max-width:14ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    const btn = document.createElement('button');
    btn.id = 'sign-out-btn';
    btn.type = 'button';
    btn.className = 'clear-btn';
    btn.textContent = 'Sign out';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await authApi.logout(); } catch {}
      window.location.replace('/login.html');
    });

    wrap.appendChild(label);
    wrap.appendChild(btn);
    toolbarRight.appendChild(wrap);
  }
}

init();
