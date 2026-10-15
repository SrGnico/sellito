# Sellito: guía de diseño para la app

> Usar junto con `web/src/styles/sellito-theme.css` (tokens, base y componentes ya escritos) y `SELLITO_SPEC.md` (producto y arquitectura). Referencia visual: el canvas "Sellito identidad visual" (marca, tarjeta en Wallet y componentes).

## 1. Carácter de la marca

Juguetona y cercana, pero clara. Es una herramienta para dueños de negocios chicos y un gesto simpático para sus clientes.

- **Estilo "sticker":** bordes de 2 px en verde bosque, sombra dura sin desenfoque, esquinas redondeadas.
- **Mascota:** el sello sonriente (disco con borde punteado, dos ojos y una sonrisa).
- **Tono del texto:** simple, directo, en español rioplatense (voseo: "Revisá", "Mostrá"). Frases cortas, sin tecnicismos, sin humor que confunda. Si se prefiere un tono neutro o impersonal, cambiar solo los textos.

## 2. Reglas de uso del color

| Token          | Valor     | Uso                                                         |
| -------------- | --------- | ----------------------------------------------------------- |
| `--pink`       | `#FF9EC4` | Fondos de acento, tarjeta, botón secundario, toast de marca |
| `--green`      | `#12372A` | Texto, bordes, íconos, botón principal                      |
| `--cream`      | `#FFF4E0` | Fondo de la app y de paneles                                |
| `--field`      | `#FFFBF3` | Fondo de campos y tarjetas de contenido                     |
| `--green-soft` | `#2D5A48` | Texto secundario                                            |
| `--cream-deep` | `#F6E7CB` | Deshabilitado, switch apagado                               |

Semánticos (fondo / texto / acento): éxito `#DDF3E4 / #14532D / #2E8B57`, error `#FDE2E2 / #8A1C1C / #C23838`, advertencia `#FFEBC2 / #7A4A00 / #E59A0B`, información `#DCEBFA / #0F3B66 / #3B82C4`.

Reglas:

- **Nunca texto rosa sobre crema** (no alcanza el contraste). El rosa es siempre un fondo, con texto verde encima.
- Texto verde sobre rosa, crema o campos: apto (más de 7:1). Texto crema sobre verde: apto.
- Nada se comunica solo con el color: los estados llevan ícono o texto (alertas, badges, errores de campo).
- En la app se usan los **roles** (`--bg`, `--surface`, `--text`, `--border`…) y no los colores crudos.

## 3. Tipografía

- **Títulos:** Fredoka 600. **Texto:** DM Sans 400/500.
- Escala: 12, 14, 16, 18, 22, 28, 36, 48 px. Texto base de 16 px con interlineado 1.5.
- Texto mínimo en la app: 13 px (ayudas) y 14 px (etiquetas). Nada por debajo de 12 px.

## 4. Espaciado, formas y movimiento

- Espaciado en múltiplos de 4: 4, 8, 12, 16, 24, 32, 48.
- Radios: 8 (chico), 14 (botones y campos), 20 (tarjetas), 24 (diálogos), 999 (píldoras).
- Movimiento: 150 ms para interacciones, 250 ms para entradas (toast). Respetar `prefers-reduced-motion`.
- Zonas táctiles de **48 px de alto** como mínimo (el escáner del local se usa con una mano, de pie).

## 5. Componentes

Cada componente tiene su versión lista en `sellito-theme.css`. Para los que llevan comportamiento, se recomienda usar primitivas sin estilo (por ejemplo Radix UI para diálogo, menú, tooltip y tabs; `sonner` o similar para los toasts) y aplicarles estas clases.

### Botón

Variantes: principal (verde), secundario (rosa), contorno (crema), peligro (rojo), ghost (solo texto subrayado), deshabilitado. Tamaños: chico 40, normal 48, grande 56 px. Un solo botón principal por pantalla. Al presionar baja 3 px y pierde la sombra. Con una acción en curso: mostrar spinner, deshabilitar y mantener el ancho.

### Campo de texto, textarea y select

Etiqueta siempre visible arriba (no solo placeholder). Ayuda debajo en 13 px. Estados: normal, foco (anillo verde de 3 px con separación), error (borde rojo, ícono y mensaje; `aria-invalid="true"` y mensaje enlazado con `aria-describedby`), deshabilitado. Mensajes de error que dicen qué hacer ("Ingresá un mail válido"), no solo qué falló.

### Checkbox, radio y switch

Checkbox y radio de 22 px. El switch es un `<button role="switch" aria-checked>` de 52×30 px y siempre lleva etiqueta de texto.

### Alerta (dentro de la página)

Cuatro tipos (éxito, error, advertencia, información) con ícono, título corto y una línea de detalle. Éxito e información con `role="status"`, error y advertencia con `role="alert"`. Se quedan en pantalla hasta que se resuelven o se cierran.

### Toast (aviso temporal)

Abajo y centrado, máximo 420 px de ancho, uno o varios apilados con separación de 14 px. Contenido: ícono, título, una línea y, opcionalmente, una acción ("Deshacer", "Reintentar") y botón de cerrar con `aria-label`. Duración: 4 s para éxito, 8 s si tiene acción, y los errores no se cierran solos. El toast de marca (fondo rosa con el sello) se reserva para "Sello sumado" y premios.

