// Full-page overlay shown when the current user hits a share link they don't
// have access to. Fetches /meta (owner's email + plan name) and lets the user
// submit an access request.

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export async function showRequestAccessOverlay(stateId, { savedStatesApi }) {
  // Hide everything else.
  document.getElementById('app')?.setAttribute('hidden', '');
  document.getElementById('subject-selection')?.setAttribute('hidden', '');

  const root = document.createElement('div');
  root.id = 'request-access-overlay';
  root.className = 'request-access';
  root.innerHTML = `
    <div class="request-access__card">
      <h1>Request access</h1>
      <div class="request-access__summary">Checking plan details…</div>
      <form class="request-access__form" hidden>
        <label>
          Role requested
          <select name="role">
            <option value="view" selected>View</option>
            <option value="edit">Edit</option>
          </select>
        </label>
        <label>
          Message (optional)
          <textarea name="message" rows="3" maxlength="500" placeholder="Why you need access"></textarea>
        </label>
        <div class="request-access__actions">
          <button type="submit">Send request</button>
          <a href="/" class="request-access__home">Go to my plans</a>
        </div>
      </form>
      <p class="request-access__status" role="status" aria-live="polite"></p>
    </div>`;
  document.body.append(root);

  const summary = root.querySelector('.request-access__summary');
  const form = root.querySelector('.request-access__form');
  const status = root.querySelector('.request-access__status');

  // Fetch meta.
  let meta;
  try {
    meta = await savedStatesApi.meta(stateId);
  } catch (err) {
    if (err.status === 404) {
      summary.textContent = 'This plan no longer exists.';
    } else if (err.status === 401) {
      summary.innerHTML = `Please <a href="/login.html">sign in</a> to request access.`;
    } else {
      summary.textContent = `Could not load plan: ${err.message}`;
    }
    return;
  }

  summary.innerHTML = `
    You don't have access to <strong>${escapeHtml(meta.name)}</strong>,
    shared by <strong>${escapeHtml(meta.owner?.email || 'the owner')}</strong>.
    You can request access below.`;
  form.hidden = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const requestedRole = fd.get('role') || 'view';
    const message = (fd.get('message') || '').toString().trim();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    status.textContent = 'Sending…';
    try {
      await savedStatesApi.requestAccess(stateId, { requestedRole, message });
      status.textContent = `Request sent. You'll get access once ${escapeHtml(meta.owner?.email || 'the owner')} approves it.`;
      form.querySelectorAll('input, textarea, select, button').forEach((el) => { el.disabled = true; });
    } catch (err) {
      btn.disabled = false;
      status.textContent = err.message || 'Could not send request.';
    }
  });
}
