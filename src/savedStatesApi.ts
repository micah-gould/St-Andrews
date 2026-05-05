// Client for the saved-states API.
// The old settings endpoints are gone; everything is under /api/saved-states.
// All requests send credentials so the session cookie is attached.

import type {
  ApiError,
  SavedStateBlob,
  SavedStateMeta,
  SavedStateRecord,
  SavedStateSharesResponse,
  SavedStateSlice,
  SavedStateVisibility,
} from "./types/saved-state.types";

const BASE = "/api/saved-states";

async function request(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<any> {
  const opts: RequestInit = {
    method,
    credentials: "include",
    headers: { Accept: "application/json" },
  };
  if (body !== undefined) {
    (opts.headers as Record<string, string>)["Content-Type"] =
      "application/json";
    opts.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, opts);
  let data = null;
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch {
      /* no body */
    }
  }
  if (!response.ok) {
    const err = new Error(
      data?.error || `Request failed (${response.status})`,
    ) as ApiError;
    err.status = response.status;
    err.data = data;
    err.code = data?.code;
    throw err;
  }
  return data;
}

export const savedStatesApi = {
  list: (): Promise<SavedStateRecord[]> => request("/"),
  get: (id: string): Promise<SavedStateRecord> =>
    request(`/${encodeURIComponent(id)}`),
  meta: (id: string): Promise<SavedStateMeta> =>
    request(`/${encodeURIComponent(id)}/meta`),
  create: ({ name, state }: { name: string; state: SavedStateBlob }) =>
    request("/", { method: "POST", body: { name, state } }),
  updateSlice: (
    id: string,
    {
      name,
      slice,
      state,
    }: {
      name?: string;
      slice?: Partial<SavedStateSlice> & {
        catalogId?: string;
        year?: string | null;
      };
      state?: SavedStateBlob;
    },
  ) =>
    request(`/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { name, slice, state },
    }),
  remove: (id: string) =>
    request(`/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listShares: (id: string): Promise<SavedStateSharesResponse> =>
    request(`/${encodeURIComponent(id)}/shares`),
  addShare: (
    id: string,
    {
      email,
      role,
      visibility,
    }: { email?: string; role: string; visibility?: SavedStateVisibility },
  ) =>
    request(`/${encodeURIComponent(id)}/shares`, {
      method: "POST",
      body: { email, role, visibility },
    }),
  removeShare: (id: string, shareId: string) =>
    request(
      `/${encodeURIComponent(id)}/shares/${encodeURIComponent(shareId)}`,
      { method: "DELETE" },
    ),
  transfer: (id: string, newOwnerId: string) =>
    request(`/${encodeURIComponent(id)}/transfer`, {
      method: "POST",
      body: { newOwnerId },
    }),
  requestAccess: (
    id: string,
    {
      requestedRole = "view",
      message = "",
    }: { requestedRole?: string; message?: string } = {},
  ) =>
    request(`/${encodeURIComponent(id)}/request-access`, {
      method: "POST",
      body: { requestedRole, message },
    }),
  resolveRequest: (
    id: string,
    requestId: string,
    { action, role }: { action?: string; role?: string } = {},
  ) =>
    request(
      `/${encodeURIComponent(id)}/requests/${encodeURIComponent(requestId)}`,
      {
        method: "POST",
        body: { action, role },
      },
    ),
};

// Helpers for the client state shape.
export function emptySavedState(): SavedStateBlob {
  return { version: 2, catalogs: {} };
}

export function getSliceFor(
  savedState: SavedStateBlob | null | undefined,
  catalogId: string | null,
  year: string | null,
): SavedStateSlice {
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
