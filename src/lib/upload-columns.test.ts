import { describe, expect, it } from "vitest";
import { allKeyColumnsEmpty, checkRequiredColumns, POPS_FORMATEADO_COLUMNS, POPS_ORIGEN_COLUMNS } from "./upload-columns";

const ORIGINAL = ["Zona gerencial", "Delegación", "Código Centro", "Centro", "IMEI", "Nº Teléfono", "Modelo", "Fecha de Alta", "Fecha baja"];
const ABM = ["OPERADOR", "TELE_NUMB", "TIPO LINEA", "ICCID", "PLAN_DESC", "VLR_CFM"];
const UEM = ["User ID", "Email Address", "Model", "Current Phone Number", "Last Check-In", "Status"];

describe("POPS columnas", () => {
  it("acepta el original con formateo activo", () => expect(checkRequiredColumns(ORIGINAL, POPS_ORIGEN_COLUMNS)).toEqual([]));
  it("rechaza ABM", () => expect(checkRequiredColumns(ABM, POPS_ORIGEN_COLUMNS)).toHaveLength(7));
  it("rechaza UEM aunque traiga Model", () => expect(checkRequiredColumns(UEM, POPS_ORIGEN_COLUMNS)).toHaveLength(7));
  it("sin formateo rechaza el original sin formatear", () => expect(checkRequiredColumns(ORIGINAL, POPS_FORMATEADO_COLUMNS)).toEqual(["Numero_Telefono", "Fecha_Alta", "Fecha_Baja"]));
  it("sin formateo acepta el formateado", () => expect(checkRequiredColumns(POPS_FORMATEADO_COLUMNS, POPS_FORMATEADO_COLUMNS)).toEqual([]));
  it("detecta archivo sin datos clave", () => {
    expect(allKeyColumnsEmpty([{ IMEI: "", Numero_Telefono: "", Centro: "" }], ["IMEI", "Numero_Telefono", "Centro"])).toBe(true);
    expect(allKeyColumnsEmpty([{ IMEI: "356938035643809", Numero_Telefono: "", Centro: "" }], ["IMEI", "Numero_Telefono", "Centro"])).toBe(false);
  });
});
