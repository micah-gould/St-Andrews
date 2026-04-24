// Client for the saved-states API.
// The old settings endpoints are gone; everything is under /api/saved-states.
// All requests send credentials so the session cookie is attached.

const BASE = '/api/saved-states';

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
  const response = await fetch(`${BASE}${path}`, opts);
  let data = null;
  if (response.status !== 204) {
    try { data = await response.json(); } catch { /* no body */ }
  }
  if (!response.ok) {
    const err = new Error(data?.error || `Request failed (${response.status})`);
    err.status = response.status;
    err.data = data;
    err.code = data?.code;
    throw err;
  }
  return data;
}

export const savedStatesApi = {
  list: () => request('/'),
  get: (id) => request(`/${encodeURIComponent(id)}`),
  meta: (id) => request(`/${encodeURIComponent(id)}/meta`),
  create: ({ name, state }) => request('/', { method: 'POST', body: { name, state } }),
  updateSlice: (id, { name, slice, state }) =>
    request(`/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: { name, slice, state },
    }),
  remove: (id) => request(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listShares: (id) => request(`/${encodeURIComponent(id)}/shares`),
  addShare: (id, { email, role }) =>
    request(`/${encodeURIComponent(id)}/shares`, { method: 'POST', body: { email, role } }),
  removeShare: (id, shareId) =>
    request(`/${encodeURIComponent(id)}/shares/${encodeURIComponent(shareId)}`, { method: 'DELETE' }),
  transfer: (id, newOwnerId) =>
    request(`/${encodeURIComponent(id)}/transfer`, { method: 'POST', body: { newOwnerId } }),
  requestAccess: (id, { requestedRole = 'view', message = '' } = {}) =>
    request(`/${encodeURIComponent(id)}/request-access`, {
      method: 'POST',
      body: { requestedRole, message },
    }),
  resolveRequest: (id, requestId, { action, role } = {}) =>
    request(`/${encodeURIComponent(id)}/requests/${encodeURIComponent(requestId)}`, {
      method: 'POST',
      body: { action, role },
    }),
};

// Helpers for the client state shape.
export function emptySavedState() {
  return { version: 2, catalogs: {} };
}

export function getSliceFor(savedState, catalogId, year) {
  const slice = savedState?.catalogs?.[catalogId]?.[year];
  return slice
    ? {
        selected: [...(slice.selected || [])],
        passed: [...(slice.passed || [])],
        excluded: [...(slice.excluded || [])],
        hiddenLevels: [...(slice.hiddenLevels || [])],
      }
    : { selected: [], passed: [], excluded: [], hiddenLevels: [] };
}
