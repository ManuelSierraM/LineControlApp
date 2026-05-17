import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/lineas")({ component: LineasPage });

function operador(msisdn?: string | null) {
  if (!msisdn) return "—";
  const s = String(msisdn);
  if (s.startsWith("57300") || s.startsWith("57301") || s.startsWith("57302")) return "Tigo";
  if (s.startsWith("57310") || s.startsWith("57311") || s.startsWith("57312") || s.startsWith("57313") || s.startsWith("57314")) return "Claro";
  if (s.startsWith("57320") || s.startsWith("57321") || s.startsWith("57322")) return "Movistar";
  return "—";
}

function fmtMoney(n: number) {
  return `$ ${Number(n ?? 0).toLocaleString("es-CO")}`;
}

function LineasPage() {
  const { data } = useQuery({
    queryKey: ["lineas-maestro"],
    queryFn: async () => {
      const [{ data: lineas }, { data: disp }] = await Promise.all([
        supabase.from("lineas").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("dispositivos").select("imei,modelo,asignado_a").limit(10000),
      ]);
      const byImei = new Map((disp ?? []).map((d) => [d.imei, d]));
      return (lineas ?? []).map((l) => ({
        ...l,
        modelo: byImei.get(l.imei ?? "")?.modelo ?? "—",
        cliente: byImei.get(l.imei ?? "")?.asignado_a ?? "—",
      }));
    },
  });
  const rows = data ?? [];
  return (
    <div>
      <PageHeader title="Maestro de Líneas" subtitle={`${rows.length.toLocaleString("es-CO")} líneas registradas`} />
      <div className="p-6">
        <DataTable
          title="Inventario de Líneas"
          rows={rows}
          searchKeys={["msisdn", "imei", "plan", "centro_costo", "modelo", "cliente"]}
          columns={[
            { key: "msisdn", header: "Número" },
            { key: "operador", header: "Operador", render: (r) => operador(r.msisdn) },
            { key: "tipo", header: "Tipo", render: () => "Móvil" },
            { key: "cliente", header: "Cliente", render: (r) => r.cliente ?? "—" },
            { key: "empresa", header: "Empresa", render: () => "Prosegur" },
            { key: "imei", header: "IMEI" },
            { key: "modelo", header: "Modelo" },
            { key: "plan", header: "Plan" },
            { key: "total", header: "Total", render: (r) => fmtMoney(Number(r.costo_mensual ?? 0)) },
            { key: "delegacion", header: "Delegación", render: (r) => r.centro_costo ?? "—" },
            { key: "centro_costo", header: "Centro Costo" },
          ]}
        />
      </div>
    </div>
  );
}
