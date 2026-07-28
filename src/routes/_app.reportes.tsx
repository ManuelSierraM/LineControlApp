import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Smartphone, Wifi, MapPin, AlertTriangle, FileText, DollarSign, AlertCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reportes")({ component: ReportesPage });

function isCurrentMonth(d?: string | null) {
  if (!d) return false;
  const dt = new Date(d);
  const now = new Date();
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
}

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


// Deduplica registros por una clave estable, conservando el más reciente por created_at.
// Los cargues repetidos suelen traer los mismos datos; nos quedamos con la versión más nueva.
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
      const [lineas, disp, pops, alertas, cargas] = await Promise.all([
        fetchAll<any>("lineas", { orderBy: { column: "created_at", ascending: false } }),
        fetchAll<any>("dispositivos", { orderBy: { column: "created_at", ascending: false } }),
        fetchAll<any>("pops", { orderBy: { column: "created_at", ascending: false } }),
        fetchAll<any>("alertas", { orderBy: { column: "created_at", ascending: false } }),
        fetchAll<any>("archivos_carga", { columns: "tipo, created_at", orderBy: { column: "created_at", ascending: false } }),
      ]);
      return { lineas: lineas ?? [], disp: disp ?? [], pops: pops ?? [], alertas: alertas ?? [], cargas: cargas ?? [] };
    },
  });

  const lineasRaw = dedupeBy(data?.lineas ?? [], (l: any) => normPhone(l.msisdn) || (l.iccid ? String(l.iccid) : null) || (l.id ? String(l.id) : null));
  const disp = dedupeBy(data?.disp ?? [], (d: any) => (d.imei ? String(d.imei) : null) || normPhone(d.numero_telefono) || (d.id ? String(d.id) : null));
  const pops = dedupeBy(data?.pops ?? [], (p: any) => (p.codigo ? String(p.codigo) : null) || normPhone(p.numero_telefono) || (p.id ? String(p.id) : null));
  const alertas = dedupeBy(data?.alertas ?? [], (a: any) => [a.tipo, a.entidad ?? "", a.referencia ?? "", a.mensaje ?? ""].join("|"));
  const cargas = data?.cargas ?? [];

  // Cutoff = última carga por tipo; tomamos el mínimo entre los tipos presentes
  // para incluir alertas que dependen de los datasets más recientes de cada módulo.
  const lastByTipo = new Map<string, number>();
  for (const c of cargas) {
    const t = String(c.tipo ?? "");
    const ts = c.created_at ? new Date(c.created_at).getTime() : 0;
    if (!lastByTipo.has(t) || ts > (lastByTipo.get(t) ?? 0)) lastByTipo.set(t, ts);
  }
  const latestTs = Array.from(lastByTipo.values());
  const cutoff = latestTs.length ? Math.min(...latestTs) : 0;
  const alertasRecientes = cutoff
    ? alertas.filter((a) => a.created_at && new Date(a.created_at).getTime() >= cutoff)
    : alertas;

  // Lookups consistentes con Alertas
  const dispByPhone = new Map<string, (typeof disp)[number]>();
  for (const d of disp) {
    const key = normPhone(d.numero_telefono);
    if (key && d.imei) dispByPhone.set(key, d);
  }
  const popsByPhone = new Map<string, (typeof pops)[number]>();
  const popsByImei = new Map<string, (typeof pops)[number]>();
  for (const p of pops) {
    const key = normPhone(p.numero_telefono);
    if (key) popsByPhone.set(key, p);
    if (p.codigo) popsByImei.set(String(p.codigo), p);
  }

  // Enriquecimiento de líneas con IMEI resuelto (línea > UEM por tel > POPS por tel)
  const lineasEnriched = lineasRaw.map((l) => {
    const phone = normPhone(l.msisdn);
    const imei = l.imei || dispByPhone.get(phone)?.imei || popsByPhone.get(phone)?.codigo || null;
    return { ...l, imei };
  });
  const lineas = lineasEnriched;

  const costoTotal = lineas.reduce((s, l) => s + (Number(l.valor_plan ?? 0) || Number(l.costo_mensual ?? 0)), 0);

  // Sin uso: dispositivos UEM con ultimo_checkin > 30 días (igual que Alertas)
  const buildSinUso = (src: typeof disp) =>
    src
      .map((d) => {
        const dias = diffDays(d.ultimo_checkin);
        const phone = normPhone(d.numero_telefono);
        const ln = lineas.find((l) => normPhone(l.msisdn) === phone);
        const costo = Number(ln?.valor_plan ?? 0) || Number(ln?.costo_mensual ?? 0);
        return {
          imei: d.imei,
          msisdn: d.numero_telefono,
          modelo: d.modelo,
          dias,
          costo,
          created_at: d.created_at,
        };
      })
      .filter((r) => r.dias != null && r.dias > 30);

  const sinUso = buildSinUso(disp);
  const sinUsoMes = buildSinUso(disp.filter((d) => isCurrentMonth(d.created_at)));

  // Sin equipo: líneas sin IMEI tras enriquecimiento (igual que Alertas)
  const sinEquipo = lineas.filter((l) => !l.imei);
  const sinEquipoMes = sinEquipo.filter((l) => isCurrentMonth(l.created_at));

  // POPS sin centro (igual que Alertas)
  const popsSC = pops.filter((p) => !p.centro_costo);
  const popsSCMes = popsSC.filter((p) => isCurrentMonth(p.created_at));

  // Inconsistencias: dispositivos (UEM/POPS) con IMEI pero sin teléfono válido (igual que Alertas)
  const buildInconsist = (srcDisp: typeof disp, srcPops: typeof pops) => {
    const ui = srcDisp
      .filter((d) => d.imei && !normPhone(d.numero_telefono))
      .map((d) => ({ imei: d.imei, modelo: d.modelo, fuente: "UEM", created_at: d.created_at }));
    const ids = new Set(ui.map((d) => d.imei));
    const pi = srcPops
      .filter((p) => p.codigo && !ids.has(p.codigo) && !normPhone(p.numero_telefono))
      .map((p) => ({ imei: p.codigo, modelo: p.modelo, fuente: "POPS", created_at: p.created_at }));
    return [...ui, ...pi];
  };
  const inconsist = buildInconsist(disp, pops);
  const inconsistMes = buildInconsist(
    disp.filter((d) => isCurrentMonth(d.created_at)),
    pops.filter((p) => isCurrentMonth(p.created_at)),
  );

  // Ahorros estimados sobre líneas con costo asociado
  const ahorroSinUso = sinUso.reduce((s, r) => s + r.costo, 0);
  const ahorroSinEq = sinEquipo.reduce((s, l) => s + (Number(l.valor_plan ?? 0) || Number(l.costo_mensual ?? 0)), 0);
  const ahorroTotal = ahorroSinUso + ahorroSinEq;
  const alertasActuales = sinUso.length + sinEquipo.length + popsSC.length + inconsist.length;

  // HISTORICO ALERTAS = alertas guardadas en cargues ANTERIORES al último.
  // El último lote se detecta agrupando las alertas cuyo created_at cae dentro
  // de una ventana de 10 minutos respecto a la alerta más reciente (una
  // regeneración inserta todas sus filas casi simultáneamente).
  const allAlertas = data?.alertas ?? [];
  const alertTs = allAlertas
    .map((a: any) => (a.created_at ? new Date(a.created_at).getTime() : 0))
    .filter((t: number) => t > 0);
  const maxAlertTs = alertTs.length ? Math.max(...alertTs) : 0;
  const LOTE_MS = 10 * 60 * 1000;
  const historicoAlertas = maxAlertTs
    ? allAlertas.filter((a: any) => {
        const t = a.created_at ? new Date(a.created_at).getTime() : 0;
        return t > 0 && t < maxAlertTs - LOTE_MS;
      }).length
    : 0;



  const reportes = [
    { key: "sin_uso", icon: Smartphone, titulo: "Líneas sin uso (>30 días)", desc: `${sinUso.length.toLocaleString("es-CO")} líneas sin reporte`, ahorro: ahorroSinUso, rows: sinUso, rowsMes: sinUsoMes, showAhorro: true },
    { key: "sin_equipo", icon: Wifi, titulo: "Líneas sin equipo", desc: `${sinEquipo.length.toLocaleString("es-CO")} líneas activas sin dispositivo`, ahorro: ahorroSinEq, rows: sinEquipo, rowsMes: sinEquipoMes, showAhorro: true },
    { key: "pops_sc", icon: MapPin, titulo: "POPS sin centro", desc: `${popsSC.length.toLocaleString("es-CO")} registros sin centro asignado`, ahorro: 0, rows: popsSC, rowsMes: popsSCMes },
    // -> Manuel Sierra. posible uso a futuro: lineas con planes de datos caros cuyo uso o consumo es muy minimo y por ende no justifica el valor del plan
    // { key: "sobredim", icon: AlertTriangle, titulo: "Planes sobredimensionados", desc: `${sobredim.length.toLocaleString("es-CO")} planes innecesarios detectados`, ahorro: ahorroSobre, rows: sobredim },
    { key: "inconsist", icon: FileText, titulo: "Inconsistencias", desc: `${inconsist.length.toLocaleString("es-CO")} inconsistencias detectadas`, ahorro: 0, rows: inconsist, rowsMes: inconsistMes },
  ];

  const exportar = (titulo: string, rows: any[], suffix: string) => {
    if (!rows.length) return toast.error("Sin datos para exportar");
    const base = titulo.toLowerCase().replace(/\s+/g, "_");
    download(`${base}_${suffix}.csv`, toCsv(rows));
    toast.success(`Exportado: ${titulo} (${suffix === "mes_actual" ? "mes actual" : "histórico"})`);
  };

  const descargarTodo = (modo: "mes" | "historico") => {
    const filt = <T extends { created_at?: string | null }>(rows: T[]) =>
      modo === "mes" ? rows.filter((r) => isCurrentMonth(r.created_at)) : rows;
    const all = [
      ["lineas", filt(lineas)],
      ["dispositivos", filt(disp)],
      ["pops", filt(pops)],
      ["alertas", filt(alertas)],
    ] as const;
    let any = false;
    const suffix = modo === "mes" ? "mes_actual" : "historico";
    for (const [name, rows] of all) {
      if (rows.length) { download(`${name}_${suffix}.csv`, toCsv(rows as any[])); any = true; }
    }
    if (!any) toast.error("Sin datos para exportar");
    else toast.success(`Reportes descargados (${modo === "mes" ? "mes actual" : "histórico"})`);
  };

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Descarga reportes individuales o el consolidado completo"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><Download className="mr-2 h-4 w-4" /> Descargar Todo <ChevronDown className="ml-2 h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => descargarTodo("mes")}>Mes actual</DropdownMenuItem>
              <DropdownMenuItem onClick={() => descargarTodo("historico")}>Histórico</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiTop label="Costo Mensual Líneas" value={fmtMoney(costoTotal)} icon={DollarSign} />
          <KpiTop label="Ahorro Total" value={fmtMoney(ahorroTotal)} icon={DollarSign} tone="success" />
          <KpiTop label="ALERTAS ACTUALES" value={alertasActuales.toLocaleString("es-CO")} icon={AlertCircle} tone="danger" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <KpiTop label="HISTORICO ALERTAS" value={historicoAlertas.toLocaleString("es-CO")} icon={AlertCircle} tone="danger" />
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
                {(r.showAhorro || r.ahorro > 0) && (
                  <p className={`mt-1 text-sm font-medium ${r.ahorro > 0 ? "text-success" : "text-muted-foreground"}`}>
                    Ahorro potencial: {fmtMoney(r.ahorro)}
                  </p>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="mt-4 w-full" disabled={r.rows.length === 0}>
                      <Download className="mr-2 h-4 w-4" /> Descargar CSV <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => exportar(r.titulo, r.rowsMes, "mes_actual")}>
                      Mes actual ({r.rowsMes.length.toLocaleString("es-CO")})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportar(r.titulo, r.rows, "historico")}>
                      Histórico ({r.rows.length.toLocaleString("es-CO")})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
