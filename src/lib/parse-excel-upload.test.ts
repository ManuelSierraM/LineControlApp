import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelUpload } from "./parse-excel-upload";
import { runEtl } from "./etl-runtime";

describe("Devices UEM Excel input", () => {
  it("formats Last_CheckIn as DD-MM-YYYY when Excel stores a date with time", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Email Address", "Last Check-In", "Home Country Name"],
      ["357974102217747@empresa.com", 45759.625, "Colombia"],
    ]);
    sheet.B2.z = "m/d/yy h:mm";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Devices");
    const parsed = await parseExcelUpload(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
    const { rows } = runEtl({
      tipo: "dispositivos", titulo: "Devices UEM", archivoSalida: "Devices.xlsx", dateFormat: "DD-MM-YYYY",
      filtro: { columna: "Home Country Name", alias: ["País"], valor: "Colombia" },
      fields: [
        { columna: "IMEI", alias: ["Email Address"], formato: "digitos", extraer: "antes_arroba", minLen: 14, maxLen: 16 },
        { columna: "Last_CheckIn", alias: ["Last Check-In"], formato: "fecha" },
      ],
    }, parsed);
    expect(rows).toEqual([{ IMEI: "357974102217747", Last_CheckIn: "12-04-2025" }]);
  });
});