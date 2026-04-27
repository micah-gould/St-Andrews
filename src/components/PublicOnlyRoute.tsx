import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getNextPath } from '../utils/authRedirect';
import type { RouteGuardProps } from '../types/auth.types';

export function PublicOnlyRoute({ children }: RouteGuardProps) {
  const location = useLocation();
  const { loading, user } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to={getNextPath(location.search)} replace />;
  }

  return children;
}
