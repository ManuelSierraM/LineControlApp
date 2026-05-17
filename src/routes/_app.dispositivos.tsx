import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/dispositivos")({ component: DispPage });

function diffDays(d?: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function DispPage() {
  const { data } = useQuery({
    queryKey: ["dispositivos-maestro"],
    queryFn: async () => {
      const [{ data: disp }, { data: lineas }] = await Promise.all([
        supabase.from("dispositivos").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("lineas").select("imei,msisdn").limit(10000),
      ]);
      const byImei = new Map((lineas ?? []).map((l) => [l.imei, l.msisdn]));
      return (disp ?? []).map((d) => ({ ...d, telefono: byImei.get(d.imei) ?? "—" }));
    },
  });
  const rows = data ?? [];
  return (
    <div>
      <PageHeader title="Dispositivos UEM" subtitle={`${rows.length.toLocaleString("es-CO")} dispositivos registrados`} />
      <div className="p-6">
        <DataTable
          title="Inventario de Dispositivos"
          rows={rows}
          searchKeys={["imei", "modelo", "estado", "asignado_a"]}
          columns={[
            { key: "imei", header: "IMEI" },
            { key: "modelo", header: "Modelo" },
            { key: "telefono", header: "Teléfono" },
            {
              key: "ultimo_checkin",
              header: "Último check-in",
              render: (r) => {
                const days = diffDays(r.ultimo_checkin);
                return (
                  <div className="flex items-center gap-2">
                    <span>{fmtDate(r.ultimo_checkin)}</span>
                    {days != null && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${days > 60 ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>
                        {days}d
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "estado",
              header: "Estado",
              render: (r) => {
                const e = String(r.estado ?? "").toLowerCase();
                const isLost = e.includes("lost") || e.includes("perd") || e.includes("baja");
                const cls = isLost ? "bg-warning/20 text-warning-foreground" : "bg-success/15 text-success";
                return <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${cls}`}>{r.estado ?? "ACTIVE"}</span>;
              },
            },
            { key: "pais", header: "País", render: () => "Colombia" },
            { key: "asignado_a", header: "Usuario", render: (r) => r.asignado_a ?? "—" },
          ]}
        />
      </div>
    </div>
  );
}