### Confirmación (diálogo)

Fondo oscurecido en verde al 62 %, diálogo centrado de hasta 440 px con ícono, título en forma de pregunta, una frase explicando la consecuencia y dos botones: cancelar a la izquierda, acción a la derecha. Para acciones que borran datos: ícono de advertencia, botón de peligro con verbo claro ("Sí, eliminar") y cancelar con texto amable ("Mejor no"). Atrapar el foco, cerrar con Escape (salvo que la acción sea crítica), `role="dialog"` o `role="alertdialog"` con `aria-labelledby`.

### Insignia (badge)

Para el estado de la suscripción y de las tarjetas: Activo (verde), En prueba (azul), Pago pendiente (ámbar), Cancelado (rojo). Siempre con punto y texto.

### Tarjeta de contenido (card)

Fondo `--field`, borde de 2 px, sombra dura de 4 px. Variante rosa para destacados (por ejemplo "Premios canjeados").

## 6. Lo que necesita la app (lista de componentes)

Base, con diseño ya definido: botón, campo, textarea, select, checkbox, radio, switch, alerta, toast, confirmación, insignia y card.

Faltan definir con estas mismas reglas (sticker, borde de 2 px, verde sobre crema):

- **Navegación:** barra superior con el logo, menú lateral del panel (con el ítem activo en rosa), menú de usuario (dropdown), breadcrumbs.
- **Contenido:** tabla de clientes (con encabezado verde claro, filas con separador de 2 px), pestañas (tabs), paginación, lista vacía con el sello triste y una acción.
- **Carga:** spinner (sello girando), skeleton para tablas y cards, barra de progreso.
- **Ayuda:** tooltip, popover.
- **Formularios del panel:** subida de imagen (logo y banner con vista previa), selector de color, selector de ícono del sello, stepper para el alta del negocio (1 diseño, 2 regla, 3 pago).
- **Páginas de estado:** error 404, sin conexión, suscripción vencida (bloquea el escáner).

## 7. Componentes propios de Sellito

- **`StampGrid`:** cuadrícula de sellos de la tarjeta. Sello lleno = disco verde con tilde rosa; vacío = aro punteado; el último muestra "GRATIS". Recibe `total`, `filled` y el ícono del negocio.
- **`CardPreview`:** vista previa en vivo de la tarjeta mientras el dueño edita (logo, banner, colores, regla). Es la misma que se genera para Wallet.
- **`WalletButton`:** "Agregar a Apple Wallet" o "Agregar a Google Wallet" según el celular. Respetar las guías de marca de Apple y Google para esos botones.
- **`ScannerView`:** pantalla del local. Cámara a pantalla completa, resultado grande ("+1 sello", "Premio listo"), botones de 56 px, vibración al confirmar.
- **`StatCard`:** número grande en Fredoka, etiqueta y detalle.
- **`Mascot`:** el sello sonriente en tamaños 32, 48, 96 y 150 px. Por debajo de 40 px se simplifica (sin el borde punteado).

## 8. Accesibilidad

- Contraste mínimo de 4.5:1 para texto y 3:1 para bordes y foco.
- Todo se maneja con teclado; el foco siempre visible (anillo de 3 px).
- Botones reales (`<button>`), enlaces reales (`<a>`), y campos con `<label>`. Nada de `div` clickeables.
- Íconos decorativos con `aria-hidden="true"`; los que son un botón, con `aria-label`.
- El color nunca es la única señal.

## 9. Carga, estados vacíos y onboarding

Archivos: `web/src/styles/sellito-motion.css` (spinner, skeleton, barra de progreso, animación de sello) y la carpeta `web/src/assets/` (mascota, loader animado, ilustraciones; el favicon está en `web/public/favicon.svg`). Su `README.md` explica cada archivo.

Componentes en `web/src/components/`: `LoadingScreen`, `Spinner`, `EmptyState`, `Mascot` y `Onboarding`.

- **Pantalla de carga completa:** `loader.svg` centrado, con un texto que diga qué se carga ("Cargando tu tarjeta…") y `role="status"`.
- **Botones y acciones:** spinner de puntos dentro del botón, con `aria-busy="true"`, texto en gerundio ("Guardando…") y el mismo ancho que antes.
- **Listas y tablas:** esqueleto (`.skeleton`) con la forma del contenido que viene, nunca una pantalla en blanco.
- **Estados vacíos y mensajes de pantalla:** siempre ilustración, título corto, una frase y un solo botón. Disponibles: sin clientes, sin resultados, sin conexión, página no encontrada, suscripción vencida y premio listo.
- **Onboarding del dueño:** tres pasos (armá tu tarjeta, tus clientes la guardan en el celular, sumá sellos con la cámara). Puntos de progreso arriba del título, botón principal abajo, "Omitir" arriba a la derecha y "Atrás" desde el paso 2.
- **Al sumar un sello:** el sello nuevo se estampa con `.stamp-in`; al canjear, mostrar `reward.svg`.

## 10. Pendientes de diseño

- Modo oscuro (no definido todavía).
- Imagen para compartir en redes y banner de la landing.
- Ícono del Wallet exportado en PNG (varios tamaños) y diseño del sello por tipo de negocio (café, pizza, tijera…).
- Decidir si el ícono del Wallet lleva el borde punteado o se simplifica.
