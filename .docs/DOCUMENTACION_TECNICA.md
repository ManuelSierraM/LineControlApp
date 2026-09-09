# Documentación Técnica — LineControl

> Sistema de gestión y control de inventario de líneas móviles, dispositivos UEM y POPS, con cargas masivas, alertas y reportes.

- **Versión:** 1.0.0
- **Fecha:** 2026-09-09
- **Estándar de referencia:** IEEE 1016 (Software Design Description) / ISO/IEC/IEEE 42010 (arquitectura).
- **URL Producción:** https://linecontrolapp.lovable.app
- **URL Preview:** https://id-preview--66349ba0-d459-4da3-aff9-88c619c55c5b.lovable.app

---

## 1. Propósito y Alcance

LineControl centraliza la operación de telefonía móvil corporativa: maestro de líneas (MSISDN/ICCID), dispositivos UEM (IMEI), POPS, cargas masivas de archivos, motor de alertas y administración de usuarios. La aplicación se distribuye como una SPA con SSR ligero y backend serverless gestionado.

### 1.1 Alcance funcional
- Autenticación (email/contraseña + Google OAuth + recuperación) y control de acceso por roles (`admin`, `supervisor`, `operador`).
- Maestros: Líneas, Dispositivos UEM, POPS.
- Cargas masivas con validación previa, plantillas descargables, scripts ETL para Google Colab e historial trazable.
- Borrado filtrado del historial de cargas restringido al rol `admin`.
- Alertas funcionales con severidad, trazabilidad, deduplicación y resolución.
- Dashboard con KPIs, gráficos y listados.
- Reportes consolidados con separación último cargue / histórico.
- Administración de usuarios, roles y activación/inactivación de cuentas.
- Modo oscuro completo, sincronizado con la paleta del modo claro.

### 1.2 Fuera de alcance
- Integración con APIs de operadores en tiempo real (placeholder).
- Facturación electrónica.

---

## 2. Arquitectura

### 2.1 Stack tecnológico
| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework Full-stack | TanStack Start | v1 |
| UI | React | 19 |
| Build | Vite | 7 |
| Lenguaje | TypeScript (strict) | 5.x |
| Estilos | Tailwind CSS | v4 (CSS-first) |
| Componentes | shadcn/ui + Radix | — |
| Estado servidor | TanStack Query | v5 |
| Backend (BaaS) | Lovable Cloud (Supabase compatible) | — |
| DB | PostgreSQL | 15+ |
| Runtime servidor | Cloudflare Workers (workerd, nodejs_compat) | — |

### 2.2 Vista de despliegue
```text
Browser (SPA + SSR hidratada)
        │ HTTPS
        ▼
Cloudflare Worker (TanStack Start)
   ├─ Rutas página (src/routes/*.tsx)
   ├─ Server Functions (createServerFn)
   └─ Rutas API públicas (src/routes/api/public/*)
        │
        ▼
Lovable Cloud
   ├─ Auth (JWT, email/password + Google OAuth)
   ├─ PostgreSQL + RLS
   └─ Storage (no usado actualmente)
```

### 2.3 Patrones aplicados
- **File-based routing** plano con prefijos `_app.*` para layout autenticado.
- **Server Functions tipadas** (`createServerFn`) para lógica privilegiada; nunca claves de servicio en el bundle del cliente.
- **RLS por usuario** con función `SECURITY DEFINER` `has_role()` para evitar recursión.
- **Cliente Supabase navegador** para queries comunes con RLS aplicada.
- **Separación de roles** mediante tabla `user_roles` (nunca columna en `profiles`).
- **Deduplicación** por llave de negocio en lecturas, conservando el registro más reciente (`created_at`).
- **Paginación cliente** configurable en tablas grandes para optimizar renderizado.
- **Fetch-all** con ventana de rangos para superar el límite de 1 000 filas de PostgREST.

---

## 3. Modelo de Seguridad

### 3.1 Autenticación
- Email + contraseña con persistencia en `localStorage`.
- Google OAuth configurado en Lovable Cloud.
- Flujo de recuperación de contraseña vía link mágico (`/forgot-password` → `/reset-password`).
- Toggle de visualización de caracteres en todos los inputs sensibles.

### 3.2 Autorización (RBAC)
Tres roles definidos en el ENUM `app_role`:
- `admin` — gestión total, único con permiso de borrado de archivos de carga, gestión de usuarios y activación/inactivación de cuentas.
- `supervisor` — visualización transversal + cargas.
- `operador` (default al registrarse) — cargas y consulta de sus propios datos.

