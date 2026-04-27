import React from "react";
import { LogOut } from "lucide-react";
import type { AuthUser } from "../types/auth.types";

export function UserControls({
  user,
  signingOut,
  onSignOut,
}: {
  user: AuthUser | null;
  signingOut: boolean;
  onSignOut: () => void | Promise<void>;
}) {
  if (!user) {
    return null;
  }

  return (
    <div className="user-controls">
      <span className="user-label">{user.name || user.email}</span>
      <button
        className="clear-btn"
        id="sign-out-btn"
        type="button"
        disabled={signingOut}
        onClick={onSignOut}
      >
        <LogOut size={14} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
