import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingDown, Wifi, Smartphone, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fetchAll } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/")({ component: Dashboard });

function fmtMoney(n: number) {
  return `$ ${Number(n ?? 0).toLocaleString("es-CO")}`;
}

function normPhone(p?: string | null) {
  if (!p) return "";
  const raw = String(p).trim();
  if (!raw) return "";
  if (/[a-zA-Z]/.test(raw)) return "";
  let s = raw.replace(/[^\d]/g, "");
  if (!s) return "";
  if (s.startsWith("57") && s.length > 10) s = s.slice(2);
  return s;
}

function diffDays(d?: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

// Dedupe consistente con Reportes/Alertas: conserva el registro más nuevo por clave estable.
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

// Prioridad de alertas: líneas primero, dispositivos después; luego severidad y recencia.
function alertPriority(a: any) {
  const entityRank = a.entidad === "linea" ? 0 : a.entidad === "dispositivo" ? 1 : 2;
  const severityRank = a.severidad === "alta" ? 0 : a.severidad === "media" ? 1 : 2;
  const time = a.created_at ? new Date(a.created_at).getTime() : 0;
  return { entityRank, severityRank, time };
}


function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [lineas, dispositivos, pops, alertas] = await Promise.all([
        fetchAll<any>("lineas"),
        fetchAll<any>("dispositivos"),
        fetchAll<any>("pops"),
        fetchAll<any>("alertas", { orderBy: { column: "created_at", ascending: false } }),
      ]);
      return {
        lineas: lineas ?? [],
        dispositivos: dispositivos ?? [],
        pops: pops ?? [],
        alertas: alertas ?? [],
      };
    },
  });

  // Dedupe (mismos criterios que Reportes)
  const lineasRaw = dedupeBy(data?.lineas ?? [], (l: any) => normPhone(l.msisdn) || (l.iccid ? String(l.iccid) : null) || (l.id ? String(l.id) : null));
  const disp = dedupeBy(data?.dispositivos ?? [], (d: any) => (d.imei ? String(d.imei) : null) || normPhone(d.numero_telefono) || (d.id ? String(d.id) : null));
  const pops = dedupeBy(data?.pops ?? [], (p: any) => (p.codigo ? String(p.codigo) : null) || normPhone(p.numero_telefono) || (p.id ? String(p.id) : null));
  const alertasAll = dedupeBy(data?.alertas ?? [], (a: any) => [a.tipo, a.entidad ?? "", a.referencia ?? "", a.mensaje ?? ""].join("|"))
    .sort((a, b) => {
      const pa = alertPriority(a);
      const pb = alertPriority(b);
      if (pa.entityRank !== pb.entityRank) return pa.entityRank - pb.entityRank;
      if (pa.severityRank !== pb.severityRank) return pa.severityRank - pb.severityRank;
      return pb.time - pa.time;
    });


  // Lookups por teléfono para resolver IMEI (UEM > POPS)
  const dispByPhone = new Map<string, (typeof disp)[number]>();
  for (const d of disp) {
    const key = normPhone(d.numero_telefono);
    if (key && d.imei) dispByPhone.set(key, d);
  }
  const popsByPhone = new Map<string, (typeof pops)[number]>();
  for (const p of pops) {
    const key = normPhone(p.numero_telefono);
    if (key) popsByPhone.set(key, p);
  }

  // Enriquecimiento de líneas con IMEI resuelto
  const lineas = lineasRaw.map((l) => {
    const phone = normPhone(l.msisdn);
    const imei = l.imei || dispByPhone.get(phone)?.imei || popsByPhone.get(phone)?.codigo || null;
    return { ...l, imei };
  });

  // Costos: usar VALOR_CFM (valor_plan) con fallback a costo_mensual, igual que Reportes/Maestro de líneas
  const costoLinea = (l: any) => Number(l.valor_plan ?? 0) || Number(l.costo_mensual ?? 0);
  const costoTotal = lineas.reduce((s, l) => s + costoLinea(l), 0);

  // Sin uso (>30d): dispositivos UEM con ultimo_checkin > 30 días (mismo criterio que Alertas)
  const sinUsoRows = disp
    .map((d) => {
      const dias = diffDays(d.ultimo_checkin);
      const phone = normPhone(d.numero_telefono);
      const ln = phone ? lineas.find((l) => normPhone(l.msisdn) === phone) : undefined;
      return { dias, phone, costo: ln ? costoLinea(ln) : 0 };
    })
    .filter((r) => r.dias != null && r.dias > 30);
  const sinUso30 = sinUsoRows.length;
  const sinUsoPhones = new Set(sinUsoRows.map((r) => r.phone).filter(Boolean));

  // Sin equipo: líneas sin IMEI tras enriquecimiento
  const sinEquipoRows = lineas.filter((l) => !l.imei);
  const sinEquipo = sinEquipoRows.length;

  // POPS sin centro
  const popsSinCC = pops.filter((p) => !p.centro_costo).length;

  // Sin línea asociada: dispositivos (UEM+POPS) con IMEI pero sin teléfono válido
  const uemIncon = disp.filter((d) => d.imei && !normPhone(d.numero_telefono));
  const uemIds = new Set(uemIncon.map((d) => d.imei));
  const popsIncon = pops.filter((p) => p.codigo && !uemIds.has(p.codigo) && !normPhone(p.numero_telefono));
  const inconsistencias = uemIncon.length + popsIncon.length;

  // IMEI duplicado: mismo IMEI repetido en el cargue de Dispositivos UEM (datos crudos)
  const imeiCount = new Map<string, number>();
  for (const d of data?.dispositivos ?? []) {
    const imei = d.imei ? String(d.imei).trim() : "";
    if (!imei) continue;
    imeiCount.set(imei, (imeiCount.get(imei) ?? 0) + 1);
  }
  const imeiDuplicados = Array.from(imeiCount.values()).filter((n) => n > 1).length;

  // Ahorros (mismos que Reportes)
  const ahorroSinUso = sinUsoRows.reduce((s, r) => s + r.costo, 0);
  const ahorroSinEquipo = sinEquipoRows.reduce((s, l) => s + costoLinea(l), 0);
  const ahorroTotal = ahorroSinUso + ahorroSinEquipo;

  const chartData = [
    { name: "Sin uso", valor: ahorroSinUso },
    { name: "Sin equipo", valor: ahorroSinEquipo },
  ];

  // Alertas de dispositivos (gráfico vertical): mismos criterios que la sección Alertas.
  // Cubre "Sin uso" (UEM >30d), "POPS sin centro", "Sin línea asociada" e "IMEI duplicado".
  const dispAlertData = [
    { name: "Sin uso", cantidad: sinUso30 },
    { name: "POPS sin centro", cantidad: popsSinCC },
    { name: "Sin línea asociada", cantidad: inconsistencias },
    { name: "IMEI duplicado", cantidad: imeiDuplicados },
  ].filter((d) => d.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);



  // Top líneas con mayor impacto económico (a partir de alertas: sin uso + sin equipo)
  // Se toma la línea asociada por teléfono normalizado y se calcula su costo mensual.
  const impactoMap = new Map<string, {
    msisdn: string;
    imei: string | null;
    plan: string;
    categoria: string;
    dias: number | null;
    centro_costo: string;
    costo: number;
    costoAnual: number;
  }>();

  // Sin uso: dispositivos UEM >30d sin check-in
  for (const r of sinUsoRows) {
    const ln = lineas.find((l) => normPhone(l.msisdn) === r.phone);
    const d = disp.find((x) => normPhone(x.numero_telefono) === r.phone);
    const pop = pops.find((p) => normPhone(p.numero_telefono) === r.phone);
    const key = r.phone || d?.imei || `sinuso-${impactoMap.size}`;
    if (impactoMap.has(key)) continue;
    const costo = r.costo;
    impactoMap.set(key, {
      msisdn: ln?.msisdn ?? d?.numero_telefono ?? pop?.numero_telefono ?? "—",
      imei: d?.imei ?? pop?.codigo ?? ln?.imei ?? null,
      plan: ln?.plan ?? "—",
      categoria: "Sin uso",
      dias: r.dias,
      centro_costo: ln?.centro_costo ?? pop?.centro_costo ?? "—",
      costo,
      costoAnual: costo * 12,
    });
  }

  // Sin equipo: líneas sin IMEI resuelto
  for (const l of sinEquipoRows) {
    const phone = normPhone(l.msisdn);
    const key = phone || `sinequipo-${impactoMap.size}`;
    if (impactoMap.has(key)) continue;
    const costo = costoLinea(l);
    impactoMap.set(key, {
      msisdn: l.msisdn ?? "—",
      imei: null,
      plan: l.plan ?? "—",
      categoria: "Sin equipo",
      dias: null,
      centro_costo: l.centro_costo ?? "—",
      costo,
      costoAnual: costo * 12,
    });
  }

  const topImpacto = Array.from(impactoMap.values())
    .filter((r) => r.costo > 0)
    .sort((a, b) => b.costo - a.costo);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Resumen ejecutivo del control de líneas y dispositivos corporativos" />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Costo Mensual Total" value={fmtMoney(costoTotal)} icon={DollarSign} />
          <KpiCard label="Ahorro Potencial" value={fmtMoney(ahorroTotal)} hint="Ahorro identificado" icon={TrendingDown} accent="success" />
          <KpiCard label="Total Líneas" value={lineas.length.toLocaleString("es-CO")} icon={Wifi} accent="info" />
          <KpiCard label="Total Dispositivos" value={disp.length.toLocaleString("es-CO")} icon={Smartphone} accent="info" />
        </div>

        <div className="flex flex-wrap gap-3">
          <BadgeStat tone="red" count={sinUso30} label="Sin uso >30d" />
          <BadgeStat tone="red" count={sinEquipo} label="Sin equipo" />
          <BadgeStat tone="blue" count={popsSinCC} label="POPS sin centro" />
          <BadgeStat tone="amber" count={inconsistencias} label="Sin línea asociada" />
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
            <h3 className="font-semibold">Alertas de Dispositivos</h3>
            <p className="text-xs text-muted-foreground">Cantidad de alertas por tipo sobre dispositivos</p>
            <div className="mt-4 h-72">
              {dispAlertData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin alertas de dispositivos</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dispAlertData} margin={{ left: 8, right: 20, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      allowDecimals={false}
                      tickFormatter={(v) => Number(v).toLocaleString("es-CO")}
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      width={60}
                    />
                    <Tooltip
                      formatter={(v: number) => [Number(v).toLocaleString("es-CO"), "Alertas"]}
                      contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                    />
                    <Bar dataKey="cantidad" fill="var(--color-chart-5)" radius={[6, 6, 0, 0]} maxBarSize={64} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        <DataTable
          title="Top Líneas con Mayor Impacto Económico"
          rows={topImpacto}
          columns={[
            { key: "msisdn", header: "Número" },
            { key: "imei", header: "IMEI", render: (r) => r.imei ?? "—" },
            { key: "modelo", header: "Modelo" },
            {
              key: "categoria",
              header: "Categoría",
              render: (r) => (
                <span className={`rounded-full px-2 py-0.5 text-xs ${r.categoria === "Sin uso" ? "bg-warning/20 text-warning-foreground" : "bg-destructive/15 text-destructive"}`}>
                  {r.categoria}
                </span>
              ),
            },
            { key: "dias", header: "Días sin uso", render: (r) => r.dias != null ? `${r.dias} días` : "—" },
            { key: "centro_costo", header: "Centro" },
            { key: "costo", header: "Costo mensual", render: (r) => fmtMoney(r.costo) },
            { key: "costoAnual", header: "Costo anualizado", render: (r) => fmtMoney(r.costoAnual) },
          ]}
          searchKeys={["msisdn", "imei", "modelo", "categoria", "centro_costo"]}
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