### 3.3 Bloqueo por ausencia de roles
Si a un usuario autenticado se le quitan todos los roles, la aplicación muestra una pantalla bloqueante **“Sin permisos activos”** que reemplaza el contenido y ofrece cerrar sesión. La detección usa suscripción realtime + polling de 15 s.

### 3.4 Activación / inactivación de usuarios
La tabla `profiles` incluye el campo `active` (boolean). Un `admin` puede desactivar una cuenta; el sistema desloguea al usuario en tiempo real mediante:
- Intervalo de 15 s que consulta `profiles.active`.
- Canal realtime `postgres_changes` sobre `profiles`.

### 3.5 Row Level Security
- RLS habilitada en **todas** las tablas de `public`.
- Patrón: `auth.uid() = user_id` para datos propios; `public.has_role(auth.uid(), 'admin')` para acceso transversal.
- `GRANT` explícitos por tabla a `authenticated` y `service_role`. Sin `anon`.
- El `DELETE` sobre `public.archivos_carga` está restringido exclusivamente al rol `admin`.

### 3.6 Funciones SECURITY DEFINER
| Objeto | Tipo | Disparador | Propósito |
|---|---|---|---|
| `handle_new_user()` | SECURITY DEFINER | AFTER INSERT ON `auth.users` | Crea `profiles` |
| `assign_default_role()` | SECURITY DEFINER | AFTER INSERT ON `auth.users` | Asigna rol `operador` |
| `has_role(uuid, app_role)` | SECURITY DEFINER STABLE | invocada en políticas | Evita recursión RLS |

> Hallazgo del linter `0029` marcado como **ignorado** con justificación técnica en la `@security-memory`.

---

## 4. Modelo de Datos

### 4.1 Convenciones físicas
- PK: `id uuid DEFAULT gen_random_uuid()`.
- Auditoría mínima: `created_at timestamptz DEFAULT now()`.
- Propiedad: `user_id uuid NOT NULL` en toda tabla de negocio.
- Tipos monetarios: `numeric` (no `float`).
- Fechas operativas: `date`; marcas técnicas: `timestamptz`.

### 4.2 Tablas

#### `profiles`
Perfil 1:1 con `auth.users`. PK = `auth.users.id`.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| id | uuid | NO | PK / FK lógica → `auth.users(id)` |
| email | text | SI | |
| full_name | text | SI | |
| active | bool | NO | default `true`; controla acceso a la app |
| created_at | timestamptz | NO | default `now()` |

#### `user_roles`
| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| id | uuid | NO | PK |
| user_id | uuid | NO | FK → `auth.users(id)` ON DELETE CASCADE |
| role | app_role | NO | ENUM |
| created_at | timestamptz | NO | |
| **UNIQUE** | | | `(user_id, role)` |

#### `dispositivos`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | propietario |
| imei | text NOT NULL | identificador lógico; repetidos permitidos (alerta `IMEI duplicado`) |
| modelo, fabricante, so, estado, asignado_a, numero_telefono | text | `estado` default `enrolado` |
| ultimo_checkin | date | |
| created_at | timestamptz | |

#### `lineas`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| msisdn | text NOT NULL | número de la línea (obligatorio) |
| imei | text | FK lógica → `dispositivos.imei` |
| iccid, plan, operador, cod_empresa, nombre_cliente, estado | text | |
| centro_costo | text | texto libre de centro de costo |
| costo_mensual, valor_plan, valor_datos, consumo_mb | numeric | default 0 |
| ultimo_uso | date | |
| created_at | timestamptz | |

#### `pops`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| codigo | text NOT NULL | IMEI o identificador del POPS |
| modelo, numero_telefono, ubicacion, estado | text | |
| centro_costo | text | texto libre |
| fecha_alta, fecha_baja | date | |
| created_at | timestamptz | |

#### `archivos_carga`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | usuario que realizó la carga |
| nombre, tipo | text NOT NULL | `tipo`: `lineas` \| `dispositivos` \| `pops` |
| registros | int | default 0 |
| estado | text | default `completado` |
| created_at | timestamptz | |

#### `alertas`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| tipo | text NOT NULL | categoría de alerta |
| severidad | text | default `media` |
| entidad, referencia, mensaje, detalle | text | |
| resuelta | bool | default `false` |
| created_at | timestamptz | |

### 4.3 Relaciones (Diagrama ER físico)

> El diagrama formal se entrega como artefacto Mermaid: `diagrama_er_fisico.mmd`.

