import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, Wifi, AlertTriangle, MapPin, Info, Copy, PhoneOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_app/alertas")({ component: AlertasPage });


type TabKey = "sin_uso" | "sin_equipo" | "sobredim" | "pops_sin_centro" | "inconsistencias" | "imei_duplicado" | "pops_tel_invalido";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "sin_uso", label: "Sin uso", icon: AlertCircle },
  { key: "sin_equipo", label: "Sin equipo", icon: Wifi },
  // { key: "sobredim", label: "Sobredimensionado", icon: AlertTriangle }, -> Manuel Sierra. posible uso a futuro: lineas con planes de datos caros cuyo uso o consumo es muy minimo y por ende no justifica el valor del plan
  { key: "pops_sin_centro", label: "POPS sin centro", icon: MapPin },
  { key: "inconsistencias", label: "Sin línea asociada", icon: Info },
  { key: "imei_duplicado", label: "IMEI duplicado", icon: Copy },
  { key: "pops_tel_invalido", label: "Líneas POPS Inconsistentes", icon: PhoneOff },
];


function fmtMoney(n: number) {
  return `$ ${Number(n ?? 0).toLocaleString("es-CO")}`;
}

function diffDays(d?: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
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

function AlertasPage() {
  const [tab, setTab] = useState<TabKey>("sin_uso");


  const { data } = useQuery({
    queryKey: ["alertas-cruzado"],
    queryFn: async () => {
      const [lineas, disp, pops] = await Promise.all([
        fetchAll<any>("lineas", { orderBy: { column: "created_at", ascending: false } }),
        fetchAll<any>("dispositivos", { orderBy: { column: "created_at", ascending: false } }),
        fetchAll<any>("pops", { orderBy: { column: "created_at", ascending: false } }),
      ]);
      return { lineas: lineas ?? [], disp: disp ?? [], pops: pops ?? [] };
    },
  });

  const lineas = dedupeBy(data?.lineas ?? [], (l: any) => normPhone(l.msisdn) || (l.iccid ? String(l.iccid) : null) || (l.id ? String(l.id) : null));
  const disp = dedupeBy(data?.disp ?? [], (d: any) => (d.imei ? String(d.imei) : null) || normPhone(d.numero_telefono) || (d.id ? String(d.id) : null));
  const pops = dedupeBy(data?.pops ?? [], (p: any) => (p.codigo ? String(p.codigo) : null) || normPhone(p.numero_telefono) || (p.id ? String(p.id) : null));

  // Lookups
  const dispByImei = new Map(disp.map((d) => [d.imei, d]));
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
  const lineaByPhone = new Map<string, (typeof lineas)[number]>();
  for (const l of lineas) {
    const key = normPhone(l.msisdn);
    if (key) lineaByPhone.set(key, l);
  }

  // Derive IMEI per línea: prefer línea.imei, fall back to UEM device por teléfono, luego POP código por teléfono
  const lineasEnriched = lineas.map((l) => {
    const phone = normPhone(l.msisdn);
    const dByPhone = dispByPhone.get(phone);
    const pop = popsByPhone.get(phone);
    const imei = l.imei || dByPhone?.imei || pop?.codigo || null;
    const d = (imei ? dispByImei.get(imei) : undefined) ?? dByPhone;
    return {
      ...l,
      imei,
      modelo: d?.modelo ?? pop?.modelo ?? "—",
      cliente: l.nombre_cliente ?? d?.asignado_a ?? "—",
      centro_costo: l.centro_costo ?? pop?.centro_costo ?? "—",
    };
  });

  // "Sin uso" se basa en el último check-in del dispositivo UEM (>30 días)
  const sinUso = disp
    .map((d) => {
      const pop = d.imei ? popsByImei.get(String(d.imei)) : undefined;
      const linea =
        lineaByPhone.get(normPhone(pop?.numero_telefono)) ??
        lineaByPhone.get(normPhone(d.numero_telefono));
      return {
        imei: d.imei,
        msisdn: pop?.numero_telefono ?? linea?.msisdn ?? d.numero_telefono ?? "—",
        modelo: d.modelo ?? pop?.modelo ?? "—",
        cliente: linea?.nombre_cliente ?? "—",
        centro_costo: pop?.centro_costo ?? linea?.centro_costo ?? "—",
        dias: diffDays(d.ultimo_checkin),
      };
    })
    .filter((r) => r.dias != null && r.dias > 30)
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));

  const sinEquipo = lineasEnriched.filter((l) => !l.imei);

  const sobredim = lineasEnriched.filter(
    (l) => Number(l.costo_mensual ?? l.valor_plan ?? 0) > 50 && Number(l.consumo_mb ?? 0) < 100,
  );

  const popsSC = pops.filter((p) => !p.centro_costo);

  // "Inconsistencias": dispositivos (UEM/POPS) con IMEI pero sin número de línea válido
  const inconsistUem = disp
    .filter((d) => d.imei && !normPhone(d.numero_telefono))
    .map((d) => ({
      imei: d.imei,
      modelo: d.modelo ?? "—",
      estado: d.estado ?? "—",
      numero_telefono: d.numero_telefono ?? "—",
      ultimo_checkin: d.ultimo_checkin,
      fuente: "UEM",
    }));
  const imeisUemInconsist = new Set(inconsistUem.map((d) => d.imei));
  const inconsistPops = pops
    .filter(
      (p) =>
        p.codigo &&
        !imeisUemInconsist.has(p.codigo) &&
        !normPhone(p.numero_telefono),
    )
    .map((p) => ({
      imei: p.codigo,
      modelo: p.modelo ?? "—",
      estado: p.estado ?? "—",
      numero_telefono: p.numero_telefono ?? "—",
      ultimo_checkin: p.fecha_alta ?? p.created_at,
      fuente: "POPS",
    }));
  const inconsist = [...inconsistUem, ...inconsistPops];

  // "IMEI duplicado": el cargue de Dispositivos UEM puede traer el mismo IMEI
  // en varias filas. Se calcula sobre los datos crudos (antes del dedupe).
  const dupMap = new Map<string, any[]>();
  for (const d of data?.disp ?? []) {
    const imei = d.imei ? String(d.imei).trim() : "";
    if (!imei) continue;
    const arr = dupMap.get(imei);
    if (arr) arr.push(d);
    else dupMap.set(imei, [d]);
  }
  const imeiDup = Array.from(dupMap.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([imei, rows]) => ({
      imei,
      repeticiones: rows.length,
      modelo: rows[0].modelo ?? "—",
      numero_telefono: rows.find((r) => normPhone(r.numero_telefono))?.numero_telefono ?? "—",
      asignado_a: rows[0].asignado_a ?? "—",
      estado: rows[0].estado ?? "—",
    }))
    .sort((a, b) => b.repeticiones - a.repeticiones);

  // "Líneas POPS Inconsistentes": el campo Numero_Telefono del Inventario POPS
  // se captura como texto libre. Se detectan (a) valores con letras o caracteres
  // especiales y (b) valores que solo traen el indicativo de país.
  // Además se cruza con Dispositivos UEM (por IMEI = POPS.codigo) y solo se
  // muestran los equipos activos: último check-in con 15 días o menos de inactividad.
  const popsTelInvalido = pops
    .map((p) => {
      const raw = p.numero_telefono == null ? "" : String(p.numero_telefono);
      const v = raw.trim();
      if (!v) return null;
      const digitos = v.replace(/\D/g, "");
      const tieneLetras = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(v);
      // Se toleran "+", espacios, guiones y paréntesis como formato habitual.
      const tieneEspeciales = /[^\d+\s()\-]/.test(v.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ""));
      const soloIndicativo = digitos.length > 0 && digitos.length <= 3 && /^0?57$|^\d{1,3}$/.test(digitos);

      let motivo: string | null = null;
      if (tieneLetras && tieneEspeciales) motivo = "Letras y caracteres especiales";
      else if (tieneLetras) motivo = "Contiene letras";
      else if (tieneEspeciales) motivo = "Caracteres especiales";
      else if (soloIndicativo) motivo = "Solo indicativo de país";
      if (!motivo) return null;

      // Cruce con Dispositivos UEM por IMEI
      const d = p.codigo ? dispByImei.get(String(p.codigo)) : undefined;
      const dias = diffDays(d?.ultimo_checkin);
      // Solo dispositivos activos/con actividad reciente (<= 15 días)
      if (dias == null || dias > 15) return null;

      return {
        valor_crudo: raw,
        motivo,
        digitos: digitos || "—",
        codigo: p.codigo ?? "—",
        centro_costo: p.centro_costo ?? "—",
        ubicacion: p.ubicacion ?? "—",
        modelo: d?.modelo ?? p.modelo ?? "—",
        estado: d?.estado ?? p.estado ?? "—",
        ultimo_checkin: d?.ultimo_checkin ?? "—",
        dias,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (a.dias ?? 0) - (b.dias ?? 0)) as {
      valor_crudo: string; motivo: string; digitos: string; codigo: string;
      centro_costo: string; ubicacion: string; modelo: string; estado: string;
      ultimo_checkin: string; dias: number;
    }[];


  const counts: Record<TabKey, number> = {
    sin_uso: sinUso.length,
    sin_equipo: sinEquipo.length,
    sobredim: sobredim.length,
    pops_sin_centro: popsSC.length,
    inconsistencias: inconsist.length,
    imei_duplicado: imeiDup.length,
    pops_tel_invalido: popsTelInvalido.length,
  };

  const total =
    counts.sin_uso +
    counts.sin_equipo +
    counts.sobredim +
    counts.pops_sin_centro +
    counts.inconsistencias +
    counts.imei_duplicado +
    counts.pops_tel_invalido;


  return (
    <div>
      <PageHeader
        title="Alertas y Hallazgos"
        subtitle={`${total.toLocaleString("es-CO")} alertas detectadas en el análisis cruzado`}
      />

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
            searchKeys={["imei", "msisdn", "modelo", "centro_costo"]}
            columns={[
              { key: "imei", header: "IMEI" },
              { key: "msisdn", header: "Número" },
              { key: "modelo", header: "Modelo" },
              {
                key: "dias",
                header: "Días sin uso",
                render: (r) => (
                  <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning-foreground">
                    {r.dias ?? "—"} días
                  </span>
                ),
              },
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
              {
                key: "costo",
                header: "Costo",
                render: (r) => {
                  const match = lineaByPhone.get(normPhone(r.msisdn));
                  return fmtMoney(
                    Number(
                      match?.valor_plan ??
                        match?.costo_mensual ??
                        r.valor_plan ??
                        r.costo_mensual ??
                        0,
                    ),
                  );
                },
              },
              { key: "estado", header: "Estado" },
            ]}
          />
        )}

        {/* -> Manuel Sierra. posible uso a futuro: lineas con planes de datos caros cuyo uso o consumo es muy minimo y por ende no justifica el valor del plan */}
        {/*{tab === "sobredim" && ( 
          <DataTable
            title="Planes sobredimensionados"
            rows={sobredim}
            searchKeys={["msisdn", "plan", "centro_costo"]}
            columns={[
              { key: "msisdn", header: "Número" },
              { key: "plan", header: "Plan" },
              {
                key: "costo",
                header: "Costo",
                render: (r) => fmtMoney(Number(r.costo_mensual ?? 0)),
              },
              {
                key: "consumo",
                header: "Consumo (MB)",
                render: (r) => Number(r.consumo_mb ?? 0).toLocaleString("es-CO"),
              },
              { key: "centro_costo", header: "Centro" },
            ]}
          />
        )}
        */}

        {tab === "pops_sin_centro" && (
          <DataTable
            title="Dispositivos sin centro asignado"
            rows={popsSC}
            searchKeys={["codigo", "modelo", "numero_telefono"]}
            columns={[
              { key: "codigo", header: "IMEI" },
              { key: "numero_telefono", header: "Número Teléfono" },
              { key: "modelo", header: "Modelo" },
              { key: "estado", header: "Estado" },
            ]}
          />
        )}

        {tab === "inconsistencias" && (
          <DataTable
            title="Dispositivos sin línea asociada"
            rows={inconsist}
            searchKeys={["imei", "modelo", "numero_telefono", "fuente"]}
            columns={[
              { key: "imei", header: "IMEI" },
              { key: "modelo", header: "Modelo" },
              { key: "estado", header: "Estado" },
              { key: "numero_telefono", header: "Número de Teléfono" },
              { key: "ultimo_checkin", header: "Último check-in" },
              { key: "fuente", header: "Fuente" },
            ]}
          />
        )}

        {tab === "imei_duplicado" && (
          <DataTable
            title="IMEI duplicados en Dispositivos UEM"
            rows={imeiDup}
            searchKeys={["imei", "modelo", "asignado_a", "numero_telefono"]}
            columns={[
              { key: "imei", header: "IMEI" },
              {
                key: "repeticiones",
                header: "Repeticiones",
                render: (r) => (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                    {r.repeticiones} registros
                  </span>
                ),
              },
              { key: "modelo", header: "Modelo" },
              { key: "numero_telefono", header: "Número" },
              { key: "estado", header: "Estado" },
              { key: "asignado_a", header: "Usuario" },
            ]}
          />
        )}

        {tab === "pops_tel_invalido" && (
          <DataTable
            title="Líneas POPS Inconsistentes (dispositivos activos, ≤15 días)"
            rows={popsTelInvalido}
            searchKeys={["valor_crudo", "motivo", "codigo", "centro_costo"]}
            columns={[
              {
                key: "valor_crudo",
                header: "Valor registrado (sin formato)",
                render: (r) => (
                  <span className="font-mono text-xs whitespace-pre-wrap break-all">{r.valor_crudo}</span>
                ),
              },
              {
                key: "motivo",
                header: "Motivo",
                render: (r) => (
                  <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning-foreground">
                    {r.motivo}
                  </span>
                ),
              },
              { key: "digitos", header: "Dígitos detectados" },
              { key: "codigo", header: "IMEI" },
              { key: "ultimo_checkin", header: "Último check-in" },
              {
                key: "dias",
                header: "Días inactivo",
                render: (r) => (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                    {r.dias} días
                  </span>
                ),
              },
              { key: "centro_costo", header: "Centro" },
              { key: "modelo", header: "Modelo" },
              { key: "estado", header: "Estado" },
            ]}
          />
        )}

      </div>
    </div>
  );
}
