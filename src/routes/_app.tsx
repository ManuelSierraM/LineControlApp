import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { Loader2, Moon, Sun, ShieldAlert } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppHeader() {
  const { resolved, toggle } = useTheme();
  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-3">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={resolved === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title={resolved === "dark" ? "Modo claro" : "Modo oscuro"}
        >
          {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  const noRoles = !rolesLoading && roles.length === 0;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {!noRoles && <AppSidebar />}
        <div className="flex flex-1 flex-col">
          {!noRoles && <AppHeader />}
          <main className="flex-1 overflow-auto">
            {noRoles ? (
              <div className="flex min-h-screen items-center justify-center px-4">
                <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <ShieldAlert className="h-7 w-7" />
                  </div>
                  <h1 className="mt-4 text-xl font-semibold text-foreground">Sin permisos activos</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tu cuenta no tiene roles asignados. Contacta a un administrador para restablecer tus permisos. Cuando se te asignen, esta pantalla se cerrará automáticamente.
                  </p>
                  <div className="mt-6 flex justify-center">
                    <Button variant="destructive" onClick={signOut}>Cerrar sesión</Button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">Sesión: {user.email}</p>
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
