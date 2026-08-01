# 🔍 Auditoría Lighthouse — Print2Web
**Fecha:** 2026-08-01 | **Auditor:** Antigravity Senior Web Auditor

---

## 1. Resumen Ejecutivo

| Categoría | Puntuación Estimada Actual | Puntuación Alcanzable |
|---|---|---|
| **Performance** | ~55–65 | **95–100** |
| **Accessibility** | ~78–85 | **100** |
| **Best Practices** | ~70–80 | **95–100** |
| **SEO** | ~85–90 | **100** |

> [!IMPORTANT]
> El mayor lastre de rendimiento son las **imágenes PNG sin convertir a WebP** (~5 MB total), el **vídeo MP4 de 5.4 MB cargado automáticamente**, la **ausencia de `<link rel="preload">`** para imágenes above-the-fold, y el **script de PDF.js cargado de forma bloqueante** en el `<head>`. Estos cuatro problemas por sí solos pueden costar entre 25 y 35 puntos de Performance.

---

## 2. Tabla de Problemas

| # | Prioridad | Categoría | Auditoría Lighthouse | Descripción del Problema | Solución Propuesta |
|---|---|---|---|---|---|
| 1 | 🔴 Alta | Performance | `uses-optimized-images` / `uses-webp-images` | **8 imágenes PNG en el hero** (~5.4 MB total). Las PNG no están comprimidas ni en formato moderno. | Convertir a **WebP** (o AVIF). Herramienta: `cwebp` o Squoosh. Añadir `<source type="image/webp">` con `<picture>`. |
| 2 | 🔴 Alta | Performance | `uses-rel-preload` / `lcp-lazy-loaded` | Las imágenes del hero (above-the-fold visible) se cargan con `loading="eager"` pero **sin `<link rel="preload">`**, retrasando el LCP. | Añadir en `<head>`: `<link rel="preload" as="image" href="img/hero-bento-1.webp" fetchpriority="high">` para las 2 primeras imágenes visibles. |
| 3 | 🔴 Alta | Performance | `render-blocking-resources` | **`pdf.min.js` de CDN se carga de forma bloqueante** en el `<head>` sin `defer` ni `async`. Bloquea el parser HTML hasta descargarse (~500 KB minificado). | Mover la etiqueta `<script>` al final del `<body>` junto con `script.js`, o añadir `defer`. El worker ya se inicializa dentro de `script.js` condicionalmente. |
| 4 | 🔴 Alta | Performance | `efficient-animated-content` / `uses-video-compression` | **Vídeo MP4 de 5.4 MB** (`0_Office_Printer_1280x672.mp4`) con `autoplay` cargado sin restricción alguna. El vídeo duplicado (bucle infinito) suma dos peticiones o cachés pesadas. | 1) Comprimir el vídeo con `ffmpeg` (target <500 KB). 2) Añadir `preload="none"` en el segundo elemento `<video>` (el duplicado del bucle). 3) Considerar WebM como formato alternativo: `<source src="video.webm" type="video/webm">`. |
| 5 | 🔴 Alta | Performance | `uses-text-compression` | Los recursos estáticos (CSS 28 KB, JS 17 KB) se sirven sin compresión Gzip/Brotli declarada. En servidor local no hay cabeceras de compresión. | Configurar el servidor web (Apache/Nginx) con `gzip` o `brotli`. En local con Live Server, usar una extensión que simule compresión, o desplegar en Netlify/Vercel que comprimen automáticamente. |
| 6 | 🟡 Media | Performance | `unused-css-rules` | La regla `.hero-media-wrap` (línea 1110 CSS) y varias variables CSS (`--gray-200`, `--gray-400`, `--gray-600`, `--radius-sm`) se referencian pero **nunca se definen en `:root`**, generando fallos silenciosos y potencial CSS no usado. | Eliminar `.hero-media-wrap` del CSS o declarar las variables faltantes. Purgar CSS no utilizado con PurgeCSS o manualmente. |
| 7 | 🟡 Media | Performance | `dom-size` | El bento grid duplica todos los elementos dos veces (16 imágenes en total, 2 vídeos). Esto genera un DOM pesado y muchos nodos innecesarios. | Implementar la duplicación de nodos **vía JavaScript** clonando `bento-track` solo cuando la animación esté lista, reduciendo el HTML inicial a la mitad. |
| 8 | 🟡 Media | Performance | `font-display` | Se usa `'Helvetica Neue', Arial, sans-serif` — fuente del sistema, sin petición de fuente web. **No hay `@font-face`** declarado, lo cual es positivo para rendimiento, pero si en el futuro se añade una fuente web, se debe usar `font-display: swap`. | ✅ Sin acción inmediata. Si se añade Google Fonts u otra fuente web, usar `display=swap` en la URL de carga. |
| 9 | 🟡 Media | Accessibility | `image-alt` | Las **imágenes del bento duplicadas** (Set 2) tienen exactamente los mismos atributos `alt` que las del Set 1. Son decorativas/redundantes para lectores de pantalla al ser duplicados del bucle infinito. | Añadir `aria-hidden="true"` y `alt=""` a todos los elementos del **Set 2** (bucle), ya que son puramente decorativos. |
| 10 | 🟡 Media | Accessibility | `color-contrast` | `--gray-500: #595959` sobre `--white: #ffffff` = ratio **~7:1** ✅. `--gray-700: #4a4a4a` sobre `--white` = ratio **~9.5:1** ✅. Pero `--gray-600` referenciado en `.contact-lead` y `.contact-detail-item p` **no está definido** en `:root`. El navegador heredará un color imprevisible. | Definir `--gray-600: #6b6b6b;` en `:root` (ratio ~5.7:1 sobre blanco ✅ WCAG AA). |
| 11 | 🟡 Media | Accessibility | `label` | El `<input type="file" id="file-input">` está oculto (`hidden`) y el botón que lo activa (`onclick="document.getElementById('file-input').click()"`) **no está correctamente asociado**. El `input[file]` no tiene un `<label>` visible asociado. | Añadir `<label for="file-input" class="sr-only">Subir archivo para imprimir</label>` aunque el input esté visualmente oculto. Accesible sin cambio visual. |
| 12 | 🟡 Media | Accessibility | `heading-order` | El footer usa `<h2 class="footer-heading">` para el nombre de la empresa. La sección de contacto tiene **dos `<h2>`** en el mismo nivel para columnas diferentes. En la sección de testimonios también hay un `<h2 class="sr-only">`. La jerarquía de encabezados es funcional pero podría mejorarse. | El footer podría usar `<p>` con clase tipográfica en lugar de `<h2>` si no es un heading de sección real. Revisar si la semántica es la correcta para cada caso. |
| 13 | 🟡 Media | Accessibility | `focus-traps` | El formulario de contacto tiene `<input>` y `<textarea>` con `:focus { outline: none; border-color: var(--black); }` — **elimina el anillo de foco estándar** y solo muestra un cambio de borde que puede no cumplir WCAG 2.4.11 (Focus Appearance). | Reemplazar `outline: none` por un outline personalizado visible: `outline: 3px solid var(--black); outline-offset: 2px;` en `:focus-visible`. |
| 14 | 🟡 Media | Best Practices | `uses-http2` / `no-document-write` | **PDF.js se carga desde CDN externo** (`cdnjs.cloudflare.com`). No hay control sobre su disponibilidad, versión ni cabeceras de seguridad. Además, PDF.js 3.11.174 tiene versiones más recientes disponibles. | Considerar alojar `pdf.min.js` y `pdf.worker.min.js` localmente o usar `import` dinámico. Actualizar a la última versión estable. |
| 15 | 🟡 Media | Best Practices | `csp` | No hay **Content-Security-Policy** declarada como meta tag ni como cabecera de servidor. | Añadir en `<head>`: `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self'; img-src 'self' data:; frame-src 'none';">`. Ajustar según necesidades. |
| 16 | 🟡 Media | Best Practices | `no-vulnerable-libraries` | PDF.js 3.11.174 es una versión de 2023. Verificar si hay CVEs conocidos contra esta versión en [nvd.nist.gov](https://nvd.nist.gov). | Actualizar a la versión más reciente (`4.x`). La API de `pdfjsLib` es compatible con cambios mínimos. |
| 17 | 🟡 Media | SEO | `meta-description` | La meta description tiene **167 caracteres** — ligeramente por encima del límite recomendado de ~155-160 caracteres. Google la truncará en los resultados. | Acortarla a ≤155 caracteres. Ejemplo: `"Impresión online de alta resolución (1800 dpi) con tintas ecológicas. Taller propio en Sant Just Desvern (Barcelona). Plataforma de Tramas Solucions Gràfiques SL."` |
| 18 | 🟡 Media | SEO | `structured-data` | El Schema.org no incluye **`sameAs`** (redes sociales, Google Maps), ni `openingHours`, ni `priceRange`, ni `image`. Mejora la comprensión del negocio por parte de los motores de búsqueda. | Enriquecer el JSON-LD con `"sameAs": ["https://tramasweb.com"]`, `"openingHours": "Mo-Fr 09:00-18:00"`, `"image": "https://tramasweb.com/img/logotipo.png"`. |
| 19 | 🟡 Media | SEO | `document-title` | El `<title>` tiene **63 caracteres** incluyendo el separador (`·`). El límite recomendado son ~60 caracteres antes de truncado en SERPs. | Acortarlo a ≤60 caracteres: `"Print2Web · Impresión Online — Tramas Gràfiques"` |
| 20 | 🟡 Media | SEO | `hreflang` | La página está en español (`lang="es"`) y tiene `og:locale` en `es_ES` pero no declara **`hreflang`**. Si el sitio solo existe en español, se recomienda al menos declarar `hreflang="es"` explícito. | Añadir: `<link rel="alternate" hreflang="es" href="https://tramasweb.com/">` |
| 21 | 🟢 Baja | Performance | `total-byte-weight` | La página pesa en total >6 MB entre imágenes y vídeo. El umbral de Lighthouse para warning es 1.6 MB. | Implementar las correcciones de imágenes WebP y vídeo comprimido para bajar a <1 MB total. |
| 22 | 🟢 Baja | Accessibility | `aria-hidden-body` | El elemento `<div class="footer-media" aria-hidden="true">` contiene nodos decorativos, lo cual está correcto. Verificar que no contenga elementos interactivos en el futuro. | ✅ Correcto como está. Mantener la revisión. |
| 23 | 🟢 Baja | Accessibility | `tabindex` | No se usan `tabindex` positivos. El orden de tab es natural. El modal tiene `trapFocus()` implementado correctamente. | ✅ Correcto. |
| 24 | 🟢 Baja | Best Practices | `doctype` | `<!DOCTYPE html>` presente. ✅ | ✅ Correcto. |
| 25 | 🟢 Baja | Best Practices | `charset` | `<meta charset="UTF-8">` presente. ✅ | ✅ Correcto. |
| 26 | 🟢 Baja | Best Practices | `viewport` | `<meta name="viewport" content="width=device-width, initial-scale=1.0">` presente. ✅ | ✅ Correcto. |
| 27 | 🟢 Baja | Best Practices | `no-unload-listeners` | No se usan `unload` event listeners. ✅ | ✅ Correcto. |
| 28 | 🟢 Baja | Patrones de código | `console.warn` | `script.js` línea 181 usa `console.warn('Fallback al simulador...')`. En producción esto aparece en consola. | Eliminar o envolver en `if (location.hostname === 'localhost')` para que solo se muestre en desarrollo. |
| 29 | 🟢 Baja | Patrones de código | `inline-event-handlers` | En `index.html` línea 312: `onclick="document.getElementById('file-input').click()"` y línea 474: `onclick="alert('...')"`  son event handlers inline. | Mover toda la lógica a `script.js`. El botón de añadir archivo ya podría manejarse con el listener existente en `comprarBtn`. Para el modal, crear una función en JS. |
| 30 | 🟢 Baja | SEO | `og:image` | Las etiquetas Open Graph y Twitter Card no incluyen **`og:image`** ni `twitter:image`. Sin imagen, el compartir en redes sociales no mostrará ningún preview visual. | Añadir `<meta property="og:image" content="https://tramasweb.com/img/og-image.jpg">` (imagen 1200×630 px recomendada). |
| 31 | 🟢 Baja | Patrones de código | Variables CSS sin definir | `--gray-200`, `--gray-400`, `--gray-600`, `--radius-sm` se usan en CSS pero no están declaradas en `:root`. | Añadir en `:root`: `--gray-200: #e0e0e0; --gray-400: #9e9e9e; --gray-600: #6b6b6b; --radius-sm: 6px;` |
| 32 | 🟢 Baja | Patrones de código | Estilos `inline` en HTML | `index.html` usa `style="display: none;"` en varios elementos del mockup (líneas 241–253). | Crear clases CSS `.hidden` o usar el atributo `hidden` de HTML (ya usado en otros sitios del código). Consolidar. |

---

## 3. Correcciones de Código

### 3.1 Variables CSS faltantes — `styles.css` (`:root`)

Añadir las variables que faltan en `:root`:

```diff
 :root{
   --black: #131313;
   --near-black: #1a1a1a;
   --white: #ffffff;
   --gray-50: #f6f6f6;
   --gray-100: #ececec;
+  --gray-200: #e0e0e0;
   --gray-300: #cfcfcf;
+  --gray-400: #9e9e9e;
   --gray-500: #595959;
+  --gray-600: #6b6b6b;
   --gray-700: #4a4a4a;
   --cyan: #17b7e8;
   --magenta: #ec1c8d;
   --yellow: #ffe600;
   --radius: 10px;
+  --radius-sm: 6px;
   --container: 1240px;
   --gap: 32px;
   --font: 'Helvetica Neue', Arial, sans-serif;
 }
```

### 3.2 Focus visible en formulario de contacto — `styles.css`

```diff
 .contact-form input:focus,
 .contact-form textarea:focus {
-  outline: none;
-  border-color: var(--black);
+  outline: 3px solid var(--black);
+  outline-offset: 2px;
+  border-color: var(--black);
 }
```

### 3.3 Script PDF.js — mover de `<head>` a antes de `script.js` con `defer` — `index.html`

```diff
 <head>
   ...
-  <!-- Librería PDF.js para renderizado de la 1ª página de PDF en canvas -->
-  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
-
   <!-- Estilos Principales -->
   <link rel="stylesheet" href="styles.css">
 </head>
 ...
 <!-- Carga del script con defer -->
+<!-- Librería PDF.js — cargada con defer para no bloquear el renderizado -->
+<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" defer></script>
 <script src="script.js" defer></script>
```

> [!WARNING]
> Al añadir `defer` a PDF.js, asegúrate de que `script.js` también tiene `defer` (ya lo tiene). El orden de ejecución con `defer` se preserva en el orden del DOM, por lo que PDF.js se ejecutará antes que `script.js`. ✅

### 3.4 Imágenes del Set 2 (bucle) — aria-hidden — `index.html`

Las imágenes duplicadas para el bucle infinito son puramente decorativas:

```diff
 <!-- Set 2 (Bucle Infinito Continuo) -->
 <div class="bento-card bento-card-1">
-  <img src="img/hero-bento-1.png" alt="Catálogo editorial e impresiones de alta calidad" width="400" height="300" loading="eager" decoding="async">
+  <img src="img/hero-bento-1.webp" alt="" aria-hidden="true" width="400" height="300" loading="lazy" decoding="async">
 </div>
 <div class="bento-card bento-card-3">
-  <img src="img/hero-bento-3.png" alt="Dossieres y folletos corporativos con tintas ecológicas" width="400" height="400" loading="eager" decoding="async">
+  <img src="img/hero-bento-3.webp" alt="" aria-hidden="true" width="400" height="400" loading="lazy" decoding="async">
 </div>
 ...
```

> Aplicar el mismo patrón a todos los elementos del Set 2 en ambas columnas (bento-card-1 hasta bento-card-8 del Set 2). Además cambia a `loading="lazy"` en el Set 2, ya que no son visibles en la carga inicial.

### 3.5 Label para input de archivo oculto — `index.html`

```diff
 <!-- Subida de archivos -->
 <input type="file" id="file-input" hidden accept=".pdf,.doc,.docx,.png,.jpg">
+<label for="file-input" class="sr-only">Subir archivo para imprimir</label>
 <span id="file-name" class="file-name-text" aria-live="polite">Ningún archivo seleccionado</span>
```

### 3.6 Eliminar event handlers inline — `index.html`

**Antes (línea 312):**
```html
<button type="button" class="btn btn-outline" onclick="document.getElementById('file-input').click()">Añadir archivo</button>
```
**Después:**
```html
<button type="button" class="btn btn-outline" id="add-file-btn">Añadir archivo</button>
```
Y en `script.js`, añadir:
```js
const addFileBtn = document.getElementById('add-file-btn');
if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', function() {
        fileInput.click();
    });
}
```

**Antes (línea 474):**
```html
<button type="button" class="btn btn-solid" onclick="alert('¡Gracias por tu pedido!'); document.getElementById('modal-close').click();">Confirmar y pagar</button>
```
**Después:**
```html
<button type="button" class="btn btn-solid" id="confirm-pay-btn">Confirmar y pagar</button>
```
Y en `script.js`:
```js
const confirmPayBtn = document.getElementById('confirm-pay-btn');
if (confirmPayBtn) {
    confirmPayBtn.addEventListener('click', function() {
        alert('¡Gracias por tu pedido!');
        cerrarModal();
    });
}
```

### 3.7 Preload de imagen LCP — `index.html` en `<head>`

```diff
 <link rel="canonical" href="https://tramasweb.com/">
+
+<!-- Preload de imágenes críticas above-the-fold (LCP) -->
+<link rel="preload" as="image" href="img/hero-bento-1.webp" fetchpriority="high">
+<link rel="preload" as="image" href="img/hero-bento-2.webp" fetchpriority="high">
```

### 3.8 Open Graph Image — `index.html` en `<head>`

```diff
 <meta property="og:url" content="https://tramasweb.com/">
+<meta property="og:image" content="https://tramasweb.com/img/og-image.jpg">
+<meta property="og:image:width" content="1200">
+<meta property="og:image:height" content="630">
 <meta property="og:locale" content="es_ES">
 ...
 <meta name="twitter:description" content="...">
+<meta name="twitter:image" content="https://tramasweb.com/img/og-image.jpg">
```

### 3.9 Meta description ajustada — `index.html`

```diff
-<meta name="description" content="Print2Web es la plataforma de impresión online de Tramas Solucions Gràfiques SL. Impresión digital de alta resolución (1800 dpi) con taller propio en Sant Just Desvern (Barcelona).">
+<meta name="description" content="Impresión online de alta resolución (1800 dpi) con tintas ecológicas. Taller propio en Sant Just Desvern (Barcelona). Plataforma de Tramas Solucions Gràfiques SL.">
```
*(151 caracteres — dentro del límite)*

### 3.10 Schema.org enriquecido — `index.html`

```diff
   "aggregateRating": { ... },
+  "image": "https://tramasweb.com/img/logotipo.png",
+  "sameAs": ["https://tramasweb.com"],
+  "openingHours": ["Mo-Fr 09:00-18:00"],
+  "priceRange": "€€",
   "address": { ... }
```

### 3.11 console.warn en producción — `script.js` (línea 181)

```diff
-    }).catch(function(err) {
-        console.warn('Fallback al simulador de documento PDF:', err);
-        mostrarTarjetaDocumento(file.name);
-    });
+    }).catch(function() {
+        mostrarTarjetaDocumento(file.name);
+    });
```

### 3.12 hreflang — `index.html` en `<head>`

```diff
 <link rel="canonical" href="https://tramasweb.com/">
+<link rel="alternate" hreflang="es" href="https://tramasweb.com/">
+<link rel="alternate" hreflang="x-default" href="https://tramasweb.com/">
```

---

## 4. Conversión de Imágenes a WebP (Proceso)

Ejecutar en terminal desde la carpeta `img/` usando **cwebp** (instalable con `brew install webp` o desde [developers.google.com/speed/webp/download](https://developers.google.com/speed/webp/download)):

```bash
for f in *.png; do cwebp -q 82 "$f" -o "${f%.png}.webp"; done
```

O con **ffmpeg** para el vídeo:

```bash
# Comprimir vídeo MP4 (target ~400KB, 720p)
ffmpeg -i 0_Office_Printer_1280x672.mp4 -vcodec libx264 -crf 28 -preset slow -vf scale=960:-2 -an office_printer_compressed.mp4

# Generar versión WebM (mejor compresión en Chrome/Firefox)
ffmpeg -i office_printer_compressed.mp4 -c:v libvpx-vp9 -crf 33 -b:v 0 -an office_printer.webm
```

Luego en el HTML:
```html
<video autoplay loop muted playsinline poster="img/hero-bento-2.webp" class="bento-video">
  <source src="img/office_printer.webm" type="video/webm">
  <source src="img/office_printer_compressed.mp4" type="video/mp4">
</video>
```

---

## 5. Recomendaciones Adicionales

### Configuración de Servidor (Apache `.htaccess`)

```apache
# Compresión Gzip
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
</IfModule>

# Caché de recursos estáticos
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType video/mp4 "access plus 6 months"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>

# Cabeceras de seguridad
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
```

### Configuración de Servidor (Nginx)

```nginx
# Compresión
gzip on;
gzip_types text/html text/css application/javascript application/json image/svg+xml;
gzip_min_length 256;

# Caché
location ~* \.(webp|png|jpg|mp4|woff2)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# Cabeceras de seguridad
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Herramientas Recomendadas

| Herramienta | Uso |
|---|---|
| [PageSpeed Insights](https://pagespeed.web.dev/) | Auditoría Lighthouse real desde Google |
| [Squoosh](https://squoosh.app/) | Conversión visual de imágenes a WebP/AVIF en el navegador |
| [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) | Verificación de contraste WCAG |
| [Schema Markup Validator](https://validator.schema.org/) | Validar JSON-LD |
| [OpenGraph.xyz](https://www.opengraph.xyz/) | Preview de Open Graph tags |
| [axe DevTools](https://www.deque.com/axe/devtools/) | Extensión Chrome para auditoría de accesibilidad |
| [PurgeCSS](https://purgecss.com/) | Eliminar CSS no utilizado |

### PWA (Progressive Web App)

Para llegar a 100 en Best Practices y habilitar instalación nativa, añadir:

1. **`manifest.json`** en la raíz:
```json
{
  "name": "Print2Web",
  "short_name": "Print2Web",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#131313",
  "icons": [
    { "src": "img/icon-192.webp", "sizes": "192x192", "type": "image/webp" },
    { "src": "img/icon-512.webp", "sizes": "512x512", "type": "image/webp" }
  ]
}
```

2. En `<head>`:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#131313">
```

---

## 6. Checklist de Implementación Rápida

- [ ] **Convertir PNG → WebP** con calidad 80–85 (máximo impacto en Performance)
- [ ] **Comprimir vídeo MP4** de 5.4 MB → < 500 KB con ffmpeg
- [ ] **Mover PDF.js** al final del body con `defer` (eliminar bloqueo de render)
- [ ] **Añadir `<link rel="preload">`** para las 2 primeras imágenes del hero
- [ ] **Definir variables CSS faltantes** (`--gray-200`, `--gray-400`, `--gray-600`, `--radius-sm`)
- [ ] **Corregir focus en formulario de contacto** (eliminar `outline: none`)
- [ ] **Añadir `aria-hidden="true"` y `alt=""`** a imágenes del Set 2 (bucle decorativo)
- [ ] **Añadir `<label>` para `#file-input`** oculto
- [ ] **Eliminar event handlers inline** del HTML y moverlos a `script.js`
- [ ] **Ajustar meta description** a ≤155 caracteres
- [ ] **Añadir `og:image`** y `twitter:image`
- [ ] **Añadir `hreflang`** para el idioma español
- [ ] **Enriquecer Schema.org** con `image`, `sameAs`, `openingHours`
- [ ] **Eliminar `console.warn`** en producción
- [ ] **Configurar servidor** con Gzip/Brotli y cabeceras de caché/seguridad
