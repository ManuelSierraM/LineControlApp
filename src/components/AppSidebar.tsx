import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Upload, Wifi, Smartphone, MapPin, AlertTriangle, FileBarChart, LogOut, BarChart3, Shield,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useRoles } from "@/lib/roles";
import { ThemeToggle } from "@/components/ThemeToggle";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Cargar Archivos", url: "/cargar", icon: Upload },
  { title: "Maestro Líneas", url: "/lineas", icon: Wifi },
  { title: "Dispositivos UEM", url: "/dispositivos", icon: Smartphone },
  { title: "Inventario POPS", url: "/pops", icon: MapPin },
  { title: "Alertas", url: "/alertas", icon: AlertTriangle },
  { title: "Reportes", url: "/reportes", icon: FileBarChart },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, user } = useAuth();
  const { isAdmin, roles } = useRoles();
  const navItems = isAdmin ? [...items, { title: "Administración", url: "/admin", icon: Shield }] : items;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-md">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-base font-semibold text-sidebar-foreground">LineControl</span>
              <span className="text-xs text-sidebar-foreground/60">Gestión Corporativa</span>
            </div>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((it) => {
                const active = path === it.url;
                return (
                  <SidebarMenuItem key={it.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={it.title}>
                      <Link to={it.url} className="flex items-center gap-3">
                        <it.icon className="h-4 w-4" />
                        <span>{it.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex flex-col gap-2 group-data-[collapsible=icon]:hidden">
          <span className="truncate text-xs text-sidebar-foreground/60">{user?.email}</span>
          <span className="text-[10px] uppercase text-sidebar-foreground/50">{roles.join(", ") || "sin rol"}</span>
          <span className="text-[10px] text-sidebar-foreground/40">v1.0.0 — Control de Líneas</span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Cerrar sesión">
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
