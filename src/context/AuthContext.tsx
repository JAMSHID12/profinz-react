import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { SESSION_EXPIRED_EVENT, tokenStore } from '../api/client';
import type { RoleCode, SessionUser } from '../types';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  /** True when the user holds at least one of the permissions. */
  can: (...permissions: string[]) => boolean;
  hasRole: (role: RoleCode) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * The session carries the user's enabled roles and effective permissions, computed by the
 * server from the database and the client configuration. The UI only uses them to decide
 * what to show; the API enforces the same rules on every request.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => tokenStore.getUser());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const current = await authApi.me();
    tokenStore.saveUser(current);
    setUser(current);
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    // Confirm the stored token is still valid (and permissions current) before showing the app.
    if (!tokenStore.getAccessToken()) {
      setLoading(false);
      return;
    }
    refreshSession()
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout, refreshSession]);

  const login = useCallback(async (username: string, password: string) => {
    const auth = await authApi.login(username, password);
    tokenStore.save(auth);
    setUser(auth.user);
    return auth.user;
  }, []);

  const can = useCallback(
    (...permissions: string[]) => (user ? permissions.some((code) => user.permissions.includes(code)) : false),
    [user],
  );

  const hasRole = useCallback((role: RoleCode) => (user ? user.roles.includes(role) : false), [user]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshSession, can, hasRole }),
    [user, loading, login, logout, refreshSession, can, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
