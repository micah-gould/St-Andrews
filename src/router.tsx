import React from 'react';
import { Route, Routes } from 'react-router-dom';
import App from './App';
import { ForgotPasswordPage } from './Pages/ForgotPassword.Page';
import { LoginPage } from './Pages/Login.Page';
import { ResetPasswordPage } from './Pages/ResetPassword.Page';
import { SignupPage } from './Pages/Signup.Page';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        )}
      />
      <Route
        path="/signup"
        element={(
          <PublicOnlyRoute>
            <SignupPage />
          </PublicOnlyRoute>
        )}
      />
      <Route
        path="/forgot-password"
        element={(
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        )}
      />
      <Route
        path="/reset-password"
        element={(
          <PublicOnlyRoute>
            <ResetPasswordPage />
          </PublicOnlyRoute>
        )}
      />
      <Route
        path="*"
        element={(
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        )}
      />
    </Routes>
  );
}
