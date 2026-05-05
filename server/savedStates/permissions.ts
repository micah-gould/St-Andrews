// Role hierarchy for saved states.
// "owner" is implicit (SavedState.ownerId === user.id) and beats everything.

export const ROLES = Object.freeze(["view", "edit", "admin"]);
export const ROLE_RANK = Object.freeze({
  view: 1,
  edit: 2,
  admin: 3,
  owner: 4,
});

export function isValidRole(role) {
  return ROLES.includes(role);
}

function getVisibility(state) {
  if (!state) return "private";
  if (state.visibility === "link" || state.visibility === "public") {
    return state.visibility;
  }
  if (typeof state.stateJson === "string") {
    try {
      const parsed = JSON.parse(state.stateJson);
      if (parsed?.visibility === "link" || parsed?.visibility === "public") {
        return parsed.visibility;
      }
    } catch {
      return "private";
    }
  }
  return "private";
}

// Returns one of: 'owner' | 'admin' | 'edit' | 'view' | null
export function effectiveRole(state, userId, shares = state?.shares) {
  if (!state) return null;
  const visibility = getVisibility(state);
  if (!userId) {
    if (visibility === "link" || visibility === "public") return "view";
    return null;
  }
  if (state.ownerId === userId) return "owner";
  const share = (shares || []).find((entry) => entry.userId === userId);
  if (share?.role) return share.role;
  if (visibility === "link" || visibility === "public") return "view";
  return null;
}

export function hasAtLeast(role, required) {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export function canView(role) {
  return hasAtLeast(role, "view");
}
export function canEdit(role) {
  return hasAtLeast(role, "edit");
}
export function canDelete(role) {
  return role === "admin" || role === "owner";
}
export function canManageShares(role) {
  return role === "admin" || role === "owner";
}
export function canTransferOwner(role) {
  return role === "owner";
}
