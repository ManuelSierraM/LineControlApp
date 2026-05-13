import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, Wifi, Smartphone, MapPin, HelpCircle, Loader2, CheckCircle2, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cargar")({ component: CargarPage });

type Tipo = "lineas" | "dispositivos" | "pops";

type GuideField = { columna: string; ejemplo: string; requerido: boolean; nota: string; target?: string };

const GUIDES: Record<Tipo, { titulo: string; archivo: string; fields: GuideField[] }> = {
  lineas: {
    titulo: "Maestro de Líneas",
    archivo: "Maestro_Lineas.xlsx",
    fields: [
      { columna: "OPERADOR", ejemplo: "CLARO", requerido: true, nota: "Nombre del operador" },
      { columna: "TIPO_DE_LINEA", ejemplo: "VOZ+DATOS", requerido: false, nota: "Tipo de servicio" },
      { columna: "TELE_NUMB", ejemplo: "3001234567", requerido: true, nota: "Número de la línea (MSISDN)", target: "msisdn" },
      { columna: "IDENTIFICACION", ejemplo: "1020304050", requerido: false, nota: "Documento del titular" },
      { columna: "IDENTIFICACION_MTR", ejemplo: "900123456", requerido: false, nota: "Identificación matriz" },
      { columna: "NOMBRE_CLIENTE", ejemplo: "Juan Pérez", requerido: false, nota: "Nombre del usuario asignado" },
      { columna: "EMPRESA", ejemplo: "ACME S.A.S.", requerido: false, nota: "Razón social" },
      { columna: "IMEI", ejemplo: "356938035643809", requerido: false, nota: "IMEI del equipo asociado", target: "imei" },
      { columna: "ICCID", ejemplo: "8957000012345678901", requerido: false, nota: "Serial de la SIM" },
      { columna: "MODELO_EQUIPO", ejemplo: "iPhone 13", requerido: false, nota: "Modelo del equipo" },
      { columna: "PAQUETE_DESC", ejemplo: "Plan Empresarial 20GB", requerido: false, nota: "Descripción del plan", target: "plan" },
      { columna: "VALOR_PLAN", ejemplo: "45000", requerido: false, nota: "Costo del plan" },
      { columna: "VALOR_DATOS", ejemplo: "15000", requerido: false, nota: "Costo de datos adicionales" },
      { columna: "TOTAL_LINEA", ejemplo: "60000", requerido: true, nota: "Costo total mensual", target: "costo_mensual" },
      { columna: "CUENTA", ejemplo: "CTA-001", requerido: false, nota: "Cuenta contable" },
      { columna: "DELEGACION", ejemplo: "Bogotá", requerido: false, nota: "Delegación o sede" },
      { columna: "DIVISION", ejemplo: "Comercial", requerido: false, nota: "División interna" },
      { columna: "CENTRO_COSTO", ejemplo: "CC-100", requerido: true, nota: "Centro de costo", target: "centro_costo" },
      { columna: "TERCERO", ejemplo: "T-001", requerido: false, nota: "Identificador de tercero" },
      { columna: "SUBTERCERO", ejemplo: "ST-001", requerido: false, nota: "Subtercero" },
    ],
  },
  dispositivos: {
    titulo: "Devices UEM",
    archivo: "Devices_Master.csv",
    fields: [
      { columna: "IMEI", ejemplo: "356938035643809", requerido: true, nota: "IMEI del dispositivo", target: "imei" },
      { columna: "Modelo", ejemplo: "Galaxy S22", requerido: false, nota: "Modelo del equipo", target: "modelo" },
      { columna: "Número_Teléfono", ejemplo: "3001234567", requerido: false, nota: "Línea asociada" },
      { columna: "Last_CheckIn", ejemplo: "2025-04-12", requerido: false, nota: "Último reporte UEM (YYYY-MM-DD)", target: "ultimo_checkin" },
      { columna: "Estado_UEM", ejemplo: "ACTIVO", requerido: true, nota: "Estado en plataforma UEM", target: "estado" },
      { columna: "País", ejemplo: "Colombia", requerido: false, nota: "País de operación" },
      { columna: "Usuario", ejemplo: "jperez@empresa.com", requerido: false, nota: "Usuario asignado", target: "asignado_a" },
    ],
  },
  pops: {
    titulo: "Inventario POPS",
    archivo: "POPS_Inventory.xlsx",
    fields: [
      { columna: "IMEI", ejemplo: "356938035643809", requerido: true, nota: "IMEI del equipo", target: "codigo" },
      { columna: "Numero_Telefono", ejemplo: "3001234567", requerido: false, nota: "Línea asociada" },
      { columna: "Centro", ejemplo: "CC-100", requerido: true, nota: "Centro de costo", target: "centro_costo" },
      { columna: "Delegación", ejemplo: "Bogotá Norte", requerido: false, nota: "Delegación o sede", target: "ubicacion" },
      { columna: "Fecha_Alta", ejemplo: "2024-01-15", requerido: false, nota: "Fecha de alta del equipo" },
      { columna: "Fecha_Baja", ejemplo: "2025-03-30", requerido: false, nota: "Fecha de baja (si aplica)" },
      { columna: "Modelo", ejemplo: "iPhone 13", requerido: false, nota: "Modelo del equipo" },
    ],
  },
};

function buildFieldMap(tipo: Tipo): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of GUIDES[tipo].fields) {
    if (!f.target) continue;
    const key = f.columna.toLowerCase().trim().replace(/\s+/g, "_");
    map[key] = f.target;
    map[f.columna.toLowerCase().trim()] = f.target;
  }
  return map;
}

const CARDS: { tipo: Tipo; descripcion: string; icon: React.ComponentType<any> }[] = [
  { tipo: "lineas", descripcion: "Archivo principal con todas las líneas corporativas", icon: Wifi },
  { tipo: "dispositivos", descripcion: "Datos de dispositivos desde plataforma UEM", icon: Smartphone },
  { tipo: "pops", descripcion: "Asignación física de equipos por centro", icon: MapPin },
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
      const map = buildFieldMap(tipo);
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
        const { error, count } = await supabase.from(tipo).insert(c as any, { count: "exact" });
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

  const guide = guideTipo ? GUIDES[guideTipo] : null;

  return (
    <div>
      <PageHeader title="Cargar Archivos" subtitle="Sube los maestros para ejecutar el cruce de información y generar alertas." />
      <div className="space-y-6 p-6">
        {CARDS.map((c) => (
          <UploadCard
            key={c.tipo}
            card={{ ...c, titulo: GUIDES[c.tipo].titulo }}
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Formato Guía — {guide?.titulo}</DialogTitle>
            <DialogDescription>
              Archivo sugerido: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{guide?.archivo}</code>
            </DialogDescription>
          </DialogHeader>
          {guide && (
            <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-[28%]">Columna</TableHead>
                    <TableHead className="w-[24%]">Ejemplo</TableHead>
                    <TableHead className="w-[14%]">Requerido</TableHead>
                    <TableHead>Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guide.fields.map((f) => (
                    <TableRow key={f.columna}>
                      <TableCell className="font-mono text-xs">{f.columna}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.ejemplo}</TableCell>
                      <TableCell>
                        {f.requerido ? (
                          <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Sí</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{f.nota}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
