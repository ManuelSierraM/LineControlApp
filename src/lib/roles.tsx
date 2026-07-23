import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
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
  // Marca si al menos una carga tuvo éxito. Evita mostrar la pantalla
  // "Sin permisos activos" cuando en realidad la primera petición falló
  // por problemas de red (roles=[] por error, no por revocación real).
  const hasLoadedOnce = useRef(false);
  // Evita spamear el toast de "sin conexión" en cada ciclo de polling.
  const offlineNotified = useRef(false);

  /**
   * Carga los roles del usuario autenticado.
   *
   * Cuando `initial === true` se muestra el spinner de carga inicial; en los
   * refreshes de fondo (polling / realtime) NO se activa `loading` para evitar
   * remontar la UI y producir saltos de scroll, especialmente en listados con
   * muchas filas (p. ej. Administración de Usuarios).
   *
   * Manejo de errores de red: si la petición falla (offline, timeout, etc.)
   * NO se sobreescribe `roles` con `[]` — mantener el último estado válido
   * evita que la pantalla bloqueante de "Sin permisos activos" se dispare
   * por una simple caída de internet. Se muestra un toast breve de aviso.
   */
  const load = async (initial = false) => {
    if (!user) { setRoles([]); setLoading(false); hasLoadedOnce.current = false; return; }
    if (initial) setLoading(true);
    const { data, error } = await (supabase as any).from("user_roles").select("role").eq("user_id", user.id);
    if (error) {
      if (!offlineNotified.current) {
        offlineNotified.current = true;
        toast.error("Sin conexión", {
          description: "No se pudieron verificar los permisos. Reintentando…",
          duration: 3000,
        });
        // Permite volver a notificar si el problema persiste tras un rato.
        setTimeout(() => { offlineNotified.current = false; }, 20000);
      }
      // Solo apagamos el loading inicial si ya hubo alguna carga previa exitosa;
      // en el primer intento fallido mantenemos el spinner hasta obtener datos.
      if (initial && hasLoadedOnce.current) setLoading(false);
      return;
    }
    const next = (data ?? []).map((r: any) => r.role as AppRole);
    hasLoadedOnce.current = true;
    offlineNotified.current = false;
    // Mantiene la referencia anterior si los roles no cambiaron, evitando
    // re-renderizados innecesarios en componentes que dependen de este estado.
    setRoles((prev) => {
      if (prev.length === next.length && prev.every((r) => next.includes(r))) return prev;
      return next;
    });
    if (initial) setLoading(false);
  };

  useEffect(() => {
    load(true);
    if (!user?.id) return;

    // ------------------------------------------------------------------
    // Polling de roles: ¿por qué existe este subproceso?
    // ------------------------------------------------------------------
    // El canal realtime de Supabase debería notificar cada cambio en la tabla
    // `user_roles`, pero en la práctica puede perder eventos por:
    //   • Reconexiones de red o cambios de pestaña (tab inactiva).
    //   • Límites de conexiones simultáneas de realtime.
    //   • Eventos que ocurren justo antes de que la suscripción se confirme.
    // Por eso usamos un polling de 15 segundos como salvaguarda: garantiza que,
    // si un administrador quita todos los roles a un usuario conectado, la
    // pantalla de "Sin permisos activos" se active incluso cuando realtime falle.
    // Es complementario, no sustituto, del canal realtime que se suscribe abajo.
    // ------------------------------------------------------------------
    const iv = setInterval(() => load(false), 15000);

    // Canal realtime: intenta reflejar los cambios de roles en tiempo real.
    // Actúa como primera línea de detección; el polling cubre los huecos.
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
