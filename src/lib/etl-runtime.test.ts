import { describe, it, expect } from "vitest";
import { runEtl, limpiarTelefono, limpiarFecha, limpiarDigitos, limpiarNumero } from "./etl-runtime";

describe("ETL runtime (equivalente al script de Colab)", () => {
  it("quita indicativo +57 del teléfono", () => expect(limpiarTelefono("+57 300 123 4567")).toBe("3001234567"));
  it("quita sufijo (UTC -5) y formatea DD-MM-YYYY", () => expect(limpiarFecha("12/04/2025 10:00 (UTC -5)", "DD-MM-YYYY")).toBe("12-04-2025"));
  it("vacía IMEI fuera de 14–16 dígitos", () => expect(limpiarDigitos("12345", 14, 16)).toBe(""));
  it("número 45.000 -> 45000", () => expect(limpiarNumero("$45.000")).toBe("45000"));

  it("UEM: filtra Colombia y extrae IMEI antes del @", () => {
    const { rows } = runEtl(
      { tipo: "dispositivos", titulo: "", archivoSalida: "", dateFormat: "DD-MM-YYYY",
        filtro: { columna: "Home Country Name", alias: ["País"], valor: "Colombia" },
        fields: [{ columna: "IMEI", formato: "digitos", alias: ["Email Address"], extraer: "antes_arroba", minLen: 14, maxLen: 16 }] },
      [{ "Email Address": "357974102217747@prosegur.com", "Home Country Name": "Colombia" },
       { "Email Address": "357974102217748@prosegur.com", "Home Country Name": "Peru" }],
    );
    expect(rows).toEqual([{ IMEI: "357974102217747" }]);
  });

  it("POPS: Delegación conserva primeros 6 caracteres", () => {
    const { rows } = runEtl(
      { tipo: "pops", titulo: "", archivoSalida: "", dateFormat: "YYYY-MM-DD",
        fields: [{ columna: "Delegación", formato: "texto", extraer: "primeros6" }] },
      [{ "Delegacion": "C01V0 - Bogotá" }],
    );
    expect(rows[0]["Delegación"]).toBe("C01V0 ");
  });
});
