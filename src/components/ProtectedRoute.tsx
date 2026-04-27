import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import type { RouteGuardProps } from "../types/auth.types";

export function ProtectedRoute({ children }: RouteGuardProps) {
  const location = useLocation();
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="route-loading-shell" role="status" aria-live="polite">
        <div className="route-loading-card">
          <div className="route-loading-mark">Modules</div>
          <div className="route-loading-text">Loading your planner...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children ?? <Outlet />;
}