```text
auth.users (1) ──┬── (1)  profiles
                 ├── (N)  user_roles            [UQ user_id+role]
                 ├── (N)  dispositivos          (user_id)
                 ├── (N)  lineas                (user_id)
                 ├── (N)  pops                  (user_id)
                 ├── (N)  archivos_carga        (user_id)
                 └── (N)  alertas               (user_id)

dispositivos (1) ─────< lineas    [join lógico por IMEI]
lineas (1) ───────────< pops      [join lógico por número de teléfono]
```

> **Nota:** Las relaciones son **referenciales lógicas** (no FKs físicas) porque los datos provienen de cargas masivas heterogéneas que deben tolerar inconsistencias temporales. La integridad se valida a nivel aplicación y se materializan alertas cuando falla.

### 4.4 ENUMs
```sql
CREATE TYPE app_role AS ENUM ('admin', 'supervisor', 'operador');
```

### 4.5 Funciones y Triggers
| Objeto | Tipo | Disparador | Propósito |
|---|---|---|---|
| `handle_new_user()` | SECURITY DEFINER | AFTER INSERT ON `auth.users` | Crea `profiles` |
| `assign_default_role()` | SECURITY DEFINER | AFTER INSERT ON `auth.users` | Asigna rol `operador` |
| `has_role(uuid, app_role)` | SECURITY DEFINER STABLE | invocada en políticas | Evita recursión RLS |

---

## 5. Estructura del Código Fuente

```text
src/
├── routes/
│   ├── __root.tsx                # Shell HTML + providers
│   ├── index.tsx                 # Landing (público)
│   ├── login.tsx                 # Login + toggle de contraseña + Google OAuth
│   ├── forgot-password.tsx       # Solicitud de reset
│   ├── reset-password.tsx        # Nueva contraseña + toggle
│   ├── _app.tsx                  # Layout autenticado (sidebar) + bloqueo sin roles
│   ├── _app.index.tsx            # Dashboard
│   ├── _app.lineas.tsx           # Maestro Líneas
│   ├── _app.dispositivos.tsx     # Maestro Dispositivos UEM
│   ├── _app.pops.tsx             # Maestro POPS
│   ├── _app.cargar.tsx           # Cargas masivas + historial + borrado admin-only
│   ├── _app.alertas.tsx          # Alertas
│   ├── _app.reportes.tsx         # Reportes
│   └── _app.admin.tsx            # Administración de usuarios y roles
├── lib/
│   ├── auth.tsx                  # Contexto de sesión + auto-logout por desactivación
│   ├── roles.tsx                 # Contexto de roles + polling + pantalla sin permisos
│   ├── theme.tsx                 # Tema claro/oscuro
│   ├── utils.ts                  # Utilidades: cn, normalización telefónica, validación IMEI
│   ├── fetch-all.ts              # Recuperación de >1000 filas vía rangos
│   ├── etl-script.ts             # Generador de scripts ETL Python para Google Colab
│   └── user-admin.functions.ts   # Server fn: activar/inactivar usuario
├── components/
│   ├── AppSidebar.tsx
│   ├── DataTable.tsx             # Tabla paginada, ordenable, exportable
│   └── PageHeader.tsx
└── integrations/supabase/        # AUTO-GENERADO — no editar
```

---

## 6. Flujo de Cargas Masivas y Validación

### 6.1 Tipos de carga soportados
| Tipo | Archivo guía | Registros |
|---|---|---|
| `lineas` | `Maestro_Lineas.xlsx` | Líneas móviles corporativas |
| `dispositivos` | `Devices_Master.csv` | Dispositivos UEM |
| `pops` | `POPS_Inventory.xlsx` | Puntos operativos |

### 6.2 Validación previa al cargue
La validación se ejecuta en cliente antes de insertar registros. Cada tipo tiene un `SCHEMA` de `FieldRule` que define:
- Obligatoriedad (`required`).
- Tipo: `text`, `digits`, `number`, `date`, `email`.
- Longitudes mínimas/máximas.
- Rangos numéricos.
- Normalización telefónica (`phone`, `phone-strict`).
- Modo estricto (`strict`) para rechazar letras/símbolos en campos de dígitos.

#### Maestro de Líneas
| Columna | Requerido | Tipo / Reglas |
|---|---|---|
| OPERADOR | Sí | Texto, máx. 50 |
| TIPO_DE_LINEA | No | Texto, máx. 50 |
| TELE_NUMB | Sí | MSISDN; se quita indicativo de país de cualquier país si viene explícito (+ / 00) o si supera 10 dígitos |
| NOMBRE_CLIENTE | No | Texto, máx. 100 |
| Cod Empresa | No | Texto, máx. 30 |
| ICCID | Sí | Solo dígitos, 18–22 caracteres |
| PLAN_DESC | No | Texto, máx. 250 |
| VALOR_CFM | Sí | Número ≥ 0 |

