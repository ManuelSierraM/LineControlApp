import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, Wifi, Smartphone, MapPin, HelpCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cargar")({ component: CargarPage });

type Tipo = "lineas" | "dispositivos" | "pops";

const FIELD_MAP: Record<Tipo, Record<string, string>> = {
  lineas: { msisdn: "msisdn", numero: "msisdn", linea: "msisdn", imei: "imei", plan: "plan", costo: "costo_mensual", costo_mensual: "costo_mensual", centro_costo: "centro_costo", centro: "centro_costo", estado: "estado", ultimo_uso: "ultimo_uso", consumo_mb: "consumo_mb", consumo: "consumo_mb" },
  dispositivos: { imei: "imei", modelo: "modelo", fabricante: "fabricante", marca: "fabricante", so: "so", os: "so", estado: "estado", ultimo_checkin: "ultimo_checkin", checkin: "ultimo_checkin", asignado_a: "asignado_a", asignado: "asignado_a" },
  pops: { codigo: "codigo", code: "codigo", ubicacion: "ubicacion", direccion: "ubicacion", centro_costo: "centro_costo", centro: "centro_costo", estado: "estado", responsable: "responsable" },
};

const CARDS: { tipo: Tipo; titulo: string; descripcion: string; icon: React.ComponentType<any> }[] = [
  { tipo: "lineas", titulo: "Maestro de Líneas", descripcion: "Archivo principal con todas las líneas corporativas", icon: Wifi },
  { tipo: "dispositivos", titulo: "Devices UEM", descripcion: "Datos de dispositivos desde plataforma UEM", icon: Smartphone },
  { tipo: "pops", titulo: "Inventario POPS", descripcion: "Asignación física de equipos por centro", icon: MapPin },
];

function CargarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Tipo | null>(null);
  const [guideTipo, setGuideTipo] = useState<Tipo | null>(null);

  const { data: historial } = useQuery({
    queryKey: ["archivos_carga"],
    queryFn: async () => {
      const { data } = await supabase.from("archivos_carga").select("*").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const parseFile = (f: File): Promise<Record<string, any>[]> => new Promise((resolve, reject) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse(f, { header: true, skipEmptyLines: true, complete: (r) => resolve(r.data as any), error: reject });
    } else if (ext === "json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(String(e.target?.result ?? "[]"));
          resolve(Array.isArray(parsed) ? parsed : [parsed]);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsText(f);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws));
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(f);
    }
  });

  const handleUpload = async (tipo: Tipo, file: File) => {
    if (!user) return;
    setBusy(tipo);
    try {
      const rows = await parseFile(file);
      const map = FIELD_MAP[tipo];
      const normalized = rows.map((r) => {
        const out: Record<string, any> = { user_id: user.id };
        for (const [k, v] of Object.entries(r)) {
          const key = String(k).toLowerCase().trim().replace(/\s+/g, "_");
          const target = map[key];
          if (target) out[target] = typeof v === "string" ? v.trim() : v;
        }
        return out;
      }).filter((r) => Object.keys(r).length > 1);

      if (normalized.length === 0) { toast.error("No se encontraron filas válidas"); setBusy(null); return; }

      let inserted = 0;
      for (let i = 0; i < normalized.length; i += 500) {
        const c = normalized.slice(i, i + 500);
        const { error, count } = await supabase.from(tipo).insert(c, { count: "exact" });
        if (error) throw error;
        inserted += count ?? c.length;
      }

      await supabase.from("archivos_carga").insert({
        user_id: user.id, nombre: file.name, tipo, registros: inserted, estado: "completado",
      });

      await regenerateAlerts(user.id);
      toast.success(`${inserted} registros importados en ${tipo}`);
      qc.invalidateQueries();
    } catch (e: any) {
      console.error(e);
      toast.error(`Error: ${e.message ?? "no se pudo procesar"}`);
    } finally { setBusy(null); }
  };

  return (
    <div>
      <PageHeader title="Cargar Archivos" subtitle="Sube los maestros para ejecutar el cruce de información y generar alertas." />
      <div className="space-y-6 p-6">
        {CARDS.map((c) => (
          <UploadCard
            key={c.tipo}
            card={c}
            busy={busy === c.tipo}
            onFile={(f) => handleUpload(c.tipo, f)}
            onGuide={() => setGuideTipo(c.tipo)}
          />
        ))}

        {(historial ?? []).length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-4">
              <h3 className="font-semibold">Historial de cargas</h3>
            </div>
            <div className="divide-y divide-border">
              {historial!.map((h) => (
                <div key={h.id} className="flex items-center gap-4 p-4">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{h.nombre}</p>
                    <p className="text-xs text-muted-foreground">{h.tipo} · {h.registros} registros · {new Date(h.created_at).toLocaleString("es-CO")}</p>
                  </div>
                  <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">{h.estado}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!guideTipo} onOpenChange={(o) => !o && setGuideTipo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Formato guía — {guideTipo && CARDS.find((c) => c.tipo === guideTipo)?.titulo}</DialogTitle>
            <DialogDescription>
              Tu archivo (CSV, Excel o JSON) debe tener encabezados con cualquiera de los siguientes nombres. Mayúsculas y espacios no importan.
            </DialogDescription>
          </DialogHeader>
          {guideTipo && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {Object.keys(FIELD_MAP[guideTipo]).map((k) => (
                  <code key={k} className="rounded-md bg-muted px-2 py-1 text-xs">{k}</code>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Filas sin columnas reconocidas se descartan automáticamente.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadCard({
  card, busy, onFile, onGuide,
}: {
  card: { tipo: Tipo; titulo: string; descripcion: string; icon: React.ComponentType<any> };
  busy: boolean;
  onFile: (f: File) => void;
  onGuide: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const Icon = card.icon;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{card.titulo}</h3>
            <p className="text-sm text-muted-foreground">{card.descripcion}</p>
          </div>
        </div>
        <button
          onClick={onGuide}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <HelpCircle className="h-4 w-4" /> Ver formato guía
        </button>
      </div>

      <div className="px-5 pb-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-background"
          }`}
        >
          {busy ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium text-foreground">
              {busy ? "Procesando archivo..." : "Arrastra un archivo aquí o haz clic para seleccionar"}
            </p>
            <p className="text-xs text-muted-foreground">.xlsx, .csv, .json</p>
          </div>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            Seleccionar archivo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
          />
        </div>
      </div>
    </div>
  );
}

async function regenerateAlerts(userId: string) {
  await supabase.from("alertas").delete().eq("user_id", userId);
  const [{ data: lineas }, { data: disp }] = await Promise.all([
    supabase.from("lineas").select("*"),
    supabase.from("dispositivos").select("*"),
  ]);
  if (!lineas || !disp) return;
  const hoy = Date.now();
  const alerts: any[] = [];
  for (const l of lineas) {
    if (l.ultimo_uso) {
      const days = Math.floor((hoy - new Date(l.ultimo_uso).getTime()) / 86400000);
      if (days > 30) alerts.push({ user_id: userId, tipo: "sin_uso", severidad: "alta", entidad: "linea", referencia: l.msisdn, mensaje: `${l.msisdn} — ${days} días sin uso`, detalle: l.plan ?? "" });
    }
    if (!l.imei) alerts.push({ user_id: userId, tipo: "sin_equipo", severidad: "media", entidad: "linea", referencia: l.msisdn, mensaje: `${l.msisdn} — Línea sin equipo asociado`, detalle: l.plan ?? "" });
  }
  const imeisLineas = new Set(lineas.map((l) => l.imei).filter(Boolean));
  for (const d of disp) {
    if (d.imei && !imeisLineas.has(d.imei)) {
      alerts.push({ user_id: userId, tipo: "inconsistencia", severidad: "media", entidad: "dispositivo", referencia: d.imei, mensaje: "IMEI en Devices no existe en Maestro de Líneas", detalle: d.imei });
    }
  }
  if (alerts.length > 0) {
    for (let i = 0; i < alerts.length; i += 500) {
      await supabase.from("alertas").insert(alerts.slice(i, i + 500));
    }
  }
}
