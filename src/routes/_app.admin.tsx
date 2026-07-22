import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Shield, ShieldCheck, User as UserIcon, KeyRound, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRoles, type AppRole } from "@/lib/roles";
import { setUserActive } from "@/lib/user-admin.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export const Route = createFileRoute("/_app/admin")({ component: AdminPage });

type Profile = { id: string; email: string | null; full_name: string | null; created_at: string; active: boolean };
type RoleRow = { user_id: string; role: AppRole };

const ALL_ROLES: AppRole[] = ["admin", "supervisor", "operador"];

function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading: rolesLoading } = useRoles();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, AppRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Profile | null>(null);
  const setActive = useServerFn(setUserActive);

  const load = async () => {
    setLoading(true);
    const [{ data: profs }, { data: roles }] = await Promise.all([
      (supabase as any).from("profiles").select("id,email,full_name,created_at,active").order("created_at"),
      (supabase as any).from("user_roles").select("user_id,role"),
    ]);
    setProfiles((profs ?? []) as Profile[]);
    const m: Record<string, AppRole[]> = {};
    ((roles ?? []) as RoleRow[]).forEach((r) => {
      m[r.user_id] = [...(m[r.user_id] ?? []), r.role];
    });
    setRolesMap(m);
    setLoading(false);
  };


  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (rolesLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/" />;

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    setSavingId(userId + role);
    try {
      if (has) {
        // No permitir que el admin se quite a sí mismo el rol admin si es el único
        if (role === "admin" && userId === user?.id) {
          const admins = Object.entries(rolesMap).filter(([, rs]) => rs.includes("admin")).length;
          if (admins <= 1) { toast.error("No puedes quitarte el último rol de admin"); return; }
        }
        const { error } = await (supabase as any).from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
        toast.success(`Rol ${role} removido`);
      } else {
        const { error } = await (supabase as any).from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
        toast.success(`Rol ${role} asignado`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Error al actualizar rol");
    } finally {
      setSavingId(null);
    }
  };

  const sendRecovery = async (email: string | null) => {
    if (!email) return toast.error("Usuario sin email");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Enlace de recuperación enviado a ${email}`);
  };

  return (
    <>
      <PageHeader title="Administración de Usuarios" subtitle="Asigna roles a los usuarios del sistema" />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Usuarios y roles</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles actuales</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((p) => {
                      const userRoles = rolesMap[p.id] ?? [];
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                            {p.full_name || "—"}
                            {p.id === user?.id && <Badge variant="outline" className="ml-2 text-[10px]">tú</Badge>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {userRoles.length === 0 && <span className="text-xs text-muted-foreground">sin roles</span>}
                              {userRoles.map((r) => (
                                <Badge key={r} variant={r === "admin" ? "default" : r === "supervisor" ? "secondary" : "outline"}>
                                  {r === "admin" && <ShieldCheck className="mr-1 h-3 w-3" />}
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-2">
                              {ALL_ROLES.map((r) => {
                                const has = userRoles.includes(r);
                                const busy = savingId === p.id + r;
                                return (
                                  <Button
                                    key={r}
                                    size="sm"
                                    variant={has ? "default" : "outline"}
                                    disabled={busy}
                                    onClick={() => toggleRole(p.id, r, has)}
                                  >
                                    {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                    {has ? `Quitar ${r}` : `Asignar ${r}`}
                                  </Button>
                                );
                              })}
                              <Button size="sm" variant="secondary" onClick={() => sendRecovery(p.email)}>
                                <KeyRound className="mr-1 h-3 w-3" /> Enviar recuperación
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
