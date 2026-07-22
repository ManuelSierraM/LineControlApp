import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-logout when the current user is deactivated by an admin.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const check = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data && data.active === false) {
        await supabase.auth.signOut();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    };
    check();
    const iv = setInterval(check, 15000);
    const channel = supabase
      .channel(`profile-active-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { active?: boolean };
          if (row?.active === false) {
            supabase.auth.signOut().then(() => {
              if (typeof window !== "undefined") window.location.href = "/login";
            });
          }
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);


  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };
  const signUp: AuthCtx["signUp"] = async (email, password, full_name) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { full_name } },
    });
    return { error: error?.message ?? null };
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return <Ctx.Provider value={{ user, session, loading, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
