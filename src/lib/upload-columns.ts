import { etlNormKey } from "./etl-runtime";

/** Encabezados de origen del Excel "Dispositivos activos POPS". */
export const POPS_ORIGEN_COLUMNS = ["IMEI", "Nº Teléfono", "Código Centro", "Delegación", "Fecha de Alta", "Fecha baja", "Modelo"];
/** Encabezados que entrega el formateo de ese mismo original. */
export const POPS_FORMATEADO_COLUMNS = ["IMEI", "Numero_Telefono", "Centro", "Delegación", "Fecha_Alta", "Fecha_Baja", "Modelo"];

/** Devuelve las columnas requeridas que no aparecen (ignora tildes, mayúsculas, espacios y símbolos). */
export function checkRequiredColumns(headers: string[], columnas: string[]): string[] {
  const have = new Set(headers.map(etlNormKey));
  return columnas.filter((c) => !have.has(etlNormKey(c)));
}

/** True si todas las filas tienen vacías las columnas clave. */
export function allKeyColumnsEmpty(rows: Record<string, unknown>[], columnas: string[]): boolean {
  return rows.every((r) => columnas.every((c) => String(r[c] ?? "").trim() === ""));
}
