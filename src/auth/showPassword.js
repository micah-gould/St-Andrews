// Attaches show/hide toggles to password inputs.
// Usage: add [data-password-toggle] to the wrapping element and include a
// <button type="button" class="password-toggle"> inside it. Or call
// attachPasswordToggles() with no args to auto-wire everything on the page.

const SHOW_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;

const HIDE_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a21.8 21.8 0 0 1 5.06-6.06"/>
    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-3.17 4.19"/>
    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>`;

function wireOne(wrapper) {
  const input = wrapper.querySelector('input[type="password"], input[type="text"][data-password]');
  const button = wrapper.querySelector('.password-toggle');
  if (!input || !button || button.dataset.bound === '1') return;
  button.dataset.bound = '1';
  // Mark as a password-bearing input so later wires recognize it even while
  // its DOM type is "text".
  input.dataset.password = '1';

  const setState = (visible) => {
    input.type = visible ? 'text' : 'password';
    button.innerHTML = visible ? HIDE_ICON : SHOW_ICON;
    button.setAttribute('aria-pressed', visible ? 'true' : 'false');
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    button.title = visible ? 'Hide password' : 'Show password';
  };

  setState(false);
  button.addEventListener('click', (e) => {
    e.preventDefault();
    setState(input.type === 'password');
    input.focus({ preventScroll: true });
  });
}

export function attachPasswordToggles(root = document) {
  root.querySelectorAll('[data-password-toggle]').forEach(wireOne);
}

// Auto-run on import so pages only need to include this module once.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => attachPasswordToggles());
} else {
  attachPasswordToggles();
}
