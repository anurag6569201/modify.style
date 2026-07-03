import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearTokens,
  fetchAuthProfile,
  getAccessToken,
  hasStoredSession,
  setTokens,
  type AuthUser,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (access: string, refresh: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }

    const profile = await fetchAuthProfile();
    if (!profile) {
      clearTokens();
      setUser(null);
      return;
    }

    setUser(profile);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!hasStoredSession()) {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      const profile = await fetchAuthProfile();
      if (cancelled) return;

      if (!profile) {
        clearTokens();
        setUser(null);
      } else {
        setUser(profile);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (access: string, refresh: string) => {
      setTokens(access, refresh);
      await refreshUser();
    },
    [refreshUser]
  );

  const signOut = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user && hasStoredSession(),
      isLoading,
      signIn,
      signOut,
      refreshUser,
    }),
    [user, isLoading, signIn, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
