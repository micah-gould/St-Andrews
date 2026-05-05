import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./providers/AuthProvider";
import { AppRouter } from "./router";
import "./style.css";
import "./auth/auth.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense
          fallback={
            <div className="route-loading-shell">
              <div className="route-loading-card">
                <div className="route-loading-mark">Modules</div>
                <div className="route-loading-text">Loading...</div>
              </div>
            </div>
          }
        >
          <AppRouter />
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
