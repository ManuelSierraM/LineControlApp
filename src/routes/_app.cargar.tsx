import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, Wifi, Smartphone, MapPin, HelpCircle, Loader2, CheckCircle2, Trash2, Filter, Download, AlertTriangle, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useAuth } from "@/lib/auth";
import { coercePhone } from "@/lib/utils";
import { useRoles } from "@/lib/roles";
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
      { columna: "OPERADOR", ejemplo: "CLARO", requerido: true, nota: "Nombre del operador", target: "operador" },
      { columna: "TIPO_DE_LINEA", ejemplo: "VOZ+DATOS", requerido: false, nota: "Tipo de servicio" },
      { columna: "TELE_NUMB", ejemplo: "3001234567", requerido: false, nota: "Número de la línea (MSISDN). Se quita el indicativo de país (+57, 0057, +1, etc.) de cualquier país. Puede venir vacío.", target: "msisdn" },
      { columna: "NOMBRE_CLIENTE", ejemplo: "vigilancia", requerido: false, nota: "Nombre del usuario asignado", target: "nombre_cliente" },
      { columna: "Cod Empresa", ejemplo: "CO0070", requerido: false, nota: "Código de empresa", target: "cod_empresa" },

      { columna: "ICCID", ejemplo: "8957000012345678901", requerido: true, nota: "Serial de la SIM", target: "iccid" },
      { columna: "PLAN_DESC", ejemplo: "Plan Empresarial 20GB", requerido: false, nota: "Descripción del plan", target: "plan" },
      { columna: "VALOR_CFM", ejemplo: "45000", requerido: true, nota: "Costo del plan", target: "valor_plan" },
    ],
  },
  dispositivos: {
    titulo: "Devices UEM",
    archivo: "Devices_Master.csv",
    fields: [
      { columna: "IMEI", ejemplo: "356938035643809", requerido: true, nota: "IMEI del dispositivo", target: "imei" },
      { columna: "Modelo", ejemplo: "Galaxy S22", requerido: false, nota: "Modelo del equipo", target: "modelo" },
      { columna: "Número_Teléfono", ejemplo: "3001234567", requerido: false, nota: "Línea asociada. Se quita el indicativo de país (+57, 0057, +1, etc.) de cualquier país. Puede venir vacío.", target: "numero_telefono" },
      { columna: "Last_CheckIn", ejemplo: "2025-04-12", requerido: true, nota: "Último reporte UEM (YYYY-MM-DD)", target: "ultimo_checkin" },
      { columna: "Estado_UEM", ejemplo: "ACTIVO", requerido: true, nota: "Estado en plataforma UEM", target: "estado" },
      { columna: "País", ejemplo: "Colombia", requerido: false, nota: "País de operación" },
      { columna: "Usuario", ejemplo: "jperez@empresa.com", requerido: false, nota: "Usuario asignado", target: "asignado_a" },
    ],
  },
  pops: {
    titulo: "Inventario POPS",
    archivo: "POPS_Inventory.xlsx",
    fields: [
      { columna: "IMEI", ejemplo: "356938035643809", requerido: false, nota: "IMEI del equipo. Puede venir vacío.", target: "codigo" },
      { columna: "Numero_Telefono", ejemplo: "3001234567", requerido: false, nota: "Línea asociada. Se quita el indicativo de país (+57, 0057, +1, etc.) de cualquier país. Texto libre, puede venir vacío.", target: "numero_telefono" },
      { columna: "Centro", ejemplo: "CC-100", requerido: false, nota: "Centro de costo. Puede venir vacío.", target: "centro_costo" },
      { columna: "Delegación", ejemplo: "Bogotá Norte", requerido: false, nota: "Delegación o sede. Puede venir vacío.", target: "ubicacion" },
      { columna: "Fecha_Alta", ejemplo: "2024-01-15", requerido: false, nota: "Fecha de alta del equipo (YYYY-MM-DD)", target: "fecha_alta" },
      { columna: "Fecha_Baja", ejemplo: "2025-03-30", requerido: false, nota: "Fecha de baja si aplica (YYYY-MM-DD)", target: "fecha_baja" },
      { columna: "Modelo", ejemplo: "iPhone 13", requerido: false, nota: "Modelo del equipo", target: "modelo" },
    ],
  },
};

