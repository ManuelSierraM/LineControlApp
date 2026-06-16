# LineControl

> Plataforma corporativa para la gestión y control de líneas móviles, dispositivos UEM y POPS, con cargas masivas, alertas y reportes en tiempo real.

[![Estado](https://img.shields.io/badge/estado-producci%C3%B3n-brightgreen)]()
[![Versión](https://img.shields.io/badge/versi%C3%B3n-1.0.0-blue)]()
[![Stack](https://img.shields.io/badge/stack-TanStack%20Start%20%2B%20React%2019-orange)]()

🌐 **Producción:** https://linecontrolapp.lovable.app

---

## 📑 Tabla de contenido

1. [¿Qué es LineControl?](#-qué-es-linecontrol)
2. [Primeros pasos](#-primeros-pasos)
3. [Roles y permisos](#-roles-y-permisos)
4. [Guía por módulo](#-guía-por-módulo)
   - [Dashboard](#dashboard)
   - [Líneas](#líneas)
   - [Dispositivos](#dispositivos)
   - [POPS](#pops)
   - [Cargar archivos](#cargar-archivos)
   - [Alertas](#alertas)
   - [Reportes](#reportes)
   - [Administración](#administración)
5. [Seguridad de la cuenta](#-seguridad-de-la-cuenta)
6. [Preguntas frecuentes](#-preguntas-frecuentes)
7. [Soporte](#-soporte)
8. [Documentación técnica](#-documentación-técnica)

---

## 🚀 ¿Qué es LineControl?

LineControl es una aplicación web responsiva que permite a las áreas de tecnología y operaciones administrar de forma centralizada:

- 📱 **Líneas móviles** corporativas (MSISDN, ICCID, planes, operador, consumos).
- 💻 **Dispositivos UEM** (IMEI, modelo, fabricante, estado de enrolamiento).
- 🏪 **POPS** (puntos operativos con SIM o terminal fija).
- 🏷️ **Centros de costo** para imputación contable.
- 📥 **Cargas masivas** desde archivos con historial trazable.
- 🚨 **Alertas** con niveles de severidad.
- 📊 **Reportes** consolidados.

---

## 🟢 Primeros pasos

### 1. Crear una cuenta

1. Abre https://linecontrolapp.lovable.app.
2. En la pantalla de inicio elige la pestaña **Crear cuenta**.
3. Diligencia: nombre completo, email y contraseña (mínimo 6 caracteres).
4. Pulsa **Crear cuenta**. Se te asignará automáticamente el rol **operador**.

> 💡 Si tu organización tiene políticas particulares, solicita al administrador la elevación de tu rol a `supervisor` o `admin`.

### 2. Iniciar sesión

1. Ingresa email y contraseña.
2. Usa el ícono 👁️ junto al campo de contraseña para mostrar/ocultar los caracteres.
3. Pulsa **Entrar**.

### 3. Recuperar contraseña

1. En la pantalla de login, haz clic en **¿Olvidaste tu contraseña?**
2. Ingresa el email registrado y pulsa **Enviar enlace**.
3. Abre el correo recibido y haz clic en el enlace.
4. Define la nueva contraseña (puedes mostrar/ocultar los caracteres con el ícono 👁️).

---

## 👥 Roles y permisos

| Acción | 👑 Admin | 🛡️ Supervisor | 👤 Operador |
|---|:---:|:---:|:---:|
| Iniciar sesión | ✅ | ✅ | ✅ |
| Ver dashboard | ✅ | ✅ | ✅ |
| Consultar líneas / dispositivos / POPS | ✅ | ✅ | ✅ (propios) |
| Cargar archivos | ✅ | ✅ | ✅ |
| Ver historial de cargas | ✅ | ✅ | ✅ |
| **Borrar archivos del historial** | ✅ | ❌ | ❌ |
| Ver / gestionar alertas | ✅ | ✅ | ✅ (propias) |
| Ver reportes | ✅ | ✅ | ✅ |
| **Administrar usuarios y roles** | ✅ | ❌ | ❌ |

> Por defecto, los nuevos usuarios reciben el rol `operador`. Sólo un `admin` puede promover a otros usuarios.

---

## 🧭 Guía por módulo

La aplicación cuenta con una barra lateral con acceso a todos los módulos. Usa el botón ☰ para colapsarla en dispositivos móviles.

### Dashboard
Vista de bienvenida con indicadores clave: total de líneas, dispositivos activos, alertas abiertas y últimas cargas.

### Líneas
Maestro de líneas móviles.

- 🔎 Busca por MSISDN, ICCID o cliente.
- 🧾 Filtra por operador, plan o centro de costo.
- 📤 Exporta el listado filtrado.

### Dispositivos
Inventario de equipos UEM.

- Visualiza el estado (`enrolado`, `pendiente`, `dado de baja`).
- Consulta el último *check-in* y a quién está asignado.

### POPS
Puntos operativos con línea asociada.

- Ubicación, estado y centro de costo.
- Fechas de alta y baja.

### Cargar archivos
Punto de entrada para cargas masivas (líneas, dispositivos, POPS, etc.).

**Cómo cargar un archivo:**
1. Selecciona el **tipo de carga**.
2. Arrastra el archivo o haz clic en **Seleccionar archivo**.
3. Confirma la previsualización y pulsa **Procesar**.
4. Al finalizar verás la confirmación con el número de registros importados.

**Historial de cargas:**
- Todos los roles pueden **consultar** el historial.
- 🗑️ Sólo el rol **admin** ve y puede usar el botón de borrado. Los demás roles ven el historial en modo lectura.

### Alertas
Listado de alertas funcionales con severidad (`alta`, `media`, `baja`).

- Marca como **resuelta** cuando atiendas el caso.
- Filtra por tipo, severidad o estado.

### Reportes
Reportes consolidados de consumo, costos y estado del parque.

### Administración
Disponible **sólo para admin**.

- Gestión de usuarios y asignación de roles.
- Consulta de actividad relevante del sistema.

> ⚠️ Por seguridad, **ningún administrador puede ver ni cambiar la contraseña de otro usuario**. Cada persona debe usar el flujo de **recuperación de contraseña** desde el login.

---

## 🔐 Seguridad de la cuenta

- Las contraseñas se almacenan cifradas y nunca son visibles para nadie, ni siquiera para los administradores.
- Todos los campos de contraseña incluyen un ícono 👁️ para mostrar/ocultar los caracteres y reducir errores de digitación.
- La sesión se mantiene activa en el navegador. Usa **Cerrar sesión** en equipos compartidos.
- Cada usuario sólo puede ver y modificar los datos que le pertenecen, salvo los roles `admin` y `supervisor` que tienen visibilidad transversal.

---

## ❓ Preguntas frecuentes

**No me llega el correo de recuperación.**
Revisa la carpeta de Spam/Correo no deseado. Si no aparece en 5 minutos, verifica que el correo esté registrado.

**Me dice "permiso denegado" al intentar borrar una carga.**
Sólo el rol `admin` puede borrar registros del historial de cargas. Solicita el borrado a un administrador.

**Cargué un archivo pero no veo los registros.**
Verifica el tipo de carga seleccionado y revisa el módulo de **Alertas**: los registros inconsistentes generan una alerta automática.

**¿Puedo cambiar mi contraseña sin recibir un correo?**
No. Por buenas prácticas de seguridad, el cambio se realiza únicamente vía el enlace enviado al correo registrado.

**¿La app funciona en móviles?**
Sí. La interfaz es responsiva. La barra lateral se colapsa automáticamente en pantallas pequeñas.

---

## 📞 Soporte

- 🐛 Reporte de incidencias: abre un *issue* en este repositorio.
- 💬 Soporte funcional: contacta al administrador de tu organización.

---

## 📚 Documentación técnica

Para detalles de arquitectura, modelo de datos, diagrama entidad-relación y estándares de desarrollo, consulta:

- [`docs/DOCUMENTACION_TECNICA.md`](docs/DOCUMENTACION_TECNICA.md) — Documentación técnica completa (IEEE 1016).
- [`docs/diagrama_er_fisico.mmd`](docs/diagrama_er_fisico.mmd) — Diagrama Entidad-Relación físico (Mermaid).

---

<sub>© 2026 LineControl. Construido con TanStack Start, React 19 y Lovable Cloud.</sub>
