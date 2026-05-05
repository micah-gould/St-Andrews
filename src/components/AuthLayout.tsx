import React from "react";
import type { AuthLayoutProps } from "../types/auth.types";

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <h1>St Andrews Modules</h1>
          <p>University of St Andrews planner</p>
        </div>
        <h2>{title}</h2>
        <p className="subtitle">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
