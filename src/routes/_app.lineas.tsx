import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/lineas")({ component: LineasPage });

function LineasPage() {
  const { data } = useQuery({
    queryKey: ["lineas"],
    queryFn: async () => {
      const { data } = await supabase.from("lineas").select("*").order("created_at", { ascending: false }).limit(1000);
      return data ?? [];
    },
  });
  return (
    <div>
      <PageHeader title="Maestro de Líneas" subtitle="Listado de líneas móviles corporativas" />
      <div className="p-6">
        <DataTable
          title="Líneas"
          rows={data ?? []}
          searchKeys={["msisdn", "imei", "plan", "centro_costo", "estado"]}
          columns={[
            { key: "msisdn", header: "MSISDN" },
            { key: "imei", header: "IMEI" },
            { key: "plan", header: "Plan" },
            { key: "costo_mensual", header: "Costo", render: (r) => `$ ${Number(r.costo_mensual ?? 0).toLocaleString("es-CO")}` },
            { key: "centro_costo", header: "Centro Costo" },
            { key: "estado", header: "Estado", render: (r) => <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">{r.estado ?? "—"}</span> },
            { key: "ultimo_uso", header: "Último uso" },
          ]}
        />
      </div>
    </div>
  );
}
