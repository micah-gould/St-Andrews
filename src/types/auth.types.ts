import type { ReactNode } from "react";

export type AuthProviderName = "google" | "microsoft";

export type AuthProviders = {
  google: boolean;
  microsoft: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
};

export type AuthResponse = {
  user: AuthUser | null;
  providers: AuthProviders;
};

export type LoginPayload = {
  email: string;
  password: string;
  remember: boolean;
};

export type SignupPayload = {
  name: string;
  email: string;
  password: string;
  remember: boolean;
};

export type ResetPasswordPayload = {
  token: string;
  password: string;
};

export type AuthMessage = {
  type: "error" | "success" | "info";
  text: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  providers: AuthProviders;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  login: (credentials: LoginPayload) => Promise<AuthUser | null>;
  signup: (payload: SignupPayload) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

export type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export type RouteGuardProps = {
  children?: ReactNode;
};

declare global {
  interface Window {
    __currentUser: AuthUser | null;
  }
}

export {};
