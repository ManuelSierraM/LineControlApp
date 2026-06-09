import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingDown, Wifi, Smartphone, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/")({ component: Dashboard });

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function normPhone(p?: string | null) {
  if (!p) return "";
  let s = String(p).replace(/[^\d]/g, "");
  if (s.startsWith("57") && s.length > 10) s = s.slice(2);
  return s;
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [lineas, dispositivos, pops, alertas] = await Promise.all([
        supabase.from("lineas").select("*"),
        supabase.from("dispositivos").select("*"),
        supabase.from("pops").select("*"),
        supabase.from("alertas").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      return {
        lineas: lineas.data ?? [],
        dispositivos: dispositivos.data ?? [],
        pops: pops.data ?? [],
        alertas: alertas.data ?? [],
      };
    },
  });

  const lineasRaw = data?.lineas ?? [];
  const dispositivos = data?.dispositivos ?? [];
  const pops = data?.pops ?? [];
  const alertas = data?.alertas ?? [];

  // Derive IMEI per línea cruzando POPS por número de teléfono (igual que Alertas / Maestro de Líneas)
  const popsByPhone = new Map<string, (typeof pops)[number]>();
  for (const p of pops) {
    const key = normPhone(p.numero_telefono);
    if (key) popsByPhone.set(key, p);
  }
  const lineas = lineasRaw.map((l) => {
    const pop = popsByPhone.get(normPhone(l.msisdn));
    return { ...l, imei: l.imei || pop?.codigo || null };
  });

  const costoTotal = lineas.reduce((s, l) => s + Number(l.costo_mensual ?? l.valor_plan ?? 0), 0);
  const hoy = Date.now();
  const sinUso30 = lineas.filter((l) => {
    if (!l.ultimo_uso) return true;
    return (hoy - new Date(l.ultimo_uso).getTime()) / (1000 * 60 * 60 * 24) > 30;
  }).length;
  const sinEquipo = lineas.filter((l) => !l.imei).length;
  const planSobre = lineas.filter((l) => Number(l.costo_mensual ?? l.valor_plan ?? 0) > 50 && Number(l.consumo_mb ?? 0) < 100).length;
  const imeisLineas = new Set(lineas.map((l) => l.imei).filter(Boolean));
  const inconsistencias = dispositivos.filter((d) => d.imei && !imeisLineas.has(d.imei)).length;
  const popsSinCC = pops.filter((p) => !p.centro_costo).length;
  const ahorroSinUso = lineas
    .filter((l) => !l.ultimo_uso || (hoy - new Date(l.ultimo_uso).getTime()) / 86400000 > 30)
    .reduce((s, l) => s + Number(l.costo_mensual ?? l.valor_plan ?? 0), 0);
  const ahorroSinEquipo = lineas.filter((l) => !l.imei).reduce((s, l) => s + Number(l.costo_mensual ?? l.valor_plan ?? 0), 0);
  const ahorroPlan = lineas
    .filter((l) => Number(l.costo_mensual ?? l.valor_plan ?? 0) > 50 && Number(l.consumo_mb ?? 0) < 100)
    .reduce((s, l) => s + Number(l.costo_mensual ?? l.valor_plan ?? 0) * 0.4, 0);
  const ahorroTotal = ahorroSinUso + ahorroSinEquipo + ahorroPlan;


  const chartData = [
    { name: "Sin uso", valor: ahorroSinUso },
    { name: "Sin equipo", valor: ahorroSinEquipo },
    { name: "Plan sobredim.", valor: ahorroPlan },
  ];

  const ccMap = new Map<string, { centro: string; lineas: number; costo: number; sinUso: number }>();
  for (const l of lineas) {
    const k = l.centro_costo || "(Sin centro)";
    const e = ccMap.get(k) ?? { centro: k, lineas: 0, costo: 0, sinUso: 0 };
    e.lineas += 1;
    e.costo += Number(l.costo_mensual ?? 0);
    if (!l.ultimo_uso || (hoy - new Date(l.ultimo_uso).getTime()) / 86400000 > 30) e.sinUso += 1;
    ccMap.set(k, e);
  }
  const topCC = Array.from(ccMap.values()).sort((a, b) => b.costo - a.costo).slice(0, 10);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Resumen ejecutivo del control de líneas y dispositivos corporativos" />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Costo Mensual Total" value={fmtMoney(costoTotal)} icon={DollarSign} />
          <KpiCard label="Ahorro Potencial" value={fmtMoney(ahorroTotal)} hint="Ahorro identificado" icon={TrendingDown} accent="success" />
          <KpiCard label="Total Líneas" value={lineas.length.toLocaleString("es-CO")} icon={Wifi} accent="info" />
          <KpiCard label="Total Dispositivos" value={dispositivos.length.toLocaleString("es-CO")} icon={Smartphone} accent="info" />
        </div>

        <div className="flex flex-wrap gap-3">
          <BadgeStat tone="red" count={sinUso30} label="Sin uso >30d" />
          <BadgeStat tone="red" count={sinEquipo} label="Sin equipo" />
          <BadgeStat tone="amber" count={planSobre} label="Plan sobredim." />
          <BadgeStat tone="blue" count={popsSinCC} label="POPS sin centro" />
          <BadgeStat tone="amber" count={inconsistencias} label="Inconsistencias" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-semibold">Ahorro Potencial por Categoría</h3>
            <p className="text-xs text-muted-foreground">Distribución del ahorro mensual identificado</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tickFormatter={(v) => fmtMoney(v as number)} stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="var(--color-muted-foreground)" fontSize={12} width={100} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="valor" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-semibold">Alertas Recientes</h3>
            <p className="text-xs text-muted-foreground">Top alertas más relevantes del análisis</p>
            <div className="mt-4 space-y-2">
              {alertas.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin alertas registradas</p>
              ) : (
                alertas.map((a) => {
                  const Icon = a.severidad === "alta" ? AlertCircle : a.severidad === "media" ? AlertTriangle : Info;
                  const tone = a.severidad === "alta" ? "bg-destructive/10 text-destructive" : a.severidad === "media" ? "bg-warning/15 text-warning-foreground" : "bg-info/10 text-info";
                  return (
                    <div key={a.id} className={`flex items-start gap-3 rounded-lg p-3 ${tone}`}>
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{a.mensaje}</p>
                        {a.detalle && <p className="truncate text-xs text-muted-foreground">{a.detalle}</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DataTable
          title="Top Centros de Costo Más Costosos"
          rows={topCC}
          columns={[
            { key: "centro", header: "Centro de Costo" },
            { key: "lineas", header: "Total Líneas" },
            { key: "costo", header: "Total Costo", render: (r) => fmtMoney(r.costo) },
            { key: "sinUso", header: "Líneas sin Uso" },
            { key: "pct", header: "% Sin Uso", render: (r) => r.lineas ? `${((r.sinUso / r.lineas) * 100).toFixed(1)}%` : "—" },
          ]}
          searchKeys={["centro"]}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label, value, hint, icon: Icon, accent = "default",
}: { label: string; value: string; hint?: string; icon: React.ElementType; accent?: "default" | "success" | "info" }) {
  const surface = accent === "success" ? "bg-[var(--kpi-green)]" : accent === "info" ? "bg-[var(--kpi-blue)]" : "bg-card";
  const iconTone = accent === "success" ? "bg-success/15 text-success" : accent === "info" ? "bg-info/15 text-info" : "bg-primary/10 text-primary";
  return (
    <div className={`rounded-xl border border-border p-5 shadow-sm ${surface}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function BadgeStat({ tone, count, label }: { tone: "red" | "amber" | "blue"; count: number; label: string }) {
  const map = {
    red: "bg-destructive/10 text-destructive border-destructive/20",
    amber: "bg-warning/15 text-foreground border-warning/30",
    blue: "bg-info/10 text-info border-info/20",
  } as const;
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${map[tone]}`}>
      <AlertCircle className="h-4 w-4" />
      <span className="font-bold">{count.toLocaleString("es-CO")}</span>
      <span className="text-foreground/80">{label}</span>
    </div>
  );
}