#### Devices UEM
| Columna | Requerido | Tipo / Reglas |
|---|---|---|
| IMEI | Sí | Solo dígitos, 14–16 caracteres; repetidos permitidos |
| Modelo | No | Texto, máx. 60 |
| Número_Teléfono | No | Texto libre; se normaliza quitando indicativo de país; se conservan letras/símbolos para la alerta “Sin línea asociada” |
| Last_CheckIn | Sí | Fecha DD-MM-YYYY |
| Estado_UEM | Sí | Texto, máx. 30 |
| País | No | Texto, máx. 40 |
| Usuario | No | Texto / correo, máx. 120 |

#### Inventario POPS
| Columna | Requerido | Tipo / Reglas |
|---|---|---|
| IMEI | No | Solo dígitos puros (sin letras ni símbolos), 14–16 caracteres; se deja vacío si no cumple |
| Numero_Telefono | No | Texto libre; se normaliza quitando indicativo de país |
| Centro | No | Texto libre |
| Delegación | No | Texto libre |
| Fecha_Alta | No | Fecha YYYY-MM-DD |
| Fecha_Baja | No | Fecha YYYY-MM-DD |
| Modelo | No | Texto libre |

### 6.3 Plantillas descargables
Desde la sección **Cargar Archivos** se descarga un template Excel/CSV con:
- Las columnas exactas del schema.
- Encabezados resaltados en naranja para campos obligatorios.
- Fila de ejemplo con valores representativos.

### 6.4 Scripts ETL para Google Colab
`src/lib/etl-script.ts` genera un script Python independiente por tipo de carga. Cada script:
- Lee el archivo origen del usuario.
- Busca columnas por alias normalizados (ignora tildes, espacios, mayúsculas).
- Aplica limpieza: texto, teléfono, fecha, dígitos, número.
- NO elimina filas; deja campos inválidos vacíos para que la validación previa los detecte.
- Descarga el archivo formateado listo para subir a LineControl.

Aliases soportados (ejemplos):
- Líneas: `TIPO LINEA → TIPO_DE_LINEA`, `VLR_CFM → VALOR_CFM`.
- UEM: `Email Address → IMEI` (extrae texto a la izquierda de `@`), `Current Phone Number → Número_Teléfono`, filtra `Home Country Name = Colombia`.
- POPS: `Nº Teléfono → Numero_Telefono`, `Código Centro → Centro`, `Delegación → Delegación` (primeros 6 caracteres).

### 6.5 Historial de cargas y borrado
- Todo usuario autenticado puede consultar el historial.
- Solo `admin` puede abrir el modal de borrado.
- Filtros de borrado: tipo de carga, rango de fechas, usuario específico.
- Confirmación explícita antes de ejecutar el `DELETE`.
- Al borrar un registro de `archivos_carga` se eliminan también los datos asociados del maestro correspondiente.

---

## 7. Motor de Alertas

### 7.1 Tipos de alerta
| Alerta | Origen | Condición |
|---|---|---|
| `Sin línea asociada` | UEM / POPS | Registro con IMEI/código válido pero sin número telefónico válido. En UEM solo se evalúan estados `ACTIVE` o `WIPE_PENDING` (case-insensitive). |
| `IMEI duplicado` | UEM | Mismo `imei` en más de un registro. |
| `POPS sin centro` | POPS | `centro_costo` vacío/nulo y `codigo` (IMEI) numérico de 14–16 dígitos. |
| `Líneas POPS Inconsistentes` | POPS | `numero_telefono` contiene letras, caracteres especiales o indicativos de país; o no coincide con una línea/UEM; considera actividad de hasta 15 días. |
| `Sin uso` | Líneas | Líneas sin consumo o check-in reciente; incluye columna `estado`. |

### 7.2 Deduplicación
- Las alertas se regeneran a partir de los datos cargados en cada cargue.
- Se eliminan duplicados globales conservando el registro más reciente por `created_at`.
- Se usa un `fingerprint` para evitar alertas idénticas consecutivas (append-only).

### 7.3 Severidad
- `alta`, `media`, `baja`.
- Las alertas pueden marcarse como resueltas desde el módulo **Alertas**.

---

## 8. Dashboard y Reportes

