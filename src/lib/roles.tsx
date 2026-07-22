import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "admin" | "supervisor" | "operador";

interface RolesCtx {
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isOperador: boolean;
  canViewAll: boolean; // admin || supervisor
  canUpload: boolean;  // all roles
  refresh: () => Promise<void>;
}

const Ctx = createContext<RolesCtx | null>(null);

export function RolesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (initial = false) => {
    if (!user) { setRoles([]); setLoading(false); return; }
    if (initial) setLoading(true);
    const { data } = await (supabase as any).from("user_roles").select("role").eq("user_id", user.id);
    const next = (data ?? []).map((r: any) => r.role as AppRole);
    setRoles((prev) => {
      if (prev.length === next.length && prev.every((r) => next.includes(r))) return prev;
      return next;
    });
    if (initial) setLoading(false);
  };

  useEffect(() => {
    load(true);
    if (!user?.id) return;
    const iv = setInterval(() => load(false), 15000);
    const channel = (supabase as any)
      .channel(`user-roles-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => { load(false); }
      )
      .subscribe();
    return () => {
      clearInterval(iv);
      (supabase as any).removeChannel(channel);
    };
    // eslint-disable-next-line
  }, [user?.id]);

  const isAdmin = roles.includes("admin");
  const isSupervisor = roles.includes("supervisor");
  const isOperador = roles.includes("operador");

  return (
    <Ctx.Provider value={{
      roles, loading,
      isAdmin, isSupervisor, isOperador,
      canViewAll: isAdmin || isSupervisor,
      canUpload: isAdmin || isSupervisor || isOperador,
      refresh: load,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRoles() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRoles outside RolesProvider");
  return v;
}
