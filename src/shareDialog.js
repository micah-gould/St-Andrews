// Share-management modal.
// Creates a modal on-demand inside document.body. Exposes openShareDialog({
//   savedStatesApi, state, currentUser, onChange }).
//
// Permissions reminders:
//   - Only owner + admin can see the Share button (main.js enforces).
//   - Only the owner can change roles, remove shares, resolve pending requests,
//     or transfer ownership. Admins can manage others' view/edit but not
//     other admins (server enforces; UI hides disallowed controls for clarity).

const ROLE_OPTIONS = ['view', 'edit', 'admin'];

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export async function openShareDialog({ savedStatesApi, state, currentUser, onChange }) {
  if (!state) return;
  const isOwner = state.role === 'owner' || state.isOwner;
  const isAdmin = state.role === 'admin';

  // Remove any previous instance.
  document.getElementById('share-dialog-backdrop')?.remove();

  const backdrop = el(`<div id="share-dialog-backdrop" class="share-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Share plan"></div>`);
  const dialog = el(`<div class="share-dialog"></div>`);
  backdrop.append(dialog);
  document.body.append(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  function renderLoading() {
    dialog.innerHTML = `
      <header class="share-dialog__header">
        <h2>Share "${escapeHtml(state.name)}"</h2>
        <button type="button" class="share-dialog__close" aria-label="Close">×</button>
      </header>
      <div class="share-dialog__body"><p>Loading…</p></div>`;
    dialog.querySelector('.share-dialog__close').onclick = close;
  }

  async function refresh() {
    renderLoading();
    let data;
    try {
      data = await savedStatesApi.listShares(state.id);
    } catch (err) {
      dialog.querySelector('.share-dialog__body').innerHTML = `<p class="share-error">${escapeHtml(err.message)}</p>`;
      return;
    }
    render(data);
  }

  function render(data) {
    const { shares = [], requests = [], owner } = data;
    const shareLink = window.location.href;

    dialog.innerHTML = `
      <header class="share-dialog__header">
        <h2>Share "${escapeHtml(state.name)}"</h2>
        <button type="button" class="share-dialog__close" aria-label="Close">×</button>
      </header>
      <div class="share-dialog__body">
        <section class="share-section">
          <label class="share-label">Share link</label>
          <div class="share-link-row">
            <input type="text" readonly value="${escapeHtml(shareLink)}" class="share-link-input" />
            <button type="button" class="share-copy-btn">Copy</button>
          </div>
          <p class="share-hint">Anyone with the link who has access will see this plan; others can request access.</p>
        </section>

        <section class="share-section">
          <label class="share-label">Owner</label>
          <div class="share-row share-row--owner">
            <span>${escapeHtml(owner?.email || '—')}</span>
            <span class="share-role-tag">owner</span>
          </div>
        </section>

        <section class="share-section">
          <label class="share-label">People with access</label>
          ${shares.length === 0 ? '<p class="share-hint">No one else has access yet.</p>' : ''}
          <ul class="share-list">
            ${shares.map((s) => `
              <li class="share-row" data-share-id="${escapeHtml(s.id)}">
                <span>${escapeHtml(s.user?.email || '(unknown)')}</span>
                ${isOwner || (isAdmin && s.role !== 'admin')
                  ? `<select class="share-role-select" data-share-id="${escapeHtml(s.id)}">
                      ${ROLE_OPTIONS.map((r) => `<option value="${r}"${r === s.role ? ' selected' : ''}>${r}</option>`).join('')}
                    </select>
                    <button type="button" class="share-remove-btn" data-share-id="${escapeHtml(s.id)}">Remove</button>`
                  : `<span class="share-role-tag">${escapeHtml(s.role)}</span>`}
              </li>
            `).join('')}
          </ul>
        </section>

        <section class="share-section">
          <label class="share-label" for="share-add-email">Invite by email</label>
          <form class="share-add-form">
            <input id="share-add-email" type="email" required placeholder="name@example.com" />
            <select id="share-add-role">
              ${ROLE_OPTIONS.map((r) => `<option value="${r}"${r === 'view' ? ' selected' : ''}>${r}</option>`).join('')}
            </select>
            <button type="submit">Invite</button>
          </form>
          <p class="share-hint">The person must already have an account.</p>
        </section>

        ${requests.length ? `
          <section class="share-section">
            <label class="share-label">Pending access requests</label>
            <ul class="share-list">
              ${requests.map((r) => `
                <li class="share-row" data-request-id="${escapeHtml(r.id)}">
                  <span>${escapeHtml(r.user?.email || '(unknown)')} <em>wants ${escapeHtml(r.requestedRole)}</em>${r.message ? `<div class="share-req-msg">"${escapeHtml(r.message)}"</div>` : ''}</span>
                  <select class="share-approve-role">
                    ${ROLE_OPTIONS.map((role) => `<option value="${role}"${role === r.requestedRole ? ' selected' : ''}>${role}</option>`).join('')}
                  </select>
                  <button type="button" class="share-approve-btn" data-request-id="${escapeHtml(r.id)}">Approve</button>
                  <button type="button" class="share-deny-btn" data-request-id="${escapeHtml(r.id)}">Deny</button>
                </li>
              `).join('')}
            </ul>
          </section>
        ` : ''}

        ${isOwner && shares.length ? `
          <section class="share-section share-section--danger">
            <label class="share-label">Transfer ownership</label>
            <p class="share-hint">The new owner must already have access. You will be demoted to admin.</p>
            <form class="share-transfer-form">
              <select id="share-transfer-target">
                ${shares.map((s) => `<option value="${escapeHtml(s.user?.id || '')}">${escapeHtml(s.user?.email || '')}</option>`).join('')}
              </select>
              <button type="submit" class="share-transfer-btn">Transfer ownership</button>
            </form>
          </section>
        ` : ''}
      </div>`;

    dialog.querySelector('.share-dialog__close').onclick = close;

    // Copy link
    dialog.querySelector('.share-copy-btn').onclick = async () => {
      try {
        await navigator.clipboard.writeText(shareLink);
        const b = dialog.querySelector('.share-copy-btn');
        const old = b.textContent;
        b.textContent = 'Copied!';
        setTimeout(() => { b.textContent = old; }, 1200);
      } catch { /* no-op */ }
    };

    // Role change
    dialog.querySelectorAll('.share-role-select').forEach((sel) => {
      let previous = sel.value;
      sel.addEventListener('change', async () => {
        const id = sel.dataset.shareId;
        const nextRole = sel.value;
        try {
          await savedStatesApi.addShare(state.id, { email: shares.find(s => s.id === id)?.user?.email, role: nextRole });
          previous = nextRole;
          await onChange?.();
          await refresh();
        } catch (err) {
          sel.value = previous;
          alert(err.message);
        }
      });
    });

    // Remove
    dialog.querySelectorAll('.share-remove-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this person\u2019s access?')) return;
        try {
          await savedStatesApi.removeShare(state.id, btn.dataset.shareId);
          await onChange?.();
          await refresh();
        } catch (err) { alert(err.message); }
      });
    });

    // Add
    const addForm = dialog.querySelector('.share-add-form');
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = dialog.querySelector('#share-add-email').value.trim();
      const role = dialog.querySelector('#share-add-role').value;
      if (!email) return;
      try {
        await savedStatesApi.addShare(state.id, { email, role });
        await onChange?.();
        await refresh();
      } catch (err) { alert(err.message); }
    });

    // Approve / deny
    dialog.querySelectorAll('.share-approve-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.requestId;
        const row = dialog.querySelector(`[data-request-id="${id}"]`);
        const role = row.querySelector('.share-approve-role').value;
        try {
          await savedStatesApi.resolveRequest(state.id, id, { action: 'approve', role });
          await onChange?.();
          await refresh();
        } catch (err) { alert(err.message); }
      });
    });
    dialog.querySelectorAll('.share-deny-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await savedStatesApi.resolveRequest(state.id, btn.dataset.requestId, { action: 'deny' });
          await onChange?.();
          await refresh();
        } catch (err) { alert(err.message); }
      });
    });

    // Transfer
    const xfer = dialog.querySelector('.share-transfer-form');
    if (xfer) {
      xfer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetId = dialog.querySelector('#share-transfer-target').value;
        if (!targetId) return;
        const email = shares.find((s) => s.user?.id === targetId)?.user?.email || 'this user';
        if (!confirm(`Transfer ownership to ${email}? You will become an admin.`)) return;
        try {
          await savedStatesApi.transfer(state.id, targetId);
          await onChange?.();
          close();
        } catch (err) { alert(err.message); }
      });
    }
  }

  await refresh();
}
