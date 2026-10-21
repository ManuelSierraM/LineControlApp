import { describe, expect, it } from "vitest";
import { allKeyColumnsEmpty, checkRequiredColumns, POPS_FORMATEADO_COLUMNS, POPS_ORIGEN_COLUMNS } from "./upload-columns";

const ORIGINAL = ["Zona gerencial", "Delegación", "Código Centro", "Centro", "IMEI", "Nº Teléfono", "Modelo", "Fecha de Alta", "Fecha baja"];
const ABM = ["OPERADOR", "TELE_NUMB", "TIPO LINEA", "ICCID", "PLAN_DESC", "VLR_CFM"];
const UEM = ["User ID", "Email Address", "Model", "Current Phone Number", "Last Check-In", "Status"];

describe("POPS columnas", () => {
  it("acepta el original con formateo activo", () => expect(checkRequiredColumns(ORIGINAL, POPS_ORIGEN_COLUMNS)).toEqual([]));
  it("rechaza ABM", () => expect(checkRequiredColumns(ABM, POPS_ORIGEN_COLUMNS)).toHaveLength(7));
  it("rechaza UEM aunque traiga Model", () => expect(checkRequiredColumns(UEM, POPS_ORIGEN_COLUMNS)).toHaveLength(7));
  it("sin formateo rechaza el original sin formatear", () => expect(checkRequiredColumns(ORIGINAL, POPS_FORMATEADO_COLUMNS)).toEqual(["Numero_Telefono", "Fecha_Alta"]));
  it("sin formateo acepta el formateado", () => expect(checkRequiredColumns(POPS_FORMATEADO_COLUMNS, POPS_FORMATEADO_COLUMNS)).toEqual([]));
  it("archivo de Colab vuelve igual tras el formateo automático", async () => {
    const { runEtl } = await import("./etl-runtime");
    const spec = { tipo: "pops" as const, titulo: "", archivoSalida: "", dateFormat: "YYYY-MM-DD" as const, fields: [
      { columna: "IMEI", formato: "digitos" as const, minLen: 14, maxLen: 16 },
      { columna: "Numero_Telefono", formato: "telefono" as const },
      { columna: "Centro", formato: "texto" as const },
      { columna: "Delegación", formato: "texto" as const, extraer: "primeros6" as const },
      { columna: "Fecha_Alta", formato: "fecha" as const },
      { columna: "Fecha_Baja", formato: "fecha" as const },
      { columna: "Modelo", formato: "texto" as const },
    ] };
    const row = { IMEI: "356938035643809", Numero_Telefono: "3001234567", Centro: "C123", "Delegación": "C01V0", Fecha_Alta: "2025-04-12", Fecha_Baja: "", Modelo: "TC21" };
    expect(runEtl(spec, [row]).rows[0]).toEqual(row);
  });
  it("detecta archivo sin datos clave", () => {
    expect(allKeyColumnsEmpty([{ IMEI: "", Numero_Telefono: "", Centro: "" }], ["IMEI", "Numero_Telefono", "Centro"])).toBe(true);
    expect(allKeyColumnsEmpty([{ IMEI: "356938035643809", Numero_Telefono: "", Centro: "" }], ["IMEI", "Numero_Telefono", "Centro"])).toBe(false);
  });
});
