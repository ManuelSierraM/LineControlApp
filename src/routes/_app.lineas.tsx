import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAll } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { normalizePhone } from "@/lib/utils";

export const Route = createFileRoute("/_app/lineas")({ component: LineasPage });

function operador(msisdn?: string | null) {
  if (!msisdn) return "—";
  const s = normalizePhone(msisdn);
  if (!s) return "—";
  if (s.startsWith("300") || s.startsWith("301") || s.startsWith("302")) return "Tigo";
  if (s.startsWith("310") || s.startsWith("311") || s.startsWith("312") || s.startsWith("313") || s.startsWith("314")) return "Claro";
  if (s.startsWith("320") || s.startsWith("321") || s.startsWith("322")) return "Movistar";
  return "—";
}

function fmtMoney(n: number) {
  return `$ ${Number(n ?? 0).toLocaleString("es-CO")}`;
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

function LineasPage() {
  const { data } = useQuery({
    queryKey: ["lineas-maestro"],
    queryFn: async () => {
      const [lineas, disp] = await Promise.all([
        fetchAll<any>("lineas", { orderBy: { column: "created_at", ascending: false } }),
        fetchAll<any>("dispositivos", { columns: "imei,modelo,asignado_a,numero_telefono,created_at" }),
      ]);
      // Maestro: NO deduplicar por msisdn/imei normalizados — cada fila del cargue
      // es un registro válido; usamos id (único) para preservar la totalidad.
      const dispDedup = dedupeBy(disp ?? [], (d: any) => (d.id ? String(d.id) : null));
      const lineasDedup = dedupeBy(lineas ?? [], (l: any) => (l.id ? String(l.id) : null));
      const byImei = new Map<string, any>(dispDedup.filter((d) => d.imei).map((d) => [d.imei as string, d]));
      const dispByPhone = new Map<string, any>();
      for (const d of dispDedup) {
        const key = normPhone(d.numero_telefono);
        if (key && d.imei) dispByPhone.set(key, d);
      }
      return lineasDedup.map((l) => {
        const matched = dispByPhone.get(normPhone(l.msisdn));
        const imei = l.imei || matched?.imei || null;
        const d = (imei ? byImei.get(imei) : undefined) ?? matched;
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
            { key: "operador", header: "OPERADOR", render: (r) => r.operador ?? operador(r.msisdn) },
            { key: "tipo_de_linea", header: "TIPO_DE_LINEA", render: () => "VOZ+DATOS" },
            { key: "msisdn", header: "TELE_NUMB" },
            { key: "cliente", header: "NOMBRE_CLIENTE", render: (r) => r.cliente ?? "—" },
            { key: "cod_empresa", header: "Cod Empresa", render: (r) => r.cod_empresa ?? "—" },
            { key: "imei", header: "IMEI", render: (r) => r.imei ?? "—" },
            { key: "iccid", header: "ICCID", render: (r) => r.iccid ?? "—" },
            { key: "plan", header: "PLAN_DESC", render: (r) => r.plan ?? "—" },
            { key: "valor_cfm", header: "VALOR_CFM", accessor: (r) => Number(r.valor_plan ?? r.costo_mensual ?? 0), render: (r) => fmtMoney(Number(r.valor_plan ?? r.costo_mensual ?? 0)) },
          ]}
        />
      </div>
    </div>
  );
}
