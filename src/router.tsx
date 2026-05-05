import React from "react";
import { Route, Routes } from "react-router-dom";
import App from "./App";
import { ForgotPasswordPage } from "./Pages/ForgotPassword.Page";
import { LoginPage } from "./Pages/Login.Page";
import { ResetPasswordPage } from "./Pages/ResetPassword.Page";
import { SignupPage } from "./Pages/Signup.Page";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<App />} />
    </Routes>
  );
}
