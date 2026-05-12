import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authApi, getProvidersFromMe } from "../auth/authClient";
import type {
  AuthContextValue,
  AuthProviders,
  AuthUser,
} from "../types/auth.types";

const AuthContext = createContext<AuthContextValue | null>(null);

function syncAuthGlobals(user: AuthUser | null) {
  window.__currentUser = user || null;

  if (user) {
    document.documentElement.dataset.authed = "true";
    return;
  }

  delete document.documentElement.dataset.authed;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [providers, setProviders] = useState<AuthProviders>({
    google: false,
    microsoft: false,
  });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const response = await authApi.me();
      const nextUser = response?.user || null;
      setUser(nextUser);
      setProviders(getProvidersFromMe(response));
      syncAuthGlobals(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      setProviders({ google: false, microsoft: false });
      syncAuthGlobals(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(
    () => ({
      user,
      providers,
      loading,
      refresh,
      login: async (credentials) => {
        setLoading(true);
        const response = await authApi.login(credentials);
        const nextUser = response?.user || null;
        setUser(nextUser);
        syncAuthGlobals(nextUser);
        setLoading(false);
        return nextUser;
      },
      signup: async (payload) => {
        setLoading(true);
        const response = await authApi.signup(payload);
        const nextUser = response?.user || null;
        setUser(nextUser);
        syncAuthGlobals(nextUser);
        setLoading(false);
        return response;
      },
      verifySignup: async (payload) => {
        setLoading(true);
        const response = await authApi.verifySignup(payload);
        const nextUser = response?.user || null;
        setUser(nextUser);
        syncAuthGlobals(nextUser);
        setLoading(false);
        return nextUser;
      },
      resendSignupCode: async (payload) => {
        const response = await authApi.resendSignupCode(payload);
        return response;
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setUser(null);
          syncAuthGlobals(null);
        }
      },
    }),
    [loading, providers, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
