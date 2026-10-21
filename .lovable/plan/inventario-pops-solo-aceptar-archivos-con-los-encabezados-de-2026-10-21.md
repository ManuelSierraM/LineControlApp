# Inventario POPS: solo aceptar archivos con los encabezados del original

## Análisis de los archivos

| Archivo | Coincide con los encabezados de "Dispositivos activos POPS" | Resultado hoy |
|---|---|---|
| Dispositivos activos POPS (correcto) | Sí: IMEI, Nº Teléfono, Código Centro, Delegación, Fecha de Alta, Fecha baja, Modelo | Pasa |
| ABM PROSEGUR (Maestro de Líneas) | Ninguno | Pasa con todo vacío |
| DevicesSearchResult UEM | Solo "Model" (se toma como Modelo) | Pasa con solo el modelo |

**Causa:** en POPS ninguna columna es obligatoria, así que cualquier Excel produce filas "válidas".

## Regla nueva
El archivo debe traer **las 7 columnas de origen** de "Dispositivos activos POPS", con esos nombres: IMEI, Nº Teléfono, Código Centro, Delegación, Fecha de Alta, Fecha baja, Modelo. Las demás columnas del original (Zona gerencial, Cliente, MAC, etc.) se pueden incluir o no. Se aceptan diferencias de mayúsculas, tildes y espacios.

- **Formateo automático activo:** si falta alguno de esos encabezados, se detiene con el error "Este archivo no corresponde a Inventario POPS. Faltan: …". No se formatea ni se carga.
- **Formateo automático desactivado:** se exigen los 7 encabezados que entrega el formateo de ese mismo original (IMEI, Numero_Telefono, Centro, Delegación, Fecha_Alta, Fecha_Baja, Modelo). El original sin formatear, el ABM y el de UEM se rechazan.
- Se quitan los nombres alternativos genéricos que no vienen en el original ("TELEFONO", "MODEL", etc.), para que no se cuele un archivo de otro cargue.
- Los valores de cada celda siguen siendo opcionales como hoy.

## Posibles efectos
- Si en el futuro el sistema POPS cambia el nombre de una columna, el cargue se rechazará hasta actualizar la regla.
- Un archivo de Colab generado desde un Excel equivocado trae las columnas vacías; también se rechaza si IMEI, Numero_Telefono y Centro vienen vacíos en todas las filas.

## Sin cambios
- Los ETLs de Colab no se tocan.
- Líneas y UEM quedan igual.

## Detalles técnicos
- `src/routes/_app.cargar.tsx`: en `handleUpload`, para `pops`, comprobar encabezados crudos contra la lista de origen (ETL activo) o contra `SCHEMAS.pops` (ETL inactivo) antes de `runEtl`/`validateRequiredFields`; reducir `ETL_ALIASES.pops` a los nombres exactos del original.
- Función pura `checkRequiredColumns(headers, columnas)` en `src/lib/` con prueba: original POPS acepta; encabezados ABM y UEM rechazan.
- Verificación con Playwright subiendo los tres archivos en ambos modos.
