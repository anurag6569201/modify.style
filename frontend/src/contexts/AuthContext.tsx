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
  upgradePlan,
  type AuthUser,
  type Plan,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  plan: Plan;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (access: string, refresh: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
  /** Upgrade the current user's plan (placeholder for real checkout). */
  upgrade: (plan?: Plan) => Promise<void>;
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

  const upgrade = useCallback(
    async (plan: Plan = "pro") => {
      const newPlan = await upgradePlan(plan);
      setUser((prev) => (prev ? { ...prev, plan: newPlan } : prev));
    },
    []
  );

  const value = useMemo(
    () => ({
      user,
      plan: user?.plan ?? "free",
      isAuthenticated: !!user && hasStoredSession(),
      isLoading,
      signIn,
      signOut,
      refreshUser,
      upgrade,
    }),
    [user, isLoading, signIn, signOut, refreshUser, upgrade]
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
