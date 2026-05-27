import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/pops")({ component: PopsPage });

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function PopsPage() {
  const { data } = useQuery({
    queryKey: ["pops-maestro"],
    queryFn: async () => {
      const { data } = await supabase.from("pops").select("*").order("created_at", { ascending: false }).limit(5000);
      return data ?? [];
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
          searchKeys={["codigo", "ubicacion", "centro_costo", "responsable"]}
          columns={[
            { key: "imei", header: "IMEI", render: (r) => r.codigo ?? "—" },
            { key: "telefono", header: "Teléfono", render: (r) => r.numero_telefono ?? "—" },
            { key: "centro", header: "Centro", render: (r) => r.centro_costo ?? "—" },
            { key: "delegacion", header: "Delegación", render: (r) => r.ubicacion ?? "—" },
            { key: "responsable", header: "Responsable", render: (r) => r.responsable ?? "—" },
            { key: "fecha_alta", header: "Fecha Alta", render: (r) => fmtDate(r.created_at) },
            { key: "fecha_baja", header: "Fecha Baja", render: () => "—" },
            { key: "modelo", header: "Modelo", render: () => "—" },
          ]}
        />
      </div>
    </div>
  );
}
