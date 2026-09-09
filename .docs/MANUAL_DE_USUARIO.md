# Manual de Usuario — LineControl

> Guía práctica para operadores, supervisores y administradores del sistema LineControl.

- **Versión:** 1.0.0
- **Fecha:** 2026-09-09
- **URL Producción:** https://linecontrolapp.lovable.app

---

## 1. Introducción

LineControl es una aplicación web responsiva para la gestión centralizada de:

- 📱 **Líneas móviles** corporativas (MSISDN, ICCID, planes, operador, consumos).
- 💻 **Dispositivos UEM** (IMEI, modelo, fabricante, estado de enrolamiento).
- 🏪 **POPS** (puntos operativos con SIM o terminal fija).
- 📥 **Cargas masivas** desde archivos Excel/CSV con historial trazable.
- 🚨 **Alertas** funcionales con niveles de severidad.
- 📊 **Reportes** consolidados.

---

## 2. Requisitos y acceso

### 2.1 Navegadores recomendados
- Google Chrome (última versión)
- Microsoft Edge (última versión)
- Mozilla Firefox (última versión)

### 2.2 Acceder por primera vez
1. Abre https://linecontrolapp.lovable.app.
2. En la pestaña **Crear cuenta** ingresa:
   - Nombre completo
   - Correo electrónico
   - Contraseña (mínimo 6 caracteres)
3. Pulsa **Crear cuenta**.
4. El sistema asigna automáticamente el rol **operador**.

> Si tu organización requiere más permisos, solicita al administrador que te asigne el rol `supervisor` o `admin`.

### 2.3 Iniciar sesión
1. Ingresa email y contraseña.
2. También puedes usar el botón **Iniciar sesión con Google** si está habilitado.
3. Usa el ícono 👁️ junto a la contraseña para mostrar u ocultar los caracteres.
4. Pulsa **Entrar**.

### 2.4 Recuperar contraseña
1. En la pantalla de login, haz clic en **¿Olvidaste tu contraseña?**
2. Ingresa el email registrado y pulsa **Enviar enlace**.
3. Abre el correo recibido y haz clic en el enlace.
4. Define la nueva contraseña.

> ⚠️ Por seguridad, **ningún administrador puede ver ni cambiar la contraseña de otro usuario**. Cada persona debe usar el flujo de recuperación.

---

## 3. Roles y permisos

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
| **Activar / desactivar usuarios** | ✅ | ❌ | ❌ |

> Por defecto, los nuevos usuarios reciben el rol `operador`. Sólo un `admin` puede promover a otros usuarios.

---

## 4. Navegación general

La aplicación cuenta con una barra lateral (sidebar) con acceso a todos los módulos. En dispositivos móviles, usa el botón ☰ para colapsarla o expandirla.

Puedes cambiar entre modo claro y modo oscuro con el ícono de sol/luna en la parte superior.

---

## 5. Guía por módulo

### 5.1 Dashboard
Vista de bienvenida con indicadores clave:

- Total de líneas (deduplicado por MSISDN).
- Total de dispositivos UEM (deduplicado por IMEI).
- Alertas abiertas.
- Últimas cargas.
- Gráficos de alertas y ahorro potencial.
- Tabla de líneas con mayor impacto económico (todas las que tengan impacto, no solo 10).

### 5.2 Maestro de Líneas
Listado de líneas móviles corporativas.

- 🔎 Busca por MSISDN, ICCID o cliente.
- 🧾 Filtra por operador, plan o centro de costo.
- 📤 Exporta el listado filtrado a CSV.
- La tabla está paginada; puedes elegir mostrar de 10 a 500 filas por página.

### 5.3 Dispositivos UEM
Inventario de equipos gestionados por UEM.

- Visualiza el estado reportado por la plataforma UEM.
- Consulta el último *check-in* y a quién está asignado.
- La tabla está paginada.

### 5.4 Inventario POPS
Puntos operativos con línea asociada.

- Ubicación, estado, centro de costo, fechas de alta y baja.
- La tabla está paginada.

### 5.5 Cargar Archivos
Punto de entrada para cargas masivas.

#### Tipos de carga
1. **Maestro de Líneas**
2. **Devices UEM**
3. **Inventario POPS**

