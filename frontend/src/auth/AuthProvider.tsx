import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { api, type PublicUser } from "@/api";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (input: {
    email: string;
    password: string;
    display_name: string;
    phone?: string;
  }) => Promise<PublicUser>;
  logout: () => Promise<void>;
  setUser: (u: PublicUser | null) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const me = await api.auth.me();
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await api.auth.tryRestoreSession();
      if (!cancelled) setUser(restored);
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.auth.login(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; display_name: string; phone?: string }) => {
      const u = await api.auth.register(input);
      setUser(u);
      return u;
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
