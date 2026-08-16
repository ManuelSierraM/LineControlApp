import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAll } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { normalizePhone } from "@/lib/utils";

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

function normPhone(p?: string | null) {
  return normalizePhone(p);
}

function dedupeBy<T extends { created_at?: string | null }>(rows: T[], keyFn: (r: T) => string | null | undefined): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    const prev = map.get(k);
    if (!prev) { map.set(k, r); continue; }
    const a = prev.created_at ? new Date(prev.created_at).getTime() : 0;
    const b = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (b >= a) map.set(k, r);
  }
  return Array.from(map.values());
}

function DispPage() {
  const { data } = useQuery({
    queryKey: ["dispositivos-maestro"],
    queryFn: async () => {
      const [disp, lineas] = await Promise.all([
        fetchAll<any>("dispositivos", { orderBy: { column: "created_at", ascending: false } }),
        fetchAll<any>("lineas", { columns: "imei,msisdn" }),
      ]);
      // Maestro: preservar totalidad; dedupe por id (único).
      const dispDedup = dedupeBy(disp ?? [], (d: any) => (d.id ? String(d.id) : null));
      const byImei = new Map((lineas ?? []).map((l: any) => [l.imei, l.msisdn]));
      return dispDedup.map((d) => ({ ...d, telefono: byImei.get(d.imei) ?? d.numero_telefono ?? "—" }));
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
