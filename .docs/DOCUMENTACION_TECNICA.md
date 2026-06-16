# Documentación Técnica — LineControl

> Sistema de gestión y control de inventario de líneas móviles, dispositivos UEM y POPS, con cargas masivas, alertas y reportes.

- **Versión:** 1.0.0
- **Fecha:** 2026-06-16
- **Estándar de referencia:** IEEE 1016 (Software Design Description) / ISO/IEC/IEEE 42010 (arquitectura).
- **URL Producción:** https://linecontrolapp.lovable.app
- **URL Preview:** https://id-preview--66349ba0-d459-4da3-aff9-88c619c55c5b.lovable.app

---

## 1. Propósito y Alcance

LineControl centraliza la operación de telefonía móvil corporativa: maestro de líneas (MSISDN/ICCID), dispositivos UEM (IMEI), POPS, centros de costo, cargas masivas de archivos y motor de alertas. La aplicación se distribuye como una SPA con SSR ligero y backend serverless gestionado.

### 1.1 Alcance funcional
- Autenticación (email/contraseña + recuperación) y control de acceso por roles (`admin`, `supervisor`, `operador`).
- Maestros: Líneas, Dispositivos, POPS, Centros de Costo.
- Cargas masivas con historial y borrado restringido al rol `admin`.
- Alertas con severidad y trazabilidad.
- Reportes y dashboard.
- Administración de usuarios y roles.

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
   ├─ Auth (JWT, email/password)
   ├─ PostgreSQL + RLS
   └─ Storage (no usado actualmente)
```

### 2.3 Patrones aplicados
- **File-based routing** plano con prefijos `_app.*` para layout autenticado.
- **Server Functions tipadas** (`createServerFn`) para lógica privilegiada; nunca claves de servicio en el bundle del cliente.
- **RLS por usuario** con función `SECURITY DEFINER` `has_role()` para evitar recursión.
- **Cliente Supabase navegador** para queries comunes con RLS aplicada.
- **Separación de roles** mediante tabla `user_roles` (nunca columna en `profiles`).

---

## 3. Modelo de Seguridad

### 3.1 Autenticación
- Email + contraseña con persistencia en `localStorage`.
- Flujo de recuperación de contraseña vía link mágico (`/forgot-password` → `/reset-password`).
- Toggle de visualización de caracteres en todos los inputs sensibles.

### 3.2 Autorización (RBAC)
Tres roles definidos en el ENUM `app_role`:
- `admin` — gestión total, único con permiso de borrado de archivos de carga y de gestión de usuarios.
- `supervisor` — visualización transversal + cargas.
- `operador` (default al registrarse) — cargas y consulta de sus propios datos.

### 3.3 Row Level Security
- RLS habilitada en **todas** las tablas de `public`.
- Patrón: `auth.uid() = user_id` para datos propios; `public.has_role(auth.uid(), 'admin')` para acceso transversal.
- `GRANT` explícitos por tabla a `authenticated` y `service_role`. Sin `anon`.

### 3.4 Funciones SECURITY DEFINER
- `has_role(_user_id, _role)`: indispensable para RLS sin recursión.
- `handle_new_user()`, `assign_default_role()`: triggers en `auth.users`; sin contexto de trigger no son explotables.
- Hallazgo del linter `0029` marcado como **ignorado** con justificación técnica en la `@security-memory`.

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
| imei | text NOT NULL | identificador lógico, usado como join key |
| modelo, fabricante, so, estado, asignado_a, numero_telefono | text | `estado` default `enrolado` |
| ultimo_checkin | date | |
| created_at | timestamptz | |

#### `lineas`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| msisdn | text NOT NULL | número de la línea |
| imei | text | FK lógica → `dispositivos.imei` |
| iccid, plan, operador, cod_empresa, nombre_cliente, estado | text | |
| centro_costo | text | FK lógica → `centros_costo.codigo` |
| costo_mensual, valor_plan, valor_datos, consumo_mb | numeric | default 0 |
| ultimo_uso | date | |
| created_at | timestamptz | |

#### `pops`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| codigo | text NOT NULL | |
| modelo, numero_telefono, ubicacion, estado | text | |
| centro_costo | text | FK lógica → `centros_costo.codigo` |
| fecha_alta, fecha_baja | date | |
| created_at | timestamptz | |

#### `centros_costo`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| codigo | text NOT NULL | clave de negocio |
| nombre | text NOT NULL | |
| created_at | timestamptz | |

#### `archivos_carga`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| nombre, tipo | text NOT NULL | `tipo`: `lineas` \| `dispositivos` \| `pops` \| ... |
| registros | int | default 0 |
| estado | text | default `completado` |
| created_at | timestamptz | |

#### `alertas`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| tipo | text NOT NULL | |
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
                 ├── (N)  centros_costo         (user_id)
                 ├── (N)  archivos_carga        (user_id)
                 └── (N)  alertas               (user_id)

dispositivos (1) ─────< lineas    [join lógico por IMEI]
centros_costo (1) ────< lineas    [join lógico por codigo]
centros_costo (1) ────< pops      [join lógico por codigo]
```

