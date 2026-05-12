import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/dispositivos")({ component: DispPage });

function DispPage() {
  const { data } = useQuery({
    queryKey: ["dispositivos"],
    queryFn: async () => {
      const { data } = await supabase.from("dispositivos").select("*").order("created_at", { ascending: false }).limit(1000);
      return data ?? [];
    },
  });
  return (
    <div>
      <PageHeader title="Dispositivos UEM" subtitle="Inventario de dispositivos enrolados" />
      <div className="p-6">
        <DataTable
          title="Dispositivos"
          rows={data ?? []}
          searchKeys={["imei", "modelo", "fabricante", "so", "estado", "asignado_a"]}
          columns={[
            { key: "imei", header: "IMEI" },
            { key: "modelo", header: "Modelo" },
            { key: "fabricante", header: "Fabricante" },
            { key: "so", header: "SO" },
            { key: "estado", header: "Estado" },
            { key: "asignado_a", header: "Asignado a" },
            { key: "ultimo_checkin", header: "Último check-in" },
          ]}
        />
      </div>
    </div>
  );
}
