import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type Role = "admin" | "manager" | "caller";
type AppUser = { id: string; email?: string; user_metadata?: { name?: string } };
type AppSession = { user: AppUser };

interface AuthCtx {
  user: AppUser | null;
  session: AppSession | null;
  role: Role | null;
  profileName: string | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("convexUserId"),
  );
  const [session, setSession] = useState<AppSession | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const me = useQuery(api.crm.me, { userId: userId ?? undefined });
  const signInUser = useMutation(api.auth.signInUser);
  const signUpUser = useMutation(api.auth.signUpUser);
  const loading = userId !== null && me === undefined;

  useEffect(() => {
    if (me === undefined) return;
    if (!me) {
      setUser(null);
      setSession(null);
      setRole(null);
      setProfileName(null);
      return;
    }
    setUser(me.user);
    setSession({ user: me.user });
    setRole(me.role as Role);
    setProfileName(me.profileName);
  }, [me]);

  async function refreshRole() {
    setUserId((id) => id);
  }

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    try {
      const result = await signInUser({ email, password });
      window.localStorage.setItem("convexUserId", result.user.id);
      setUserId(result.user.id);
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Sign in failed" };
    }
  };

  const signUp: AuthCtx["signUp"] = async (email, password, name) => {
    try {
      const result = await signUpUser({ email, password, name });
      window.localStorage.setItem("convexUserId", result.user.id);
      setUserId(result.user.id);
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Sign up failed" };
    }
  };

  const signOut = async () => {
    window.localStorage.removeItem("convexUserId");
    setUserId(null);
    setUser(null);
    setSession(null);
    setRole(null);
    setProfileName(null);
  };

  return (
    <Ctx.Provider value={{
      user, session, role, profileName, loading,
      isAdmin: role === "admin",
      signIn, signUp, signOut, refreshRole,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