#### Cómo cargar un archivo
1. Selecciona el **tipo de carga**.
2. Arrastra el archivo o haz clic en **Seleccionar archivo**.
3. Revisa la previsualización y los posibles errores de validación.
4. Pulsa **Procesar**.
5. Al finalizar verás la confirmación con el número de registros importados.

#### Plantillas y ETL
- Descarga la **plantilla** desde el botón correspondiente; los campos obligatorios aparecen resaltados en naranja.
- Si tu archivo origen tiene nombres de columna diferentes, descarga el **script ETL para Google Colab**, pégalo en un notebook de Colab, súbele tu archivo y descarga el archivo formateado listo para LineControl.

#### Historial de cargas
- Todos los roles pueden consultar el historial.
- Solo `admin` puede abrir el modal de **Borrar registros**.
- El admin puede filtrar por tipo de carga, rango de fechas y usuario antes de borrar.
- Se requiere confirmación explícita.

### 5.6 Alertas
Listado de alertas funcionales con severidad (`alta`, `media`, `baja`).

- Filtra por tipo, severidad o estado.
- Marca como **resuelta** cuando atiendas el caso.
- Tipos de alerta:
  - **Sin línea asociada**
  - **IMEI duplicado**
  - **POPS sin centro**
  - **Líneas POPS Inconsistentes**
  - **Sin uso**

### 5.7 Reportes
Reportes consolidados de consumo, costos y estado del parque.

- **Alertas actuales:** generadas en el cargue más reciente.
- **Histórico de alertas:** generadas en cargues anteriores.

### 5.8 Administración
Disponible **solo para admin**.

- Gestión de usuarios y asignación de roles (`admin`, `supervisor`, `operador`).
- Activar o desactivar usuarios. Al desactivar un usuario, el sistema lo desloguea automáticamente.
- Enviar enlace de recuperación de contraseña.

> ⚠️ El administrador **no puede ver ni cambiar la contraseña** de otro usuario.

---

## 6. Seguridad de la cuenta

- Las contraseñas se almacenan cifradas y nunca son visibles para nadie.
- Todos los campos de contraseña incluyen un ícono 👁️ para mostrar/ocultar caracteres.
- La sesión se mantiene activa en el navegador. Usa **Cerrar sesión** en equipos compartidos.
- Cada usuario solo puede ver y modificar los datos que le pertenecen, salvo `admin` y `supervisor`, que tienen visibilidad transversal.

---

## 7. Preguntas frecuentes

**No me llega el correo de recuperación.**
Revisa la carpeta de Spam/Correo no deseado. Si no aparece en 5 minutos, verifica que el correo esté registrado.

**Me dice "permiso denegado" al intentar borrar una carga.**
Solo el rol `admin` puede borrar registros del historial de cargas. Solicita el borrado a un administrador.

**Cargué un archivo pero no veo los registros.**
Verifica el tipo de carga seleccionado y revisa el módulo de **Alertas**: los registros inconsistentes generan una alerta automática.

**¿Puedo cambiar mi contraseña sin recibir un correo?**
No. Por buenas prácticas de seguridad, el cambio se realiza únicamente vía el enlace enviado al correo registrado.

**¿La app funciona en móviles?**
Sí. La interfaz es responsiva. La barra lateral se colapsa automáticamente en pantallas pequeñas.

**Me aparece "Sin permisos activos".**
Un administrador te quitó todos los roles o ocurrió un problema de conexión. Contacta al administrador o cierra sesión y vuelve a intentar.

---

## 8. Soporte

- 🐛 Reporte de incidencias: abre un *issue* en el repositorio del proyecto.
- 💬 Soporte funcional: contacta al administrador de tu organización.

---

## 9. Documentación técnica

Para detalles de arquitectura, modelo de datos, diagrama entidad-relación y estándares de desarrollo, consulta:

- [`.docs/DOCUMENTACION_TECNICA.md`](.docs/DOCUMENTACION_TECNICA.md) — Documentación técnica completa (IEEE 1016).
- [`.docs/diagrama_er_fisico.mmd`](.docs/diagrama_er_fisico.mmd) — Diagrama Entidad-Relación físico (Mermaid).

---

<sub>© 2026 LineControl. Construido con TanStack Start, React 19 y Lovable Cloud.</sub>