> **Nota:** Las relaciones `dispositivos↔lineas`, `centros_costo↔lineas` y `centros_costo↔pops` son **referenciales lógicas** (no FKs físicas) porque los datos provienen de cargas masivas heterogéneas que deben tolerar inconsistencias temporales. La integridad se valida a nivel aplicación y se materializan alertas cuando falla.

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
│   ├── login.tsx                 # Login + toggle de contraseña
│   ├── forgot-password.tsx       # Solicitud de reset
│   ├── reset-password.tsx        # Nueva contraseña + toggle
│   ├── _app.tsx                  # Layout autenticado (sidebar)
│   ├── _app.index.tsx            # Dashboard
│   ├── _app.lineas.tsx           # Maestro Líneas
│   ├── _app.dispositivos.tsx     # Maestro Dispositivos
│   ├── _app.pops.tsx             # Maestro POPS
│   ├── _app.cargar.tsx           # Cargas masivas + historial (delete admin-only)
│   ├── _app.alertas.tsx          # Alertas
│   ├── _app.reportes.tsx         # Reportes
│   └── _app.admin.tsx            # Administración + gestión de usuarios
├── lib/
│   ├── auth.tsx                  # Contexto de sesión
│   └── roles.tsx                 # Contexto de roles (useRoles)
├── components/
│   ├── AppSidebar.tsx
│   ├── DataTable.tsx
│   └── PageHeader.tsx
└── integrations/supabase/        # AUTO-GENERADO — no editar
```

---

## 6. Estándares de Desarrollo

- **TypeScript strict**: cero `any` salvo límites de integración justificados.
- **Lint/format**: ESLint + Prettier (`.prettierrc`, `eslint.config.js`).
- **Naming**: componentes `PascalCase`, hooks `useCamelCase`, archivos de ruta en minúsculas.
- **Tokens semánticos**: colores y tipografía vía `src/styles.css`; prohibido `text-white`, `bg-[#xxx]` directos.
- **Errores de ruta**: toda ruta con `loader` define `errorComponent` y `notFoundComponent`.
- **Migraciones**: cada `CREATE TABLE public.*` va acompañada de `GRANT` + `ENABLE RLS` + `POLICY` en la misma migración.

---

## 7. Operación

### 7.1 Variables de entorno
| Ámbito | Variable | Uso |
|---|---|---|
| Cliente (Vite) | `VITE_SUPABASE_URL` | endpoint público |
| Cliente | `VITE_SUPABASE_PUBLISHABLE_KEY` | clave anónima |
| Servidor | `SUPABASE_URL` | server fns |
| Servidor | `SUPABASE_PUBLISHABLE_KEY` | server fns autenticadas |
| Servidor (secreto) | `SUPABASE_SERVICE_ROLE_KEY` | sólo operaciones admin |

### 7.2 Despliegue
- CI/CD gestionado por Lovable; cada cambio publica preview inmutable.
- Producción: `linecontrolapp.lovable.app`.

### 7.3 Observabilidad
- Logs de server functions vía panel de Lovable Cloud.
- Alertas funcionales en tabla `alertas`.

---

## 8. Riesgos y Decisiones Técnicas

| ID | Decisión | Justificación |
|---|---|---|
| ADR-01 | Sin FKs físicas entre maestros cargados por archivo | Tolerancia a cargas parciales / inconsistencias temporales |
| ADR-02 | Roles en tabla separada `user_roles` | Previene escalada de privilegios |
| ADR-03 | `has_role()` SECURITY DEFINER autorizada para `authenticated` | Indispensable para RLS no recursiva; hallazgo de linter ignorado con justificación |
| ADR-04 | Recuperación de contraseña vía email link, no por admin | Reduce superficie de ataque y cumple buenas prácticas (admin no ve ni cambia contraseñas) |

---

## 9. Glosario

- **MSISDN**: número telefónico móvil internacional.
- **ICCID**: identificador de la SIM.
- **IMEI**: identificador del equipo.
- **POPS**: puntos operativos (terminales fijas con SIM).
- **UEM**: Unified Endpoint Management.

---

## 10. Anexos

- **Diagrama ER físico (Mermaid):** `diagrama_er_fisico.mmd`
- **Memoria de seguridad:** gestionada vía `@security-memory`.
