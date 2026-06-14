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

  const load = async () => {
    if (!user) { setRoles([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any).from("user_roles").select("role").eq("user_id", user.id);
    setRoles((data ?? []).map((r: any) => r.role as AppRole));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

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
