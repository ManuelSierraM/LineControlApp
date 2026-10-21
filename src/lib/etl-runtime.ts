// Ejecución en el navegador del mismo ETL que genera `etl-script.ts` para Colab.
// Recibe el mismo EtlSpec y replica paso a paso la lógica del script Python
// (filtro, emparejamiento de columnas, extracción y limpiadores). No modifica
// el script de Colab: es una copia equivalente que corre durante el cargue.
import type { EtlField, EtlSpec } from "./etl-script";

const COUNTRY_CODES = [
  "1","7","20","27","30","31","32","33","34","36","39","40","41","43","44","45","46","47","48","49",
  "51","52","53","54","55","56","57","58","60","61","62","63","64","65","66","81","82","84","86","90",
  "91","92","93","94","95","98","211","212","213","216","218","220","221","222","223","224","225","226",
  "227","228","229","230","231","232","233","234","235","236","237","238","239","240","241","242","243",
  "244","245","246","247","248","249","250","251","252","253","254","255","256","257","258","260","261",
  "262","263","264","265","266","267","268","269","290","291","297","298","299","350","351","352","353",
  "354","355","356","357","358","359","370","371","372","373","374","375","376","377","378","380","381",
  "382","383","385","386","387","389","420","421","423","500","501","502","503","504","505","506","507",
  "508","509","590","591","592","593","594","595","596","597","598","599","670","672","673","674","675",
  "676","677","678","679","680","681","682","683","685","686","687","688","689","690","691","692","850",
  "852","853","855","856","880","886","960","961","962","963","964","965","966","967","968","970","971",
  "972","973","974","975","976","977","992","993","994","995","996",
];
const SORTED_CODES = [...COUNTRY_CODES].sort((a, b) => b.length - a.length || Number(b) - Number(a));

export function etlNormKey(s: unknown): string {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toStr(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  if (typeof v === "number") {
    if (Number.isInteger(v)) return BigInt(Math.round(v)).toString();
    return String(v);
  }
  return String(v);
}

export function limpiarTexto(v: unknown): string {
  let s = toStr(v).trim();
  if (["nan", "none", "nat"].includes(s.toLowerCase())) return "";
  if (/^-?\d+\.0$/.test(s)) s = s.slice(0, -2);
  return s;
}

export function limpiarTelefono(v: unknown): string {
  const s = limpiarTexto(v);
  if (!s) return "";
  if (/[a-zA-Z]/.test(s)) return s;
  let digits = s.replace(/\D/g, "");
  if (!digits) return "";
  const explicito = s.startsWith("+") || s.startsWith("00");
  if (s.startsWith("00")) digits = digits.slice(2);
  if (!explicito && digits.length <= 10) return digits;
  for (const code of SORTED_CODES) {
    if (digits.startsWith(code) && digits.length > code.length) {
      const resto = digits.slice(code.length);
      if (resto.length >= 7 && resto.length <= 12) return resto;
    }
  }
  return digits;
}

function validYMD(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? dt : null;
}

function parseFecha(s: string, dayfirst: boolean): Date | null {
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (m) return validYMD(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T,].*)?$/);
  if (m) {
    let y = +m[3];
    if (m[3].length === 2) y += y < 70 ? 2000 : 1900;
    return dayfirst ? validYMD(y, +m[2], +m[1]) : validYMD(y, +m[1], +m[2]);
  }
  const t = Date.parse(s);
  if (!isNaN(t)) {
    const d = new Date(t);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return null;
}

export function limpiarFecha(v: unknown, formato: EtlSpec["dateFormat"]): string {
  let s = limpiarTexto(v);
  if (!s) return "";
  s = s.replace(/\s*\(UTC[^)]*\)/g, "").trim();
  let ts: Date | null;
  if (/^\d{5}$/.test(s)) ts = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
  else ts = parseFecha(s, true) ?? parseFecha(s, false);
  if (!ts) return s;
  const p = (n: number) => String(n).padStart(2, "0");
  const dd = p(ts.getUTCDate()), mm = p(ts.getUTCMonth() + 1), yy = ts.getUTCFullYear();
  return formato === "DD-MM-YYYY" ? `${dd}-${mm}-${yy}` : `${yy}-${mm}-${dd}`;
}

