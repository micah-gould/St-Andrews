import { authApi, renderOAuthButtons, showMessage, clearMessage } from './authClient.js';

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberInput = document.getElementById('remember');
const submitBtn = document.getElementById('submit-btn');
const messageEl = document.getElementById('message');
const oauthContainer = document.getElementById('oauth-buttons');

const params = new URLSearchParams(window.location.search);
if (params.get('error') === 'oauth') {
  showMessage(messageEl, 'Single sign-on failed. Please try again or use email/password.', 'error');
}
if (params.get('reset') === '1') {
  showMessage(messageEl, 'Password updated. You can sign in with your new password.', 'success');
}

// If already logged in, bounce to app.
authApi.me().then((res) => {
  renderOAuthButtons(oauthContainer, {
    providers: res.providers,
    remember: () => rememberInput.checked,
  });
  if (res.user) {
    window.location.replace('/');
  }
}).catch(() => {
  renderOAuthButtons(oauthContainer, {
    providers: { google: false, microsoft: false },
    remember: () => rememberInput.checked,
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage(messageEl);
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    showMessage(messageEl, 'Please enter your email and password.', 'error');
    return;
  }

  submitBtn.disabled = true;
  try {
    await authApi.login({ email, password, remember: rememberInput.checked });
    window.location.replace('/');
  } catch (err) {
    showMessage(messageEl, err.message || 'Could not sign in.', 'error');
    submitBtn.disabled = false;
  }
});
