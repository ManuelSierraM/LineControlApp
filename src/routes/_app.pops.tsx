import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAll } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/pops")({ component: PopsPage });

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function normPhone(p?: string | null) {
  if (!p) return "";
  let s = String(p).replace(/[^\d]/g, "");
  if (!s) return "";
  if (s.startsWith("57") && s.length > 10) s = s.slice(2);
  return s;
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

function PopsPage() {
  const { data } = useQuery({
    queryKey: ["pops-maestro"],
    queryFn: async () => {
      const data = await fetchAll<any>("pops", { orderBy: { column: "created_at", ascending: false } });
      return dedupeBy(data ?? [], (p: any) => (p.codigo ? String(p.codigo) : null) || normPhone(p.numero_telefono) || (p.id ? String(p.id) : null));
    },
  });
  const rows = data ?? [];
  return (
    <div>
      <PageHeader title="Inventario POPS" subtitle={`${rows.length.toLocaleString("es-CO")} registros POPS`} />
      <div className="p-6">
        <DataTable
          title="Inventario POPS"
          rows={rows}
          searchKeys={["codigo", "ubicacion", "centro_costo", "numero_telefono", "modelo"]}
          columns={[
            { key: "imei", header: "IMEI", render: (r) => r.codigo ?? "—" },
            { key: "telefono", header: "Teléfono", render: (r) => r.numero_telefono ?? "—" },
            { key: "centro", header: "Centro", render: (r) => r.centro_costo ?? "—" },
            { key: "delegacion", header: "Delegación", render: (r) => r.ubicacion ?? "—" },
            { key: "fecha_alta", header: "Fecha Alta", render: (r) => fmtDate(r.fecha_alta ?? r.created_at) },
            { key: "fecha_baja", header: "Fecha Baja", render: (r) => fmtDate(r.fecha_baja) },
            { key: "modelo", header: "Modelo", render: (r) => r.modelo ?? "—" },
          ]}
        />
      </div>
    </div>
  );
}
