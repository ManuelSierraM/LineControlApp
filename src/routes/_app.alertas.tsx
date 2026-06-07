import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, Wifi, AlertTriangle, MapPin, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/alertas")({ component: AlertasPage });

type TabKey = "sin_uso" | "sin_equipo" | "sobredim" | "pops_sin_centro" | "inconsistencias";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "sin_uso", label: "Sin uso", icon: AlertCircle },
  { key: "sin_equipo", label: "Sin equipo", icon: Wifi },
  { key: "sobredim", label: "Sobredimensionado", icon: AlertTriangle },
  { key: "pops_sin_centro", label: "POPS sin centro", icon: MapPin },
  { key: "inconsistencias", label: "Inconsistencias", icon: Info },
];

function fmtMoney(n: number) {
  return `$ ${Number(n ?? 0).toLocaleString("es-CO")}`;
}

function diffDays(d?: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function AlertasPage() {
  const [tab, setTab] = useState<TabKey>("sin_uso");
  const { data } = useQuery({
    queryKey: ["alertas-cruzado"],
    queryFn: async () => {
      const [{ data: lineas }, { data: disp }, { data: pops }] = await Promise.all([
        supabase.from("lineas").select("*").limit(10000),
        supabase.from("dispositivos").select("*").limit(10000),
        supabase.from("pops").select("*").limit(10000),
      ]);
      return { lineas: lineas ?? [], disp: disp ?? [], pops: pops ?? [] };
    },
  });

  const lineas = data?.lineas ?? [];
  const disp = data?.disp ?? [];
  const pops = data?.pops ?? [];
  const byImei = new Map(disp.map((d) => [d.imei, d]));

  const sinUso = lineas
    .map((l) => ({ ...l, dias: diffDays(l.ultimo_uso), modelo: byImei.get(l.imei ?? "")?.modelo ?? "—", cliente: byImei.get(l.imei ?? "")?.asignado_a ?? "—" }))
    .filter((l) => l.dias == null || l.dias > 30);

  const sinEquipo = lineas.filter((l) => !l.imei).map((l) => ({ ...l, modelo: "—", cliente: "—" }));

  const sobredim = lineas
    .filter((l) => Number(l.costo_mensual ?? 0) > 50 && Number(l.consumo_mb ?? 0) < 100)
    .map((l) => ({ ...l, modelo: byImei.get(l.imei ?? "")?.modelo ?? "—" }));

  const popsSC = pops.filter((p) => !p.centro_costo);

  const imeisLineas = new Set(lineas.map((l) => l.imei).filter(Boolean));
  const inconsist = disp.filter((d) => d.imei && !imeisLineas.has(d.imei));

  const counts: Record<TabKey, number> = {
    sin_uso: sinUso.length,
    sin_equipo: sinEquipo.length,
    sobredim: sobredim.length,
    pops_sin_centro: popsSC.length,
    inconsistencias: inconsist.length,
  };

  const total = counts.sin_uso + counts.sin_equipo + counts.sobredim + counts.pops_sin_centro + counts.inconsistencias;

  return (
    <div>
      <PageHeader title="Alertas y Hallazgos" subtitle={`${total.toLocaleString("es-CO")} alertas detectadas en el análisis cruzado`} />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary"}`}
              >
                <Icon className="h-4 w-4" />
                {t.label} ({counts[t.key].toLocaleString("es-CO")})
              </button>
            );
          })}
        </div>

        {tab === "sin_uso" && (
          <DataTable
            title="Equipos sin uso >30 días"
            rows={sinUso}
            searchKeys={["msisdn", "imei", "modelo", "centro_costo"]}
            columns={[
              { key: "msisdn", header: "Número" },
              { key: "imei", header: "IMEI" },
              { key: "modelo", header: "Modelo" },
              { key: "dias", header: "Días sin uso", render: (r) => <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning-foreground">{r.dias ?? "—"} días</span> },
              { key: "costo", header: "Costo", render: (r) => fmtMoney(Number(r.costo_mensual ?? 0)) },
              { key: "cliente", header: "Cliente" },
              { key: "centro_costo", header: "Centro" },
            ]}
          />
        )}

        {tab === "sin_equipo" && (
          <DataTable
            title="Líneas activas sin dispositivo asociado"
            rows={sinEquipo}
            searchKeys={["msisdn", "plan", "centro_costo"]}
            columns={[
              { key: "msisdn", header: "Número" },
              { key: "plan", header: "Plan" },
              { key: "costo", header: "Costo", render: (r) => fmtMoney(Number(r.costo_mensual ?? 0)) },
              { key: "centro_costo", header: "Centro" },
              { key: "estado", header: "Estado" },
            ]}
          />
        )}

        {tab === "sobredim" && (
          <DataTable
            title="Planes sobredimensionados"
            rows={sobredim}
            searchKeys={["msisdn", "plan", "centro_costo"]}
            columns={[
              { key: "msisdn", header: "Número" },
              { key: "plan", header: "Plan" },
              { key: "costo", header: "Costo", render: (r) => fmtMoney(Number(r.costo_mensual ?? 0)) },
              { key: "consumo", header: "Consumo (MB)", render: (r) => Number(r.consumo_mb ?? 0).toLocaleString("es-CO") },
              { key: "centro_costo", header: "Centro" },
            ]}
          />
        )}

        {tab === "pops_sin_centro" && (
          <DataTable
            title="POPS sin centro de costo asignado"
            rows={popsSC}
            searchKeys={["codigo", "ubicacion", "modelo"]}
            columns={[
              { key: "codigo", header: "IMEI" },
              { key: "ubicacion", header: "Delegación" },
              { key: "modelo", header: "Modelo" },
              { key: "estado", header: "Estado" },
            ]}
          />
        )}

        {tab === "inconsistencias" && (
          <DataTable
            title="Dispositivos sin línea asociada"
            rows={inconsist}
            searchKeys={["imei", "modelo", "asignado_a"]}
            columns={[
              { key: "imei", header: "IMEI" },
              { key: "modelo", header: "Modelo" },
              { key: "estado", header: "Estado" },
              { key: "asignado_a", header: "Usuario" },
              { key: "ultimo_checkin", header: "Último check-in" },
            ]}
          />
        )}
      </div>
    </div>
  );
}
