## Cambios

### 1. `src/routes/_app.cargar.tsx` — Template y mapeo de Maestro de Líneas
- Eliminar la fila `IMEI` del arreglo `GUIDES.lineas.fields` (línea 38). Con esto desaparece automáticamente de:
  - La tarjeta "Formato guía" en la UI.
  - El template Excel descargable (encabezados y nota de obligatoriedad).
  - La validación de columnas requeridas al cargar.
- En el mapeo de filas del Excel de líneas, dejar `imei` como `null` (ya no se intenta leer la columna IMEI desde el origen).
- No se tocan los templates de Devices UEM ni POPS.

### 2. `src/routes/_app.lineas.tsx` — Derivar IMEI desde POPS por coincidencia de teléfono
Hoy la tabla de líneas hace `byImei` con `dispositivos`. El cambio:
- Cargar también `pops` (campos `numero_telefono`, `codigo`).
- Normalizar el teléfono (quitar prefijo `57`, espacios, guiones, `+`) tanto para el `msisdn` de la línea como para `numero_telefono` de POPS, para que casen formatos como `573001234567` ↔ `3001234567`.
- Construir un mapa `popsByPhone: phoneNormalizado → pops.codigo` y usarlo como fuente del IMEI mostrado en la columna "IMEI" cuando `lineas.imei` esté vacío.
- Orden de resolución del IMEI por línea: `lineas.imei` (si existiera de cargas previas) → POPS por teléfono → `"—"`.
- El join con `dispositivos` para `modelo` / `cliente` se mantiene, pero ahora se hace por el IMEI resuelto (línea o POPS), no solo por `lineas.imei`.

### 3. Verificación
- Probar con un Excel real de líneas (sin columna IMEI) + un Excel de POPS que contenga los mismos teléfonos: la tabla de Maestro de Líneas debe mostrar el IMEI traído desde POPS.
- Confirmar que la carga ya no rechaza el archivo por falta de columna IMEI.

## Notas
- No se modifica el esquema de la base de datos: `lineas.imei` sigue existiendo y se respeta si viniera con valor; simplemente ya no se exige en el template.
- Si en el futuro el origen vuelve a incluir IMEI, basta con reintroducir la fila en `GUIDES.lineas.fields`.
- POPS sigue siendo la fuente "oficial" del IMEI por equipo físico, lo cual es consistente con cómo ya se usa `pops.codigo` como IMEI en la vista de POPS.
