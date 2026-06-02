"use client";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

import { api, clearTokens, hasToken, setTokens } from "@/lib/api";
import type { TokenPair, User } from "@/lib/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadUser = React.useCallback(async () => {
    if (!hasToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUser();
    const onAuth = () => loadUser();
    window.addEventListener("mel-auth", onAuth);
    return () => window.removeEventListener("mel-auth", onAuth);
  }, [loadUser]);

  const login = React.useCallback(async (email: string, password: string) => {
    const tokens = await api.postForm<TokenPair>("/auth/login", {
      username: email,
      password
    });
    setTokens(tokens.access_token, tokens.refresh_token);
    await loadUser();
  }, [loadUser]);

  const logout = React.useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value: AuthState = { user, loading, login, logout, refresh: loadUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Wrap pages that require an authenticated user. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !user) {
      const redirect = pathname && pathname !== "/login"
        ? `?next=${encodeURIComponent(pathname)}`
        : "";
      router.replace(`/login${redirect}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-ink-500">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
