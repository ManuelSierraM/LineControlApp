import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Smartphone, Wifi, MapPin, AlertTriangle, FileText, DollarSign, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reportes")({ component: ReportesPage });

function fmtMoney(n: number) {
  return `$ ${Number(n ?? 0).toLocaleString("es-CO")}`;
}

function normPhone(p?: string | null) {
  if (!p) return "";
  let s = String(p).replace(/[^\d]/g, "");
  if (s.startsWith("57") && s.length > 10) s = s.slice(2);
  return s;
}


function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(",")),
  ].join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportesPage() {
  const { data } = useQuery({
    queryKey: ["reportes-data"],
    queryFn: async () => {
      const [{ data: lineas }, { data: disp }, { data: pops }, { data: alertas }] = await Promise.all([
        supabase.from("lineas").select("*").limit(10000),
        supabase.from("dispositivos").select("*").limit(10000),
        supabase.from("pops").select("*").limit(10000),
        supabase.from("alertas").select("*").limit(10000),
      ]);
      return { lineas: lineas ?? [], disp: disp ?? [], pops: pops ?? [], alertas: alertas ?? [] };
    },
  });

  const lineasRaw = data?.lineas ?? [];
  const disp = data?.disp ?? [];
  const pops = data?.pops ?? [];
  const alertas = data?.alertas ?? [];

  // Derivar IMEI por cruce de teléfono con POPS (consistente con Alertas / Maestro de Líneas)
  const popsByPhone = new Map<string, (typeof pops)[number]>();
  for (const p of pops) {
    const key = normPhone(p.numero_telefono);
    if (key) popsByPhone.set(key, p);
  }
  const lineas = lineasRaw.map((l) => {
    const pop = popsByPhone.get(normPhone(l.msisdn));
    return { ...l, imei: l.imei || pop?.codigo || null };
  });

  const hoy = Date.now();
  const costoTotal = lineas.reduce((s, l) => s + Number(l.costo_mensual ?? l.valor_plan ?? 0), 0);
  const sinUso = lineas.filter((l) => !l.ultimo_uso || (hoy - new Date(l.ultimo_uso).getTime()) / 86400000 > 30);
  const sinEquipo = lineas.filter((l) => !l.imei);
  // -> Manuel Sierra. posible uso a futuro: lineas con planes de datos caros cuyo uso o consumo es muy minimo y por ende no justifica el valor del plan
  // const sobredim = lineas.filter((l) => Number(l.costo_mensual ?? l.valor_plan ?? 0) > 50 && Number(l.consumo_mb ?? 0) < 100);
  const popsSC = pops.filter((p) => !p.centro_costo);
  const imeisLineas = new Set(lineas.map((l) => l.imei).filter(Boolean));
  const inconsist = disp.filter((d) => d.imei && !imeisLineas.has(d.imei));
  const centros = new Set(lineas.map((l) => l.centro_costo).filter(Boolean));

  const ahorroSinUso = sinUso.reduce((s, l) => s + Number(l.costo_mensual ?? l.valor_plan ?? 0), 0);
  const ahorroSinEq = sinEquipo.reduce((s, l) => s + Number(l.costo_mensual ?? l.valor_plan ?? 0), 0);
  // -> Manuel Sierra. posible uso a futuro: lineas con planes de datos caros cuyo uso o consumo es muy minimo y por ende no justifica el valor del plan
  // const ahorroSobre = sobredim.reduce((s, l) => s + Number(l.costo_mensual ?? l.valor_plan ?? 0) * 0.4, 0);
  const ahorroTotal = ahorroSinUso + ahorroSinEq; // + ahorroSobre


  const reportes = [
    { key: "sin_uso", icon: Smartphone, titulo: "Líneas sin uso (>30 días)", desc: `${sinUso.length.toLocaleString("es-CO")} equipos sin reporte`, ahorro: ahorroSinUso, rows: sinUso },
    { key: "sin_equipo", icon: Wifi, titulo: "Líneas sin equipo", desc: `${sinEquipo.length.toLocaleString("es-CO")} líneas activas sin dispositivo`, ahorro: ahorroSinEq, rows: sinEquipo },
    { key: "pops_sc", icon: MapPin, titulo: "POPS sin centro", desc: `${popsSC.length.toLocaleString("es-CO")} registros sin centro asignado`, ahorro: 0, rows: popsSC },
    // -> Manuel Sierra. posible uso a futuro: lineas con planes de datos caros cuyo uso o consumo es muy minimo y por ende no justifica el valor del plan
    // { key: "sobredim", icon: AlertTriangle, titulo: "Planes sobredimensionados", desc: `${sobredim.length.toLocaleString("es-CO")} planes innecesarios detectados`, ahorro: ahorroSobre, rows: sobredim },
    { key: "inconsist", icon: FileText, titulo: "Inconsistencias", desc: `${inconsist.length.toLocaleString("es-CO")} inconsistencias detectadas`, ahorro: 0, rows: inconsist },
    { key: "centros", icon: DollarSign, titulo: "Centros de Costo", desc: `${centros.size.toLocaleString("es-CO")} centros analizados`, ahorro: 0, rows: Array.from(centros).map((c) => ({ centro: c })) },
  ];

  const exportar = (titulo: string, rows: any[]) => {
    if (!rows.length) return toast.error("Sin datos para exportar");
    download(`${titulo.toLowerCase().replace(/\s+/g, "_")}.csv`, toCsv(rows));
    toast.success(`Exportado: ${titulo}`);
  };

  const descargarTodo = () => {
    const all = [
      ["lineas", lineas], ["dispositivos", disp], ["pops", pops], ["alertas", alertas],
    ] as const;
    for (const [name, rows] of all) {
      if (rows.length) download(`${name}.csv`, toCsv(rows));
    }
    toast.success("Reportes descargados");
  };

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Descarga reportes individuales o el consolidado completo"
        actions={<Button onClick={descargarTodo}><Download className="mr-2 h-4 w-4" /> Descargar Todo</Button>}
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiTop label="Costo Mensual" value={fmtMoney(costoTotal)} icon={DollarSign} />
          <KpiTop label="Ahorro Total" value={fmtMoney(ahorroTotal)} icon={DollarSign} tone="success" />
          <KpiTop label="Total Alertas" value={alertas.length.toLocaleString("es-CO")} icon={AlertCircle} tone="danger" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reportes.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.key} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{r.titulo}</h3>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{r.desc}</p>
                {r.ahorro > 0 && (
                  <p className="mt-1 text-sm font-medium text-success">Ahorro potencial: {fmtMoney(r.ahorro)}</p>
                )}
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  disabled={r.rows.length === 0}
                  onClick={() => exportar(r.titulo, r.rows)}
                >
                  <Download className="mr-2 h-4 w-4" /> Descargar CSV
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiTop({ label, value, icon: Icon, tone = "default" }: { label: string; value: string; icon: React.ElementType; tone?: "default" | "success" | "danger" }) {
  const surface = tone === "success" ? "bg-[var(--kpi-green)]" : tone === "danger" ? "bg-destructive/5" : "bg-card";
  const iconTone = tone === "success" ? "bg-success/15 text-success" : tone === "danger" ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary";
  return (
    <div className={`rounded-xl border border-border p-5 shadow-sm ${surface}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}