export function limpiarDigitos(v: unknown, minLen?: number, maxLen?: number): string {
  let s = limpiarTexto(v);
  if (!s) return "";
  if (/[eE]\+/.test(s)) {
    const n = Number(s);
    if (!isNaN(n)) s = BigInt(Math.round(n)).toString();
  }
  s = s.replace(/\D/g, "");
  if (!s) return "";
  if (minLen != null && s.length < minLen) return "";
  if (maxLen != null && s.length > maxLen) return "";
  return s;
}

export function limpiarNumero(v: unknown): string {
  let s = limpiarTexto(v);
  if (!s) return "";
  s = s.replace(/[^0-9,.\-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(/,/g, ".");
  else if (s.includes(",")) s = s.replace(/,/g, ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (s === "" || isNaN(Number(s))) return "";
  // Quita residuos de coma flotante (15 cifras) y entrega entero, mejor para cálculos de precios.
  return String(Math.round(Number(Number(s).toPrecision(15))));
}

function limpiar(f: EtlField, v: unknown, spec: EtlSpec): string {
  switch (f.formato ?? "texto") {
    case "telefono": return limpiarTelefono(v);
    case "fecha": return limpiarFecha(v, spec.dateFormat);
    case "digitos": return limpiarDigitos(v, f.minLen, f.maxLen);
    case "numero": return limpiarNumero(v);
    default: return limpiarTexto(v);
  }
}

export type EtlRunSummary = {
  filasLeidas: number;
  filasSalida: number;
  filtro?: { columna: string | null; valor: string; conservadas: number; antes: number };
  reconocidas: string[];
  faltantes: string[];
  vaciados: Record<string, number>;
};

export function runEtl(spec: EtlSpec, input: Record<string, unknown>[]): { rows: Record<string, string>[]; summary: EtlRunSummary } {
  let df = input;
  const headers = Array.from(new Set(input.flatMap((r) => Object.keys(r))));
  const summary: EtlRunSummary = { filasLeidas: input.length, filasSalida: 0, reconocidas: [], faltantes: [], vaciados: {} };

  if (spec.filtro) {
    const llaves = [spec.filtro.columna, ...spec.filtro.alias].map(etlNormKey);
    const col = headers.find((h) => llaves.includes(etlNormKey(h))) ?? null;
    const antes = df.length;
    if (col) {
      const val = spec.filtro.valor.trim().toLowerCase();
      df = df.filter((r) => toStr(r[col]).trim().toLowerCase() === val);
    }
    summary.filtro = { columna: col, valor: spec.filtro.valor, antes, conservadas: df.length };
  }

  const alias = new Map<string, string>();
  for (const f of spec.fields) {
    if (!alias.has(etlNormKey(f.columna))) alias.set(etlNormKey(f.columna), f.columna);
    for (const a of f.alias ?? []) if (!alias.has(etlNormKey(a))) alias.set(etlNormKey(a), f.columna);
  }
  const origen = new Map<string, string>();
  for (const h of headers) {
    const dest = alias.get(etlNormKey(h));
    if (dest && !origen.has(dest)) origen.set(dest, h);
  }
  summary.reconocidas = spec.fields.filter((f) => origen.has(f.columna)).map((f) => f.columna);
  summary.faltantes = spec.fields.filter((f) => !origen.has(f.columna)).map((f) => f.columna);

  const rows = df.map((r) => {
    const out: Record<string, string> = {};
    for (const f of spec.fields) {
      const src = origen.get(f.columna);
      let v: unknown = src ? r[src] : "";
      if (f.extraer === "antes_arroba") { const s = toStr(v); v = s.includes("@") ? s.split("@")[0] : s; }
      if (f.extraer === "primeros6") v = toStr(v).trim().slice(0, 6);
      const res = limpiar(f, v, spec);
      if (res === "" && limpiarTexto(v) !== "") summary.vaciados[f.columna] = (summary.vaciados[f.columna] ?? 0) + 1;
      out[f.columna] = res;
    }
    return out;
  });
  summary.filasSalida = rows.length;
  return { rows, summary };
}
