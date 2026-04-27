import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import type { RouteGuardProps } from '../types/auth.types';

export function ProtectedRoute({ children }: RouteGuardProps) {
  const location = useLocation();
  const { loading, user } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
