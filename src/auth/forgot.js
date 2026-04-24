import { authApi, showMessage, clearMessage } from './authClient.js';

const form = document.getElementById('forgot-form');
const emailInput = document.getElementById('email');
const submitBtn = document.getElementById('submit-btn');
const messageEl = document.getElementById('message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage(messageEl);
  const email = emailInput.value.trim();
  if (!email) {
    showMessage(messageEl, 'Please enter your email address.', 'error');
    return;
  }
  submitBtn.disabled = true;
  try {
    await authApi.forgotPassword(email);
    showMessage(
      messageEl,
      'If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).',
      'success'
    );
  } catch (err) {
    showMessage(messageEl, err.message || 'Could not send reset email.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
