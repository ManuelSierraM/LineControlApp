# Valores numéricos enteros en el formateo automático

## Qué cambia
- El formateo automático del cargue entregará los valores numéricos (p. ej. VALOR_CFM en Maestro de Líneas) como **enteros**, redondeados al entero más cercano (`30615.3` -> `30615`, `30615.5` -> `30616`).
- Con esto desaparece el conflicto con la validación previa, que hoy rechaza el punto decimal.
- Montos ya enteros (`$45.000` -> `45000`) quedan igual.

## Qué no cambia
- Los ETLs de Colab descargables no se tocan.
- Teléfonos, IMEI, ICCID y fechas siguen con sus reglas actuales.
- Si se apaga "Aplicar ETL automático", el archivo se valida tal cual llega.

## Detalles técnicos
- `src/lib/etl-runtime.ts`: `limpiarNumero` devuelve `String(Math.round(Number(n.toPrecision(15))))` (el redondeo a 15 cifras evita errores tipo `x.4999999`).
- `src/lib/etl-runtime.test.ts`: actualizar la prueba de VALOR_CFM a `30615.3 -> 30615` y añadir `30615.5 -> 30616`; correr las pruebas.
- Repetir la comparación del Maestro de Líneas: la única diferencia esperada frente a Colab son los decimales redondeados.
