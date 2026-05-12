import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function CargarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<Tipo>("lineas");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

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

  const handleUpload = async () => {
    if (!file || !user) return;
    setBusy(true);
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

      if (normalized.length === 0) { toast.error("No se encontraron filas válidas"); setBusy(false); return; }

      const chunks: any[][] = [];
      for (let i = 0; i < normalized.length; i += 500) chunks.push(normalized.slice(i, i + 500));

      let inserted = 0;
      for (const c of chunks) {
        const { error, count } = await supabase.from(tipo).insert(c, { count: "exact" });
        if (error) throw error;
        inserted += count ?? c.length;
      }

      await supabase.from("archivos_carga").insert({
        user_id: user.id, nombre: file.name, tipo, registros: inserted, estado: "completado",
      });

      // Recompute alerts after upload
      await regenerateAlerts(user.id);

      toast.success(`${inserted} registros importados`);
      setFile(null);
      qc.invalidateQueries();
    } catch (e: any) {
      console.error(e);
      toast.error(`Error: ${e.message ?? "no se pudo procesar"}`);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Cargar Archivos" subtitle="Importa CSV o Excel para Líneas, Dispositivos y POPS" />
      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold">Nueva carga</h3>
          <p className="mt-1 text-xs text-muted-foreground">Selecciona el tipo de archivo y súbelo. Acepta .csv, .xlsx, .xls</p>
          <div className="mt-5 grid gap-4 md:grid-cols-[200px_1fr_auto]">
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lineas">Maestro de Líneas</SelectItem>
                <SelectItem value="dispositivos">Dispositivos UEM</SelectItem>
                <SelectItem value="pops">Inventario POPS</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-border bg-background px-4 py-3 text-sm transition-colors hover:bg-accent">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 truncate text-foreground">{file ? file.name : "Selecciona un archivo..."}</span>
              <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Button onClick={handleUpload} disabled={!file || busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Importar
            </Button>
          </div>
          <div className="mt-4 rounded-lg bg-accent/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Columnas reconocidas:</p>
            <p className="mt-1">{Object.keys(FIELD_MAP[tipo]).join(", ")}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4">
            <h3 className="font-semibold">Historial de cargas</h3>
          </div>
          <div className="divide-y divide-border">
            {(historial ?? []).length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No hay cargas registradas</p>
            ) : (
              historial!.map((h) => (
                <div key={h.id} className="flex items-center gap-4 p-4">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{h.nombre}</p>
                    <p className="text-xs text-muted-foreground">{h.tipo} · {h.registros} registros · {new Date(h.created_at).toLocaleString("es-CO")}</p>
                  </div>
                  <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">{h.estado}</span>
                </div>
              ))
            )}
          </div>
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
