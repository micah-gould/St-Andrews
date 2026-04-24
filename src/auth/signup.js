import { authApi, renderOAuthButtons, showMessage, clearMessage } from './authClient.js';

const form = document.getElementById('signup-form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberInput = document.getElementById('remember');
const submitBtn = document.getElementById('submit-btn');
const messageEl = document.getElementById('message');
const oauthContainer = document.getElementById('oauth-buttons');

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
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email) {
    showMessage(messageEl, 'Please enter an email address.', 'error');
    return;
  }
  if (password.length < 8) {
    showMessage(messageEl, 'Password must be at least 8 characters.', 'error');
    return;
  }

  submitBtn.disabled = true;
  try {
    await authApi.signup({ name, email, password, remember: rememberInput.checked });
    window.location.replace('/');
  } catch (err) {
    showMessage(messageEl, err.message || 'Could not create account.', 'error');
    submitBtn.disabled = false;
  }
});
