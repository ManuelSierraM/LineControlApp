import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/pops")({ component: PopsPage });

function PopsPage() {
  const { data } = useQuery({
    queryKey: ["pops"],
    queryFn: async () => {
      const { data } = await supabase.from("pops").select("*").order("created_at", { ascending: false }).limit(1000);
      return data ?? [];
    },
  });
  return (
    <div>
      <PageHeader title="Inventario POPS" subtitle="Puntos de presencia y ubicaciones" />
      <div className="p-6">
        <DataTable
          title="POPS"
          rows={data ?? []}
          searchKeys={["codigo", "ubicacion", "centro_costo", "responsable", "estado"]}
          columns={[
            { key: "codigo", header: "Código" },
            { key: "ubicacion", header: "Ubicación" },
            { key: "centro_costo", header: "Centro Costo" },
            { key: "responsable", header: "Responsable" },
            { key: "estado", header: "Estado" },
          ]}
        />
      </div>
    </div>
  );
}
