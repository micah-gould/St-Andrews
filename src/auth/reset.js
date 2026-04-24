import { authApi, showMessage, clearMessage } from './authClient.js';

const form = document.getElementById('reset-form');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirm');
const submitBtn = document.getElementById('submit-btn');
const messageEl = document.getElementById('message');

const params = new URLSearchParams(window.location.search);
const token = params.get('token');

if (!token) {
  showMessage(messageEl, 'This reset link is missing or invalid.', 'error');
  submitBtn.disabled = true;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage(messageEl);
  if (!token) return;

  const password = passwordInput.value;
  const confirm = confirmInput.value;
  if (password.length < 8) {
    showMessage(messageEl, 'Password must be at least 8 characters.', 'error');
    return;
  }
  if (password !== confirm) {
    showMessage(messageEl, 'Passwords do not match.', 'error');
    return;
  }

  submitBtn.disabled = true;
  try {
    await authApi.resetPassword({ token, password });
    window.location.replace('/login.html?reset=1');
  } catch (err) {
    showMessage(messageEl, err.message || 'Could not reset password.', 'error');
    submitBtn.disabled = false;
  }
});