// ───────── Esquemas de validación de tipos / formatos ─────────
type DataType = "text" | "digits" | "number" | "date" | "email";
type FieldRule = {
  columna: string;
  target?: string;
  required?: boolean;
  type: DataType;
  minLen?: number;
  maxLen?: number;
  min?: number;
  max?: number;
  enum?: string[];
  unique?: boolean;
  normalize?: "phone" | "phone-strict";
  hint: string;
};

const SCHEMAS: Record<Tipo, FieldRule[]> = {
  lineas: [
    { columna: "OPERADOR", target: "operador", required: true, type: "text", maxLen: 50, hint: "Texto, ej. CLARO / TIGO / MOVISTAR (máx. 50)." },
    { columna: "TIPO_DE_LINEA", type: "text", maxLen: 50, hint: "Texto, ej. VOZ+DATOS." },
    { columna: "TELE_NUMB", target: "msisdn", type: "text", normalize: "phone-strict", hint: "Texto libre. Se normaliza quitando el indicativo de país de cualquier país (+57, 0057, +1, etc.)." },
    { columna: "NOMBRE_CLIENTE", target: "nombre_cliente", type: "text", maxLen: 100, hint: "Texto (máx. 100)." },
    { columna: "Cod Empresa", target: "cod_empresa", type: "text", maxLen: 30, hint: "Texto corto, ej. CO0070 (máx. 30)." },
    { columna: "ICCID", target: "iccid", required: true, type: "digits", minLen: 18, maxLen: 22, hint: "Solo dígitos, 18–22 caracteres." },
    { columna: "PLAN_DESC", target: "plan", type: "text", maxLen: 100, hint: "Texto (máx. 100)." },
    { columna: "VALOR_CFM", target: "valor_plan", required: true, type: "number", min: 0, hint: "Número ≥ 0. Sin símbolos $, ni texto." },
  ],
  dispositivos: [
    { columna: "IMEI", target: "imei", required: true, type: "digits", minLen: 14, maxLen: 16, hint: "Solo dígitos, 14–16 caracteres. Se permiten repetidos (se reportan en la alerta IMEI duplicado)." },
    { columna: "Modelo", target: "modelo", type: "text", maxLen: 60, hint: "Texto (máx. 60)." },
    { columna: "Número_Teléfono", target: "numero_telefono", type: "text", normalize: "phone-strict", hint: "Texto libre. Se normaliza quitando el indicativo de país de cualquier país (+57, 0057, +1, etc.)." },
    { columna: "Last_CheckIn", target: "ultimo_checkin", required: true, type: "date", hint: "Fecha YYYY-MM-DD (ej. 2025-04-12)." },
    { columna: "Estado_UEM", target: "estado", required: true, type: "text", maxLen: 30, enum: ["ACTIVO","INACTIVO","SUSPENDIDO","BAJA","ENROLADO"], hint: "Valores recomendados: ACTIVO, INACTIVO, SUSPENDIDO, BAJA, ENROLADO." },
    { columna: "País", type: "text", maxLen: 40, hint: "Texto (máx. 40)." },
    { columna: "Usuario", target: "asignado_a", type: "text", maxLen: 120, hint: "Texto / correo (máx. 120)." },
  ],
  pops: [
    { columna: "IMEI", target: "codigo", required: false, type: "text", unique: true, hint: "Texto libre. Puede venir vacío." },
    { columna: "Numero_Telefono", target: "numero_telefono", type: "text", normalize: "phone", hint: "Texto libre. Se normaliza quitando el indicativo de país de cualquier país (+57, 0057, +1, etc.). Se conservan letras o símbolos para alertas de inconsistencia." },
    { columna: "Centro", target: "centro_costo", required: false, type: "text", hint: "Texto libre. Puede venir vacío." },
    { columna: "Delegación", target: "ubicacion", required: false, type: "text", hint: "Texto libre. Puede venir vacío." },
    { columna: "Fecha_Alta", target: "fecha_alta", type: "date", hint: "Fecha YYYY-MM-DD." },
    { columna: "Fecha_Baja", target: "fecha_baja", type: "date", hint: "Fecha YYYY-MM-DD." },
    { columna: "Modelo", target: "modelo", type: "text", hint: "Texto libre." },
  ],
};

function normKey(s: string) { return String(s).toLowerCase().trim().replace(/\s+/g, "_"); }

function getCell(row: Record<string, any>, columna: string) {
  if (row[columna] !== undefined) return row[columna];
  const lower = columna.toLowerCase().trim();
  if (row[lower] !== undefined) return row[lower];
  const nk = normKey(columna);
  for (const k of Object.keys(row)) if (normKey(k) === nk) return row[k];
  return undefined;
}

