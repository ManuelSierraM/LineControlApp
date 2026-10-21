# Rechazar Excel que no corresponden al cargue de Inventario POPS

## Análisis de los archivos

| Archivo | Columnas que reconoce el formateo POPS | Resultado hoy |
|---|---|---|
| Dispositivos activos POPS (correcto) | Las 7: IMEI, Nº Teléfono, Código Centro, Delegación, Fecha de Alta, Fecha baja, Modelo | Pasa (correcto) |
| ABM PROSEGUR (Maestro de Líneas) | Ninguna | Pasa con todas las columnas vacías |
| DevicesSearchResult UEM | Solo 1: "Model" se toma como Modelo | Pasa con solo el modelo lleno |

**Causa:** en POPS ninguna columna es obligatoria. Por eso, con o sin formateo, cualquier Excel produce filas "válidas" (vacías) y la validación no tiene nada que rechazar. En Líneas y UEM esto no ocurre porque sí tienen columnas obligatorias.

## Qué cambia

1. **Formateo automático activo:** antes de formatear se verifica que el Excel traiga las 7 columnas del original de POPS (con sus nombres conocidos). Si falta alguna, se detiene con un error claro: "Este archivo no corresponde a Inventario POPS. Faltan: …". No se formatea ni se carga.
2. **Formateo automático desactivado:** la validación previa exige que el archivo traiga las 7 columnas de la plantilla ya formateada (IMEI, Numero_Telefono, Centro, Delegación, Fecha_Alta, Fecha_Baja, Modelo). Si falta alguna, bloquea el cargue y las lista.
3. Los valores de cada celda siguen siendo opcionales como hoy (IMEI vacío, centro vacío, etc. se permiten). Solo se exige que las columnas existan.
4. **Archivo sin datos útiles:** si IMEI, Numero_Telefono y Centro vienen vacíos en todas las filas, se rechaza en ambos modos. Así se bloquea también un archivo equivocado pasado por Colab, que crea las columnas vacías.
5. El resultado: el original sin formatear solo entra con el formateo activo; el ABM y el de UEM se rechazan en ambos modos.

## Posibles efectos
- Un archivo POPS ya formateado al que le falte alguna de las 7 columnas dejará de aceptarse.
- Un encabezado escrito de otra forma que no se reconozca hará rechazar el archivo hasta agregar ese nombre.

## Sin cambios
- Los ETLs de Colab no se tocan.
- Las reglas por celda de POPS y los cargues de Líneas y UEM quedan igual.

## Detalles técnicos
- En `src/routes/_app.cargar.tsx`, en `handleUpload`: para `pops`, comprobar con el resumen `EtlRunSummary.faltantes` (ETL activo) o con los encabezados crudos contra `SCHEMAS.pops` (ETL inactivo); si hay faltantes, mostrar error y abortar antes de `validateRequiredFields`.
- Nueva función pura `checkRequiredColumns(headers, columnas)` en `src/lib/` con prueba unitaria: original POPS → OK; encabezados de ABM y de UEM → rechazados.
- Verificación con Playwright subiendo los tres archivos en ambos modos.
