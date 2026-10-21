/** Preserve Excel date cells as dates before applying the approved ETL rules. */
export async function parseExcelUpload(data: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  const sheet = firstSheet ? workbook.Sheets[firstSheet] : undefined;
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}