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

// Returns one of: 'owner' | 'admin' | 'edit' | 'view' | null
export function effectiveRole(state, userId, shares = state?.shares) {
  if (!userId || !state) return null;
  if (state.ownerId === userId) return "owner";
  const share = (shares || []).find((entry) => entry.userId === userId);
  return share?.role || null;
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