### 8.1 Dashboard
- KPIs: total líneas, total dispositivos, alertas abiertas, últimas cargas.
- Los conteos deduplican por llave de negocio (`msisdn`, `imei`) y conservan el registro más reciente.
- Gráficos:
  - **Alertas de Dispositivos:** muestra categorías con datos > 0; incluye `POPS sin centro`, `Sin línea asociada`, `IMEI duplicado`, `Líneas POPS Inconsistentes`.
  - **Ahorro Potencial por Categoría:** filtra categorías con valor > 0; muestra estado vacío cuando no hay ahorro.
- **Top Líneas con mayor impacto económico:** muestra todas las líneas con impacto (no top 10), con columna `Plan` y totales de facturación/costos.
- Tooltips enriquecidos con el nombre de la alerta/tabla referenciada.

### 8.2 Reportes
- **Alertas actuales:** alertas generadas en la ventana temporal del último cargue (últimos 10 minutos).
- **Histórico de alertas:** alertas generadas en cargues anteriores a la ventana de 10 minutos.
- Filtros por tipo, severidad, estado y fechas.

---

## 9. Estándares de Desarrollo

- **TypeScript strict**: cero `any` salvo límites de integración justificados.
- **Lint/format**: ESLint + Prettier (`.prettierrc`, `eslint.config.js`).
- **Naming**: componentes `PascalCase`, hooks `useCamelCase`, archivos de ruta en minúsculas.
- **Tokens semánticos**: colores y tipografía vía `src/styles.css`; prohibido `text-white`, `bg-[#xxx]` directos.
- **Modo oscuro**: tokens `.dark` en `src/styles.css` mantenidos en sincronía con `:root`.
- **Errores de ruta**: toda ruta con `loader` define `errorComponent` y `notFoundComponent`.
- **Migraciones**: cada `CREATE TABLE public.*` va acompañada de `GRANT` + `ENABLE RLS` + `POLICY` en la misma migración.

---

## 10. Operación

### 10.1 Variables de entorno
| Ámbito | Variable | Uso |
|---|---|---|
| Cliente (Vite) | `VITE_SUPABASE_URL` | endpoint público |
| Cliente | `VITE_SUPABASE_PUBLISHABLE_KEY` | clave anónima |
| Servidor | `SUPABASE_URL` | server fns |
| Servidor | `SUPABASE_PUBLISHABLE_KEY` | server fns autenticadas |
| Servidor (secreto) | `SUPABASE_SERVICE_ROLE_KEY` | sólo operaciones admin |

### 10.2 Despliegue
- CI/CD gestionado por Lovable; cada cambio publica preview inmutable.
- Producción: `linecontrolapp.lovable.app`.

### 10.3 Observabilidad
- Logs de server functions vía panel de Lovable Cloud.
- Alertas funcionales en tabla `alertas`.

---

## 11. Riesgos y Decisiones Técnicas

| ID | Decisión | Justificación |
|---|---|---|
| ADR-01 | Sin FKs físicas entre maestros cargados por archivo | Tolerancia a cargas parciales / inconsistencias temporales |
| ADR-02 | Roles en tabla separada `user_roles` | Previene escalada de privilegios |
| ADR-03 | `has_role()` SECURITY DEFINER autorizada para `authenticated` | Indispensable para RLS no recursiva; hallazgo de linter ignorado con justificación |
| ADR-04 | Recuperación de contraseña vía email link, no por admin | Reduce superficie de ataque y cumple buenas prácticas |
| ADR-05 | Eliminación de la tabla `centros_costo` | Tabla muerta; el concepto se maneja como texto libre en `centro_costo` |
| ADR-06 | Paginación cliente en maestros | Optimiza renderizado para cargas masivas >1000 registros |
| ADR-07 | Scripts ETL Python independientes | Permite formatear archivos en Google Colab antes del cargue |
| ADR-08 | `xlsx` como importación dinámica | Reduce bundle inicial; se carga solo al procesar archivos |

---

## 12. Glosario

- **MSISDN**: número telefónico móvil internacional.
- **ICCID**: identificador de la SIM.
- **IMEI**: identificador del equipo.
- **POPS**: puntos operativos (terminales fijas con SIM).
- **UEM**: Unified Endpoint Management.
- **ETL**: Extract, Transform, Load; en este contexto, script de formateo previo al cargue.

---

## 13. Anexos

- **Diagrama ER físico (Mermaid):** `.docs/diagrama_er_fisico.mmd`
- **Manual de usuario:** `.docs/MANUAL_DE_USUARIO.md`
- **Memoria de seguridad:** gestionada vía `@security-memory`.
