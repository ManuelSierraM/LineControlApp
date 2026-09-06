# Limpieza de paquetes sin uso

Verificación hecha: se recorrió el árbol completo de importaciones desde todas las pantallas, el enrutador y el código de servidor (incluyendo importaciones dinámicas). Lo único que la app alcanza hoy es: base de datos, enrutador, consultas, gráficos, lectura de CSV, las dos librerías de Excel, notificaciones, íconos, utilidades de estilos y 10 piezas de interfaz de Radix.

Ninguno de los paquetes propuestos aparece en esa ruta: ni en pantallas, ni en el panel lateral, ni en el código de servidor.

## Qué se quita

Paquetes (24):
- react-hook-form, @hookform/resolvers, zod
- react-day-picker, date-fns
- embla-carousel-react, vaul, cmdk, input-otp, react-resizable-panels
- Radix: accordion, aspect-ratio, avatar, collapsible, context-menu, hover-card, menubar, navigation-menu, popover, progress, radio-group, scroll-area, slider, switch, toggle, toggle-group

Archivos de interfaz que quedan huérfanos y se eliminan: accordion, alert, aspect-ratio, avatar, breadcrumb, calendar, carousel, chart, collapsible, command, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, slider, switch, textarea, toggle, toggle-group.

## Qué NO se toca

Gráficos (recharts), lectura de CSV, Excel, notificaciones, íconos, base de datos, enrutador, estilos y las piezas de interfaz en uso: botón, tarjeta, insignia, diálogo, diálogo de confirmación, menú desplegable, campo de texto, etiqueta, casilla, selector, panel lateral, tabla, pestañas, notificaciones, hoja lateral, separador, tooltip, esqueleto.

## Optimización adicional (opcional, incluida)

- Mover a dependencias de desarrollo lo que solo sirve para compilar: vite-tsconfig-paths, @cloudflare/vite-plugin, @tanstack/router-plugin, nitro, tailwindcss, @types/papaparse.
- Cargar la librería de lectura de Excel solo al procesar un archivo (igual que ya se hace con la de plantillas), para aligerar el arranque.

## Verificación posterior

Compilar y abrir cada pantalla (Panel, Líneas, Dispositivos, POPS, Cargar, Alertas, Reportes, Administración) para confirmar que todo sigue igual.
