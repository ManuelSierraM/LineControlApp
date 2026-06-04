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

function normPhone(p?: string | null) {
  if (!p) return "";
  let s = String(p).replace(/[^\d]/g, "");
  if (s.startsWith("57") && s.length > 10) s = s.slice(2);
  return s;
}

function LineasPage() {
  const { data } = useQuery({
    queryKey: ["lineas-maestro"],
    queryFn: async () => {
      const [{ data: lineas }, { data: disp }, { data: pops }] = await Promise.all([
        supabase.from("lineas").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("dispositivos").select("imei,modelo,asignado_a").limit(10000),
        supabase.from("pops").select("codigo,numero_telefono").limit(10000),
      ]);
      const byImei = new Map((disp ?? []).map((d) => [d.imei, d]));
      const popsByPhone = new Map<string, string>();
      for (const p of pops ?? []) {
        const key = normPhone(p.numero_telefono);
        if (key && p.codigo) popsByPhone.set(key, p.codigo);
      }
      return (lineas ?? []).map((l) => {
        const imei = l.imei || popsByPhone.get(normPhone(l.msisdn)) || null;
        const d = imei ? byImei.get(imei) : undefined;
        return {
          ...l,
          imei,
          modelo: d?.modelo ?? "—",
          cliente: l.nombre_cliente ?? d?.asignado_a ?? "—",
        };
      });
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
          searchKeys={["msisdn", "iccid", "plan", "cliente", "cod_empresa"]}
          columns={[
            { key: "operador", header: "OPERADOR", render: (r) => operador(r.msisdn) },
            { key: "tipo_de_linea", header: "TIPO_DE_LINEA", render: () => "VOZ+DATOS" },
            { key: "msisdn", header: "TELE_NUMB" },
            { key: "identificacion", header: "IDENTIFICACION", render: () => "—" },
            { key: "identificacion_mtr", header: "IDENTIFICACION_MTR", render: () => "—" },
            { key: "cliente", header: "NOMBRE_CLIENTE", render: (r) => r.cliente ?? "—" },
            { key: "cod_empresa", header: "Cod Empresa", render: (r) => r.cod_empresa ?? "—" },
            { key: "iccid", header: "ICCID", render: (r) => r.iccid ?? "—" },
            { key: "plan", header: "PLAN_DESC", render: (r) => r.plan ?? "—" },
            { key: "valor_cfm", header: "VALOR_CFM", render: (r) => fmtMoney(Number(r.valor_plan ?? r.costo_mensual ?? 0)) },
          ]}
        />
      </div>
    </div>
  );
}