function excelSerialToISO(n: number): string | null {
  if (!isFinite(n) || n < 1 || n > 80000) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function coerceDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return excelSerialToISO(v);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function coerceNumber(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/[\s$]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}
function coerceDigits(v: any): string | null {
  if (v == null || v === "") return null;
  const s = typeof v === "number" ? String(Math.trunc(v)) : String(v).trim();
  const cleaned = s.replace(/[^\d]/g, "");
  return cleaned || null;
}

function validateValue(rule: FieldRule, raw: any): { ok: boolean; reason?: string; warn?: string; coerced?: any } {
  const empty = raw == null || String(raw).trim() === "";
  if (empty) {
    if (rule.required) return { ok: false, reason: `obligatorio vacío — ${rule.hint}` };
    return { ok: true, coerced: null };
  }
  switch (rule.type) {
    case "number": {
      const n = coerceNumber(raw);
      if (n === null) return { ok: false, reason: `no es numérico ("${String(raw).slice(0,30)}") — ${rule.hint}` };
      if (rule.min !== undefined && n < rule.min) return { ok: false, reason: `debe ser ≥ ${rule.min}` };
      if (rule.max !== undefined && n > rule.max) return { ok: false, reason: `debe ser ≤ ${rule.max}` };
      return { ok: true, coerced: n };
    }
    case "date": {
      const d = coerceDate(raw);
      if (!d) return { ok: false, reason: `fecha inválida ("${String(raw).slice(0,30)}") — ${rule.hint}` };
      return { ok: true, coerced: d };
    }
    case "digits": {
      const s = coerceDigits(raw);
      if (!s) return { ok: false, reason: `no contiene dígitos — ${rule.hint}` };
      if (rule.minLen && s.length < rule.minLen) return { ok: false, reason: `longitud ${s.length}, mínimo ${rule.minLen} — ${rule.hint}` };
      if (rule.maxLen && s.length > rule.maxLen) return { ok: false, reason: `longitud ${s.length}, máximo ${rule.maxLen} — ${rule.hint}` };
      return { ok: true, coerced: s };
    }
    case "email": {
      const s = String(raw).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { ok: false, reason: `correo inválido — ${rule.hint}` };
      return { ok: true, coerced: s };
    }
    default: {
      const s = String(raw).trim();
      if (rule.maxLen && s.length > rule.maxLen) return { ok: false, reason: `excede ${rule.maxLen} caracteres — ${rule.hint}` };
      if (rule.minLen && s.length < rule.minLen) return { ok: false, reason: `mínimo ${rule.minLen} caracteres — ${rule.hint}` };
      let warn: string | undefined;
      if (rule.enum && !rule.enum.map((e)=>e.toLowerCase()).includes(s.toLowerCase())) {
        warn = `"${s}" no es un valor recomendado (${rule.enum.join(", ")})`;
      }
      return { ok: true, coerced: s, warn };
    }
  }
}

function buildFieldMap(tipo: Tipo): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of GUIDES[tipo].fields) {
    if (!f.target) continue;
    const key = normKey(f.columna);
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
  const { isAdmin } = useRoles();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Tipo | null>(null);
  const [guideTipo, setGuideTipo] = useState<Tipo | null>(null);
  const [borrarOpen, setBorrarOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | Tipo>("todos");
  const [filtroUsuario, setFiltroUsuario] = useState<string>("todos");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [purgarDatos, setPurgarDatos] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Pre-upload validation card state
  type ValidationIssue = { row: number; fields: string[] };
  type TypeIssue = { row: number; field: string; reason: string };
  type DuplicateIssue = { field: string; value: string; rows: number[] };
  type WarnIssue = { row: number; field: string; warn: string };
  type ValidationResult = {
    tipo: Tipo;
    fileName: string;
    rows: Record<string, any>[];
    coercedRows: Record<string, any>[];
    totalRows: number;
    presentRequired: string[];
    presentOptional: string[];
    missingRequiredColumns: string[];
    unknownColumns: string[];
    rowIssues: ValidationIssue[];
    typeIssues: TypeIssue[];
    duplicateIssues: DuplicateIssue[];
    warnings: WarnIssue[];
    canContinue: boolean;
  };
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [inserting, setInserting] = useState(false);
  const [regenerando, setRegenerando] = useState(false);


  const { data: historial } = useQuery({
    queryKey: ["archivos_carga"],
    queryFn: async () => {
      const { data: archivos } = await supabase
        .from("archivos_carga")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!archivos?.length) return [];
      const userIds = [...new Set(archivos.map((a) => a.user_id))];
      const { data: perfiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      const emailMap = new Map((perfiles ?? []).map((p) => [p.id, p.email]));
      return archivos.map((a) => ({
        ...a,
        profiles: { email: emailMap.get(a.user_id) ?? null },
      }));
    },
  });

  // Usuarios presentes en el historial visible (para el filtro de borrado).
  const usuariosHistorial = Array.from(
    new Map(
      (historial ?? []).map((h: any) => [
        h.user_id,
        (h.profiles as { email?: string } | null)?.email ?? "Usuario desconocido",
      ]),
    ).entries(),
  ).map(([id, email]) => ({ id, email }));

  const matchesFilter = (h: any) => {
    if (filtroTipo !== "todos" && h.tipo !== filtroTipo) return false;
    if (filtroUsuario !== "todos" && h.user_id !== filtroUsuario) return false;
    const t = new Date(h.created_at).getTime();
    if (filtroDesde && t < new Date(filtroDesde).getTime()) return false;
    if (filtroHasta && t > new Date(filtroHasta).getTime() + 86400000) return false;
    return true;
  };
  const afectados = (historial ?? []).filter(matchesFilter);


  const eliminarRegistroIndividual = async (h: any) => {
    if (!user) return;
    await supabase.from("archivos_carga").delete().eq("id", h.id);
    toast.success("Registro de historial eliminado");
    qc.invalidateQueries({ queryKey: ["archivos_carga"] });
  };

  const ejecutarBorrado = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Usuarios objetivo: el seleccionado, o todos los presentes en los
      // registros que coinciden con los filtros actuales.
      const targetUserIds =
        filtroUsuario !== "todos"
          ? [filtroUsuario]
          : [...new Set(afectados.map((h: any) => h.user_id as string))];
      if (targetUserIds.length === 0) targetUserIds.push(user.id);

      let q = supabase.from("archivos_carga").delete().in("user_id", targetUserIds);
      if (filtroTipo !== "todos") q = q.eq("tipo", filtroTipo);
      if (filtroDesde) q = q.gte("created_at", filtroDesde);
      if (filtroHasta) q = q.lte("created_at", new Date(new Date(filtroHasta).getTime() + 86400000).toISOString());
      const { error } = await q;
      if (error) throw error;

      if (purgarDatos) {
        const tipos: Tipo[] = filtroTipo === "todos" ? ["lineas", "dispositivos", "pops"] : [filtroTipo];
        for (const t of tipos) {
          await supabase.from(t).delete().in("user_id", targetUserIds);
        }
        // NOTA: no tocamos la tabla "alertas" — se preserva el histórico para auditoría
        // y para la tarjeta "HISTORICO ALERTAS" en Reportes.
      }


      toast.success(`Se eliminaron ${afectados.length} registros del historial${purgarDatos ? " y los datos cargados" : ""}`);
      setConfirmOpen(false);
      setBorrarOpen(false);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(`Error: ${e.message ?? "no se pudo borrar"}`);
    } finally {
      setDeleting(false);
    }
  };

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

  function validateRequiredFields(rows: Record<string, any>[], tipo: Tipo): { row: number; fields: string[] }[] {
    const required = GUIDES[tipo].fields.filter((f) => f.requerido);
    const errors: { row: number; fields: string[] }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const missing: string[] = [];
      for (const field of required) {
        const normalizedKey = field.columna.toLowerCase().trim().replace(/\s+/g, "_");
        let val = rows[i][field.columna];
        if (val === undefined) val = rows[i][field.columna.toLowerCase().trim()];
        if (val === undefined) val = rows[i][normalizedKey];
        if (val === undefined || val === null || String(val).trim() === "") {
          missing.push(field.columna);
        }
      }
      if (missing.length > 0) {
        errors.push({ row: i + 2, fields: missing });
      }
    }
    return errors;
  }

  const descargarTemplate = async (tipo: Tipo) => {
    const g = GUIDES[tipo];
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Datos");

    const headers = g.fields.map((f) => f.columna);
    ws.addRow(headers);
    ws.addRow(g.fields.map((f) => f.ejemplo));

    // Style header: required fields in orange + comment tooltip
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const field = g.fields[colNumber - 1];
      const isReq = !!field?.requerido;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isReq ? "FFE26B0A" : "FFE5E7EB" },
      };
      cell.font = { bold: true, color: { argb: isReq ? "FFFFFFFF" : "FF111827" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
      if (isReq) {
        cell.note = {
          texts: [{ font: { bold: true, color: { argb: "FFB45309" } }, text: "Campo obligatorio" }],
          margins: { insetmode: "auto" },
        } as any;
      }
    });

    g.fields.forEach((f, idx) => {
      const col = ws.getColumn(idx + 1);
      col.width = Math.max(14, f.columna.length + 4);
    });

    // Instrucciones sheet
    const wsInfo = wb.addWorksheet("Instrucciones");
    wsInfo.addRow(["Columna", "Requerido", "Ejemplo", "Nota"]);
    g.fields.forEach((f) => wsInfo.addRow([f.columna, f.requerido ? "Sí" : "No", f.ejemplo, f.nota]));
    wsInfo.addRow([]);
    wsInfo.addRow(["Nota: las columnas con encabezado naranja son obligatorias. Pase el cursor sobre el encabezado para ver el aviso 'Campo obligatorio'."]);
    wsInfo.getRow(1).font = { bold: true };
    wsInfo.columns = [{ width: 24 }, { width: 12 }, { width: 26 }, { width: 60 }];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = g.archivo.replace(/\.(csv|xlsx)$/i, "") + "_template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Template descargado");
  };

  const handleUpload = async (tipo: Tipo, file: File) => {
    if (!user) return;
    setBusy(tipo);
    try {
      const rows = await parseFile(file);
      const fields = GUIDES[tipo].fields;
      const schema = SCHEMAS[tipo];
      const schemaByCol = new Map(schema.map((r) => [r.columna.toLowerCase().trim(), r]));
      const requiredCols = fields.filter((f) => f.requerido).map((f) => f.columna);
      const knownColsLower = new Set(fields.map((f) => f.columna.toLowerCase().trim()));

      const firstRow = rows[0] ?? {};
      const headerKeys = Object.keys(firstRow);
      const headerKeysLower = headerKeys.map((h) => h.toLowerCase().trim());

      const presentRequired = requiredCols.filter((c) => headerKeysLower.includes(c.toLowerCase().trim()));
      const missingRequiredColumns = requiredCols.filter((c) => !headerKeysLower.includes(c.toLowerCase().trim()));
      const presentOptional = fields
        .filter((f) => !f.requerido && headerKeysLower.includes(f.columna.toLowerCase().trim()))
        .map((f) => f.columna);
      const unknownColumns = headerKeys.filter((h) => !knownColsLower.has(h.toLowerCase().trim()));

      // Validación por fila: requeridos + tipos/formatos + únicos
      const rowIssues: { row: number; fields: string[] }[] = [];
      const typeIssues: { row: number; field: string; reason: string }[] = [];
      const warnings: { row: number; field: string; warn: string }[] = [];
      const uniqueTrack = new Map<string, Map<string, number[]>>(); // field -> value -> rows
      const coercedRows: Record<string, any>[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 2;
        const missing: string[] = [];
        const coerced: Record<string, any> = {};
        for (const rule of schema) {
          const raw = getCell(r, rule.columna);
          const empty = raw == null || String(raw).trim() === "";
          if (empty && rule.required) { missing.push(rule.columna); continue; }
          if (empty) continue;
          const res = validateValue(rule, raw);
          if (!res.ok) {
            typeIssues.push({ row: rowNum, field: rule.columna, reason: res.reason ?? "valor inválido" });
            continue;
          }
          if (res.warn) warnings.push({ row: rowNum, field: rule.columna, warn: res.warn });
          if (rule.target) coerced[rule.target] = res.coerced;
          if (rule.normalize && rule.target) {
            const value = coerced[rule.target] ?? raw;
            coerced[rule.target] = rule.normalize === "phone-strict"
              ? normalizePhone(value)
              : coercePhone(value);
          }
          if (rule.unique && res.coerced != null) {
            const key = String(res.coerced);
            if (!uniqueTrack.has(rule.columna)) uniqueTrack.set(rule.columna, new Map());
            const m = uniqueTrack.get(rule.columna)!;
            const arr = m.get(key) ?? [];
            arr.push(rowNum);
            m.set(key, arr);
          }
        }
        if (missing.length > 0) rowIssues.push({ row: rowNum, fields: missing });
        coercedRows.push(coerced);
      }

      const duplicateIssues: { field: string; value: string; rows: number[] }[] = [];
      for (const [field, m] of uniqueTrack.entries()) {
        for (const [value, rs] of m.entries()) {
          if (rs.length > 1) duplicateIssues.push({ field, value, rows: rs });
        }
      }

      const canContinue =
        rows.length > 0 &&
        missingRequiredColumns.length === 0 &&
        rowIssues.length === 0 &&
        typeIssues.length === 0 &&
        duplicateIssues.length === 0;

      setValidation({
        tipo,
        fileName: file.name,
        rows,
        coercedRows,
        totalRows: rows.length,
        presentRequired,
        presentOptional,
        missingRequiredColumns,
        unknownColumns,
        rowIssues,
        typeIssues,
        duplicateIssues,
        warnings,
        canContinue,
      });
    } catch (e: any) {
      console.error(e);
      toast.error(`Error: ${e.message ?? "no se pudo leer el archivo"}`);
    } finally {
      setBusy(null);
    }
  };

  const confirmInsert = async () => {
    if (!user || !validation || !validation.canContinue) return;
    const { tipo, coercedRows, fileName } = validation;
    setInserting(true);
    try {
      const normalized = coercedRows
        .map((r) => ({ user_id: user.id, ...r }))
        .filter((r) => Object.keys(r).length > 1);

      if (normalized.length === 0) { toast.error("No se encontraron filas válidas"); setInserting(false); return; }

      let inserted = 0;
      for (let i = 0; i < normalized.length; i += 500) {
        const c = normalized.slice(i, i + 500);
        const { error, count } = await supabase.from(tipo).insert(c as any, { count: "exact" });
        if (error) throw error;
        inserted += count ?? c.length;
      }


      await supabase.from("archivos_carga").insert({
        user_id: user.id, nombre: fileName, tipo, registros: inserted, estado: "completado",
      });

      await regenerateAlerts(user.id);
      toast.success(`${inserted} registros importados en ${tipo}`);
      qc.invalidateQueries();
      setValidation(null);
    } catch (e: any) {
      console.error(e);
      toast.error(`Error: ${e.message ?? "no se pudo procesar"}`);
    } finally {
      setInserting(false);
    }
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
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold">Historial de cargas</h3>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setBorrarOpen(true)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Borrar registros
                  </Button>
                )}
              </div>
            </div>
            <div className="divide-y divide-border">
              {historial!.map((h) => (
                <div key={h.id} className="flex items-center gap-4 p-4">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{h.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {(h.profiles as { email?: string } | null)?.email ?? "Usuario desconocido"} · {h.tipo} · {h.registros} registros · {new Date(h.created_at).toLocaleString("es-CO")}
                    </p>
                  </div>
                  <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">{h.estado}</span>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => eliminarRegistroIndividual(h)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
            {guideTipo && (
              <div className="pt-2">
                <Button size="sm" variant="secondary" onClick={() => descargarTemplate(guideTipo)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Descargar template Excel
                </Button>
              </div>
            )}
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

      <Dialog open={borrarOpen} onOpenChange={(o) => { setBorrarOpen(o); if (!o) setPurgarDatos(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> Borrar registros del historial</DialogTitle>
            <DialogDescription>Selecciona los filtros para acotar qué registros se eliminarán.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de carga</Label>
              <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="lineas">Maestro de Líneas</SelectItem>
                  <SelectItem value="dispositivos">Devices UEM</SelectItem>
                  <SelectItem value="pops">Inventario POPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Usuario que cargó</Label>
              <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  {usuariosHistorial.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
              </div>
            </div>
            <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <Checkbox checked={purgarDatos} onCheckedChange={(v) => setPurgarDatos(!!v)} className="mt-0.5" />
              <span>
                Borrar también los <strong>datos cargados</strong> de las tablas correspondientes
                <span className="block text-xs text-muted-foreground">Eliminará líneas, dispositivos o POPS según el tipo seleccionado.</span>
              </span>
            </label>
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              Coinciden <strong>{afectados.length}</strong> de {(historial ?? []).length} registros visibles.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBorrarOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={afectados.length === 0} onClick={() => setConfirmOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Borrar {afectados.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar borrado?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán <strong>{afectados.length}</strong> registros del historial
              {purgarDatos && <> y <strong>todos los datos cargados</strong> de {filtroTipo === "todos" ? "líneas, dispositivos y POPS" : filtroTipo}</>}.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); ejecutarBorrado(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Sí, borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!validation} onOpenChange={(o) => { if (!o && !inserting) setValidation(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {validation?.canContinue ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-[#E26B0A]" />
              )}
              Validación previa — {validation ? GUIDES[validation.tipo].titulo : ""}
            </DialogTitle>
            <DialogDescription>
              Archivo: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{validation?.fileName}</code> · {validation?.totalRows ?? 0} filas detectadas
            </DialogDescription>
          </DialogHeader>

          {validation && (
            <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
              {/* Estado general */}
              {validation.canContinue ? (
                <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
                  <p className="font-medium text-success">El archivo cumple con el formato requerido.</p>
                  <p className="text-xs text-muted-foreground">¿Desea continuar el cargue?</p>
                </div>
              ) : (
                <div className="rounded-md border border-[#E26B0A]/30 bg-[#E26B0A]/10 p-3 text-sm">
                  <p className="font-medium text-[#E26B0A]">Cargue inválido</p>
                  <p className="text-xs text-muted-foreground">Realice los cambios indicados en el Excel y vuelva a intentarlo.</p>
                </div>
              )}

              {/* Correcto */}
              <section>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Correcto
                </h4>
                <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
                  <li>· Filas detectadas: <strong>{validation.totalRows}</strong></li>
                  <li>· Columnas obligatorias presentes: <strong>{validation.presentRequired.length}</strong>{validation.presentRequired.length > 0 && <> ({validation.presentRequired.join(", ")})</>}</li>
                  {validation.presentOptional.length > 0 && (
                    <li>· Columnas opcionales reconocidas: {validation.presentOptional.join(", ")}</li>
                  )}
                </ul>
              </section>

              {/* Por corregir */}
              {(validation.missingRequiredColumns.length > 0 || validation.rowIssues.length > 0 || validation.typeIssues.length > 0 || validation.duplicateIssues.length > 0) && (
                <section>
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <XCircle className="h-4 w-4 text-[#E26B0A]" /> Por corregir
                  </h4>
                  <div className="space-y-2 rounded-md border border-[#E26B0A]/30 bg-[#E26B0A]/5 p-3 text-xs">
                    {validation.missingRequiredColumns.length > 0 && (
                      <div>
                        <p className="font-medium">Columnas obligatorias faltantes:</p>
                        <p className="text-muted-foreground">Agregue las columnas: <strong>{validation.missingRequiredColumns.join(", ")}</strong> con el encabezado exacto.</p>
                      </div>
                    )}
                    {validation.rowIssues.length > 0 && (
                      <div>
                        <p className="font-medium">Filas con campos obligatorios vacíos ({validation.rowIssues.length}):</p>
                        <ul className="ml-4 list-disc text-muted-foreground">
                          {validation.rowIssues.slice(0, 10).map((it) => (
                            <li key={`r-${it.row}`}>Fila {it.row} — completar: {it.fields.join(", ")}</li>
                          ))}
                          {validation.rowIssues.length > 10 && (<li>… y {validation.rowIssues.length - 10} filas más</li>)}
                        </ul>
                      </div>
                    )}
                    {validation.typeIssues.length > 0 && (
                      <div>
                        <p className="font-medium">Errores de tipo o formato ({validation.typeIssues.length}):</p>
                        <ul className="ml-4 list-disc text-muted-foreground">
                          {validation.typeIssues.slice(0, 15).map((it, i) => (
                            <li key={`t-${i}`}>Fila {it.row} · <code className="font-mono">{it.field}</code>: {it.reason}</li>
                          ))}
                          {validation.typeIssues.length > 15 && (<li>… y {validation.typeIssues.length - 15} más</li>)}
                        </ul>
                      </div>
                    )}
                    {validation.duplicateIssues.length > 0 && (
                      <div>
                        <p className="font-medium">Valores duplicados en columnas únicas ({validation.duplicateIssues.length}):</p>
                        <ul className="ml-4 list-disc text-muted-foreground">
                          {validation.duplicateIssues.slice(0, 10).map((d, i) => (
                            <li key={`d-${i}`}><code className="font-mono">{d.field}</code> = <strong>{d.value}</strong> aparece en filas {d.rows.join(", ")}. Deje un único valor por fila.</li>
                          ))}
                          {validation.duplicateIssues.length > 10 && (<li>… y {validation.duplicateIssues.length - 10} más</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Indicaciones */}
              {(validation.unknownColumns.length > 0 || validation.warnings.length > 0) && (
                <section>
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-[#E26B0A]" /> Indicaciones
                  </h4>
                  <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
                    {validation.unknownColumns.length > 0 && (
                      <div>
                        <p>Columnas fuera del formato guía (serán ignoradas al cargar):</p>
                        <p className="mt-1 text-muted-foreground">{validation.unknownColumns.join(", ")}</p>
                      </div>
                    )}
                    {validation.warnings.length > 0 && (
                      <div>
                        <p className="font-medium">Advertencias ({validation.warnings.length}):</p>
                        <ul className="ml-4 list-disc text-muted-foreground">
                          {validation.warnings.slice(0, 10).map((w, i) => (
                            <li key={`w-${i}`}>Fila {w.row} · <code className="font-mono">{w.field}</code>: {w.warn}</li>
                          ))}
                          {validation.warnings.length > 10 && (<li>… y {validation.warnings.length - 10} más</li>)}
                        </ul>
                      </div>
                    )}
                    <p className="pt-1 text-muted-foreground">Recomendaciones para evitar problemas al mostrar los datos: respete los encabezados exactos del template, mantenga los números sin símbolos ($, comas de miles), use fechas en formato <code>YYYY-MM-DD</code>, deje los IMEI/MSISDN/ICCID solo con dígitos, y no repita los identificadores únicos.</p>
                  </div>
                </section>
              )}

            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" disabled={inserting} onClick={() => setValidation(null)}>
              <X className="mr-1.5 h-4 w-4" /> Cerrar
            </Button>
            {validation?.canContinue ? (
              <Button disabled={inserting} onClick={confirmInsert}>
                {inserting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Sí, continuar el cargue
              </Button>
            ) : (
              <Button variant="secondary" disabled={inserting} onClick={() => setValidation(null)}>
                Aceptar y volver a intentar
              </Button>
            )}
          </DialogFooter>
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
  // Append-only: NUNCA borramos la tabla "alertas" — es histórico de auditoría.
  // Deduplicamos contra lo ya existente por fingerprint (tipo|entidad|referencia|mensaje).
  // IMPORTANTE: usamos fetchAll (paginado) porque PostgREST devuelve solo 1000
  // filas por defecto; de lo contrario las alertas se generarían con una muestra
  // parcial de los maestros y la deduplicación compararía contra un histórico incompleto.
  const [existentes, lineas, disp] = await Promise.all([
    fetchAll<any>("alertas", { columns: "tipo,entidad,referencia,mensaje", eq: { user_id: userId } }),
    fetchAll<any>("lineas"),
    fetchAll<any>("dispositivos"),
  ]);
  if (!lineas || !disp) return;
  const fp = (a: { tipo: string; entidad: string | null; referencia: string | null; mensaje: string | null }) =>
    `${a.tipo}|${a.entidad ?? ""}|${a.referencia ?? ""}|${a.mensaje ?? ""}`;
  const seen = new Set((existentes ?? []).map(fp));
  const hoy = Date.now();
  const alerts: any[] = [];
  const pushIfNew = (a: any) => { const k = fp(a); if (!seen.has(k)) { seen.add(k); alerts.push(a); } };
  for (const l of lineas) {
    if (l.ultimo_uso) {
      const days = Math.floor((hoy - new Date(l.ultimo_uso).getTime()) / 86400000);
      if (days > 30) pushIfNew({ user_id: userId, tipo: "sin_uso", severidad: "alta", entidad: "linea", referencia: l.msisdn, mensaje: `${l.msisdn} — ${days} días sin uso`, detalle: l.plan ?? "" });
    }
    if (!l.imei) pushIfNew({ user_id: userId, tipo: "sin_equipo", severidad: "media", entidad: "linea", referencia: l.msisdn, mensaje: `${l.msisdn} — Línea sin equipo asociado`, detalle: l.plan ?? "" });
  }
  const imeisLineas = new Set(lineas.map((l: any) => l.imei).filter(Boolean));
  for (const d of disp) {
    if (d.imei && !imeisLineas.has(d.imei)) {
      pushIfNew({ user_id: userId, tipo: "inconsistencia", severidad: "media", entidad: "dispositivo", referencia: d.imei, mensaje: "IMEI en Devices no existe en Maestro de Líneas", detalle: d.imei });
    }
  }
  if (alerts.length > 0) {
    for (let i = 0; i < alerts.length; i += 500) {
      await supabase.from("alertas").insert(alerts.slice(i, i + 500));
    }
  }
}


