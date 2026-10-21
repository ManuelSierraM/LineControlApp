# ETL automático durante el cargue

## Viabilidad
Alta. Hoy el archivo ya se lee en el navegador antes de validar. Los ETLs de Colab hacen transformaciones simples (renombrar columnas, limpiar teléfono, fechas, dígitos, extraer IMEI del email, filtrar Colombia, recortar Delegación a 6 caracteres, quitar sufijos "(UTC -5)"). Todo eso se puede replicar en TypeScript y ejecutarse en segundos, sin Python ni Colab.

## Flujo nuevo
```text
Usuario sube Excel crudo -> ETL del cargue (automático) -> Validación previa -> Carga
```
1. El usuario arrastra el Excel original (sin formatear) en Líneas, UEM o POPS.
2. Se aplica el ETL correspondiente automáticamente.
3. Se muestra un resumen: columnas reconocidas, columnas faltantes, filas filtradas (p. ej. no-Colombia), campos vaciados por formato inválido.
4. Luego corre la validación previa actual sin cambios.
5. Si el Excel ya viene formateado, el ETL no lo altera (es idempotente).

## Opciones
- Interruptor "Aplicar ETL automático" (activo por defecto) por si se quiere subir un archivo ya limpio tal cual.
- Botón opcional "Descargar Excel formateado" para revisar el resultado.
- Se conserva la descarga del script Colab como respaldo.

## Detalles técnicos
- Nuevo módulo `src/lib/etl-runtime.ts` con funciones `etlLineas`, `etlUem`, `etlPops` que reproducen exactamente `src/lib/etl-script.ts` (mismo mapeo de columnas y limpiadores: texto, teléfono, fecha, dígitos 14–16, número).
- En `src/routes/_app.cargar.tsx`, tras `parseFile` y antes de `validateRequiredFields`/`validateValue`, se llama al ETL del tipo.
- Pruebas unitarias con filas de ejemplo comparando contra los resultados ya aprobados en Colab.
- Archivos muy grandes (>100k filas) se procesan igual en el navegador; puede tardar unos segundos.
