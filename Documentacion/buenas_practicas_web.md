# Guía de Buenas Prácticas: Accesibilidad, Rendimiento y SEO

**Proyecto:** SPECIMEN (TokenCraft)  
**Stack:** Vanilla JS & CSS — Estética Brutalista  
**Versión:** 1.0  

---

## Tabla de Contenidos

1. [Semántica y Estructura HTML](#1-semántica-y-estructura-html)
2. [Accesibilidad (WCAG 2.1 / 2.2)](#2-accesibilidad-wcag-21--22)
3. [Rendimiento (Lighthouse y Core Web Vitals)](#3-rendimiento-lighthouse-y-core-web-vitals)
4. [CSS y Diseño Responsivo (Mobile-First)](#4-css-y-diseño-responsivo-mobile-first)
5. [SEO (Motores de Búsqueda y Compartición Social)](#5-seo-motores-de-búsqueda-y-compartición-social)
6. [Reglas de Oro — Resumen](#6-reglas-de-oro--resumen)
7. [Checklist de Verificación](#7-checklist-de-verificación)

---

## 1. Semántica y Estructura HTML

Un esqueleto HTML lógico, sin sobrecarga de `div`s, es la base sobre la que se construye la accesibilidad, el SEO y la mantenibilidad. Los lectores de pantalla y los rastreadores dependen de él para interpretar la página correctamente.

### ✅ Do's

**Usa HTML5 semántico y landmarks.** Todo el contenido debe residir dentro de zonas con significado:

| Elemento | Uso correcto |
|---|---|
| `<header>` | Cabecera y navegación principal |
| `<nav>` | Menús. Si hay más de uno, diferéncialos con `aria-label` |
| `<main>` | Contenido único de la página (solo puede haber uno) |
| `<aside>` | Contenido complementario (sidebar de configuración, inspector) |
| `<footer>` | Pie de página |

```html
<!-- Ejemplo de estructura landmark correcta -->
<body>
  <header>
    <nav aria-label="Navegación principal">...</nav>
  </header>
  <main id="main-content">
    <h1>SPECIMEN – Design Tokens</h1>
    <aside aria-label="Panel de configuración">...</aside>
  </main>
  <footer>...</footer>
</body>
```

**Jerarquía estricta de encabezados.** Un único `<h1>` por página. Los niveles inferiores (`h2`, `h3`…) deben ser secuenciales y nunca saltarse. Los encabezados forman la tabla de contenidos de un usuario de lector de pantalla.

**Enlace vs. botón nativo.** La elección correcta del elemento evita romper el foco de teclado y el rol implícito:

- Navegación a otra vista o recurso → `<a href="...">`
- Acción en la misma página → `<button type="button">`

**Skip link al contenido principal.** Incluye un enlace de salto visible al recibir el foco que permita omitir la navegación repetitiva:

```html
<!-- Visible solo al recibir foco (Tab) -->
<a href="#main-content" class="skip-link">Saltar al contenido</a>

<style>
  .skip-link {
    position: absolute;
    top: -100%;
    left: 1rem;
  }
  .skip-link:focus {
    top: 1rem;
  }
</style>
```

**Texto alternativo para imágenes.** Toda imagen informativa debe tener `alt` descriptivo. Las imágenes decorativas deben llevar `alt=""` para que los lectores de pantalla las ignoren.

### ❌ Don'ts

- **"Divitis":** nunca uses `<div onclick="...">` como sustituto de un botón. Rompe el foco de teclado, el rol implícito y la activación con tecla.
- **Encabezados decorativos:** no elijas una etiqueta `h*` por su tamaño visual. Usa CSS para el estilo y mantén la semántica limpia.
- **Elementos interactivos anidados:** nunca pongas un `<button>` dentro de un `<a>`, ni viceversa.
- **Omitir el atributo `lang`:** el elemento `<html>` siempre debe declarar el idioma (`lang="es"`) para una correcta pronunciación por parte de los lectores de pantalla.

---

## 2. Accesibilidad (WCAG 2.1 / 2.2)

El objetivo es que cualquier persona, independientemente de sus capacidades visuales, motoras o cognitivas, pueda operar la aplicación completamente con teclado o con tecnologías de asistencia.

### ✅ Do's

**Contraste mínimo (texto y non-text).**  
En una estética brutalista, el alto contraste se logra con paletas extremas. Verifica siempre con el inspector de contraste de Chrome DevTools.

| Tipo de elemento | Ratio mínimo |
|---|---|
| Texto normal (< 18pt o < 14pt bold) | **4.5:1** |
| Texto grande o encabezados | **3:1** |
| Iconos y bordes de input activos | **3:1** |

**Navegación por teclado completa y sin trampas.**

- Orden lógico de `Tab` (coincidente con el orden visual del DOM).
- Todos los controles deben ser activables con `Enter` y, para botones, también con `Space`.
- Si una interacción abre algo (modal, menú), mueve el foco dentro de ese nuevo contexto y permite cerrarlo con `Escape`. Al cerrar, devuelve el foco al elemento que lo activó.

**Indicador de foco visible y distintivo.** Nunca elimines `outline` sin reemplazarlo. `:focus-visible` es muy coherente con la estética brutalista:

```css
/* Foco brutalista: potente y coherente con el sistema visual */
:focus-visible {
  outline: 3px solid #000;
  outline-offset: 2px;
}

/* Nunca hagas esto */
:focus {
  outline: none; /* ❌ */
}
```

**Formularios siempre etiquetados.** El `<label>` debe estar siempre asociado a su control. Si un label visible no es posible, usa `aria-label` o `aria-labelledby`. Para errores, asocia el mensaje con `aria-describedby`:

```html
<label for="accent-color">Color de acento</label>
<input type="color" id="accent-color" name="accent-color">

<!-- Con mensaje de error -->
<label for="token-name">Nombre del token</label>
<input
  type="text"
  id="token-name"
  aria-describedby="token-name-error"
  aria-invalid="true"
>
<span id="token-name-error" role="alert">
  El nombre no puede contener espacios.
</span>
```

**Actualizaciones dinámicas con `aria-live`.** Si el contenido cambia sin recarga (p. ej., resultado de contraste, mensaje de copiado), usa regiones `aria-live` para que el lector de pantalla anuncie el cambio sin interrumpir:

```html
<!-- Para mensajes no urgentes (copia al portapapeles, validaciones) -->
<div aria-live="polite" role="status" class="sr-only"></div>

<!-- Para errores críticos -->
<div aria-live="assertive" role="alert" class="sr-only"></div>
```

**Respeto por las preferencias de movimiento.** Elimina animaciones que puedan causar malestar vestibular:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Área interactiva suficiente.** Botones y enlaces deben tener un área mínima de 44×44 px (WCAG 2.5.5) con separación adecuada entre sí:

```css
.btn {
  min-height: 44px;
  min-width: 44px;
  padding-inline: 1rem;
}
```

### ❌ Don'ts

- **No confíes solo en el color** para transmitir estado. Acompaña siempre con texto o iconos (p. ej., "Contraste insuficiente ●").
- **No uses `tabindex` positivo** (valores `> 0`): rompe el orden natural de navegación. Usa `tabindex="0"` para añadir al flujo o `tabindex="-1"` solo para control mediante script.
- **No omitas el atributo `alt`** en imágenes relevantes. Las decorativas deben tener explícitamente `alt=""`.
- **No uses solo placeholders como etiqueta** de un campo. El `placeholder` desaparece al escribir y no es procesado consistentemente por todos los lectores de pantalla.

---

## 3. Rendimiento (Lighthouse y Core Web Vitals)

SPECIMEN usa JavaScript vanilla y CSS nativo. Esta ventaja permite puntuaciones de Lighthouse cercanas a 100 y excelentes Core Web Vitals. Cada milisegundo de bloqueo o desplazamiento inesperado penaliza la experiencia y el posicionamiento.

### Métricas objetivo

| Métrica | Objetivo | Descripción |
|---|---|---|
| **LCP** | < 2.5 s | Mayor elemento visible en carga |
| **INP** | < 200 ms | Respuesta a interacción del usuario |
| **CLS** | < 0.1 | Estabilidad visual del layout |
| **FCP** | < 1.8 s | Primer pintado de contenido |
| **TTFB** | < 600 ms | Tiempo hasta el primer byte |

### ✅ Do's

**Optimiza el Critical Rendering Path.** CSS crítico inline en `<head>` para el contenido above the fold. El resto de CSS se carga de forma asíncrona:

```html
<head>
  <!-- CSS crítico inline -->
  <style>
    /* Solo estilos del hero y navegación visible inicial */
    :root { --color-bg: #fff; --color-text: #000; }
    body { margin: 0; font-family: sans-serif; }
    header { ... }
  </style>

  <!-- CSS secundario: no bloqueante -->
  <link
    rel="stylesheet"
    href="/styles/main.css"
    media="print"
    onload="this.media='all'"
  >
  <noscript><link rel="stylesheet" href="/styles/main.css"></noscript>

  <!-- Scripts con defer o async -->
  <script src="/js/app.js" defer></script>
</head>
```

**Preconexión y preload de recursos críticos:**

```html
<!-- Preconexión a servidores de fuentes externos -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Preload de la fuente principal en WOFF2 -->
<link
  rel="preload"
  href="/fonts/tu-fuente.woff2"
  as="font"
  type="font/woff2"
  crossorigin
>
```

**Fuentes web sin FOIT.** Usa `font-display: swap` para mostrar texto de respaldo durante la carga y `size-adjust` para minimizar el CLS al cambiar de fuente:

```css
@font-face {
  font-family: 'MiFuente';
  src: url('/fonts/mi-fuente.woff2') format('woff2');
  font-display: swap;
  size-adjust: 98%; /* Ajusta para reducir el salto visual */
}
```

**Imágenes modernas y dimensionadas:**

```html
<!-- Siempre especifica width/height para reservar espacio (evita CLS) -->
<img
  src="/img/specimen-hero.webp"
  alt="Vista general del panel de tokens"
  width="1200"
  height="630"
  loading="lazy"
  decoding="async"
>

<!-- Con srcset para distintas densidades de pantalla -->
<img
  src="/img/token-preview.webp"
  srcset="/img/token-preview@2x.webp 2x"
  alt="Vista previa del token de color"
  width="600"
  height="400"
  loading="lazy"
>
```

**Evita el trabajo innecesario en el hilo principal:**

```js
// ✅ Delegación de eventos en lugar de múltiples listeners
document.querySelector('#token-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  handleAction(btn.dataset.action);
});

// ✅ Debounce para operaciones costosas (cálculo de contraste en tiempo real)
function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const onColorChange = debounce((value) => updateContrastRatio(value));
document.querySelector('#color-input').addEventListener('input', (e) => {
  onColorChange(e.target.value);
});
```

**Caché eficiente.** Versiona los activos estáticos con un hash en el nombre para aprovechar la caché máxima del navegador:

```
# .htaccess o configuración de servidor (Nginx / Caddy)
Cache-Control: public, max-age=31536000, immutable  → styles.abc123.css, app.def456.js
Cache-Control: no-cache                             → index.html
```

### ❌ Don'ts

- **No incrustes imágenes enormes sin optimizar.** Una imagen de 4000 px debe redimensionarse y comprimirse antes de servirse.
- **No importes librerías completas** si solo necesitas una funcionalidad mínima. Prefiere implementaciones nativas.
- **No uses `document.write()`**, importaciones de script síncronas en el `<head>` ni bucles que bloqueen la interfaz.
- **No hagas debounce manual de `scroll` y `resize`** — usa `requestAnimationFrame` o `ResizeObserver` / `IntersectionObserver` para mejor rendimiento.
- **No cambies el layout de forma asíncrona** después de la carga sin reservar espacio previo (banners de cookies, inserción dinámica de componentes).

---

## 4. CSS y Diseño Responsivo (Mobile-First)

La estética brutalista no está peleada con una base CSS robusta. Un layout flexible, predecible y respetuoso con las preferencias del usuario es parte integral del rendimiento (CLS) y la accesibilidad.

### ✅ Do's

**Diseño mobile-first con media queries progresivas.** Define los estilos base para pantallas pequeñas y añade complejidad con `min-width`. Así el dispositivo menos potente solo procesa lo necesario:

```css
/* Base → mobile */
.token-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

/* Tablet → ≥ 768px */
@media (min-width: 48rem) {
  .token-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop → ≥ 1200px */
@media (min-width: 75rem) {
  .token-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

**Unidades relativas y layouts flexibles.** Usa `rem`/`em` para tipografía y espaciados, `%` o `fr` para grids. Evita píxeles fijos en contenedores principales para adaptarte al zoom y a distintos tamaños de fuente:

```css
:root {
  /* Escala tipográfica en rem */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.25rem;   /* 20px */
  --text-xl:   2rem;      /* 32px */
  --text-2xl:  3rem;      /* 48px */

  /* Espaciados en rem */
  --space-xs:  0.25rem;
  --space-sm:  0.5rem;
  --space-md:  1rem;
  --space-lg:  2rem;
  --space-xl:  4rem;
}
```

**Evita el layout shift (CLS).** Asigna `aspect-ratio` o dimensiones explícitas a contenedores de medios e iframes:

```css
/* Reserva de espacio para contenido embebido */
.media-wrapper {
  aspect-ratio: 16 / 9;
  width: 100%;
  overflow: hidden;
}

/* Nunca fijes alturas en contenedores de texto */
.card {
  min-height: 200px; /* ✅ min-height, no height */
}
```

**Animaciones y transiciones bajo control.** Prefiere propiedades que no disparen layout ni pintado:

```css
/* ✅ Solo opacity y transform: compositor thread, sin reflow */
.token-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.token-card:hover {
  transform: translateY(-2px);
}

/* will-change: solo cuando la animación es inminente */
.animating {
  will-change: transform;
}
```

**Modo oscuro y alto contraste.** Aprovecha media queries para adaptar la interfaz sin JavaScript extra:

```css
/* Modo oscuro */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:   #0a0a0a;
    --color-text: #f0f0f0;
    --color-border: #333;
  }
}

/* Alto contraste (Windows High Contrast / Forced Colors) */
@media (forced-colors: active) {
  .btn {
    border: 2px solid ButtonText;
  }
}
```

### ❌ Don'ts

- **No uses `!important` como muleta;** genera una cascada impredecible y dificulta el mantenimiento.
- **No maquetes con `position: absolute` como regla general;** rompe el flujo natural y la accesibilidad cuando el contenido crece o se aplica zoom.
- **No fijes alturas (`height`) en contenedores de texto;** puede cortar contenido al aumentar el tamaño de fuente. Usa `min-height`.
- **No anides selectores más de 3 niveles;** reduce la especificidad innecesaria y mejora la legibilidad.

---

## 5. SEO (Motores de Búsqueda y Compartición Social)

Para que SPECIMEN aparezca en resultados relevantes y se comparta de forma atractiva en LinkedIn, X (Twitter) o Slack, el documento debe proporcionar metadatos completos y una estructura que los bots puedan procesar sin ejecutar JavaScript pesado.

### ✅ Do's

**Metadatos esenciales en `<head>`:**

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>SPECIMEN | Generador de Design Tokens y Validador WCAG</title>
  <meta name="description" content="Crea, valida y exporta design tokens accesibles en tiempo real. Herramienta brutalista para diseñar con accesibilidad desde el primer token.">

  <!-- Open Graph (LinkedIn, Facebook) -->
  <meta property="og:type"        content="website">
  <meta property="og:title"       content="SPECIMEN – Design Tokens y Contraste WCAG">
  <meta property="og:description" content="Herramienta brutalista para diseñar con accesibilidad.">
  <meta property="og:image"       content="https://tusitio.com/img/og-specimen.png">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url"         content="https://tusitio.com/">
  <meta property="og:locale"      content="es_ES">

  <!-- Twitter / X Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="SPECIMEN – Design Tokens y Contraste WCAG">
  <meta name="twitter:description" content="Herramienta brutalista para diseñar con accesibilidad.">
  <meta name="twitter:image"       content="https://tusitio.com/img/og-specimen.png">

  <!-- Canónica -->
  <link rel="canonical" href="https://tusitio.com/">
</head>
```

**Datos estructurados (Schema.org) con JSON-LD:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "SPECIMEN",
  "url": "https://tusitio.com/",
  "description": "Generador de design tokens accesibles con validación WCAG en tiempo real",
  "applicationCategory": "DesignApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "EUR"
  },
  "author": {
    "@type": "Person",
    "name": "Tu Nombre"
  }
}
</script>
```

**Textos de enlace descriptivos.** Los textos de anclaje deben describir el destino, no la acción genérica:

```html
<!-- ❌ -->
<a href="/docs">Haz clic aquí</a>

<!-- ✅ -->
<a href="/docs">Ver documentación de la API de tokens</a>
<a href="/export">Exportar tokens en formato JSON</a>
```

**Robots y sitemap:**

```
# robots.txt
User-agent: *
Allow: /
Sitemap: https://tusitio.com/sitemap.xml
```

> El rendimiento también es SEO. Todos los Core Web Vitals cubiertos en la sección anterior impactan directamente en el posicionamiento en Google.

### ❌ Don'ts

- **No dupliques contenido** entre distintas URLs. Si existen variantes (con parámetros, hash), gestiona la canónica y las redirecciones `301`.
- **No escondas texto relevante** con `display: none` o posicionamiento fuera de pantalla sin alternativa accesible; Google lo ignora o lo penaliza.
- **No abuses del `noindex`** en páginas que deberían ser descubiertas.
- **No dejes el `<title>` o la `meta description` vacíos;** los bots generarán uno automáticamente y probablemente será peor que el tuyo.

---

## 6. Reglas de Oro — Resumen

| Área | Regla de oro | Impacto directo |
|---|---|---|
| **Semántica** | Un `<main>` único, un `<h1>`, elementos nativos (`<button>`, `<a>`) y landmarks con `aria-label` | A11y y SEO |
| **Accesibilidad** | Foco visible, ratio ≥ 4.5:1, `<label>` en todos los inputs, soporte total de teclado y regiones `aria-live` | Usabilidad universal |
| **Rendimiento** | CSS crítico inline, `font-display: swap`, imágenes dimensionadas (WebP/AVIF), JS no bloqueante y zero frameworks | Lighthouse 100 y CWV |
| **CSS** | Mobile-first, unidades relativas, reserva de espacio (CLS), sin `!important` y respeto a `prefers-reduced-motion` | Estabilidad visual e inclusión |
| **SEO** | Meta tags Open Graph, Twitter Card, datos estructurados JSON-LD, enlaces descriptivos y URL canónica | Visibilidad y compartición en redes |

---

## 7. Checklist de Verificación

Usa esta lista antes de cada despliegue o revisión de código.

### Semántica

- [ ] El documento tiene un único `<main>` y un único `<h1>`
- [ ] Los landmarks están presentes: `<header>`, `<nav>`, `<main>`, `<footer>`
- [ ] La jerarquía de encabezados es secuencial (no se saltan niveles)
- [ ] El `<html>` tiene atributo `lang` correcto
- [ ] Existe un skip link funcional hacia `#main-content`

### Accesibilidad

- [ ] Todos los controles funcionan con `Tab`, `Enter`, `Space` y `Escape` donde aplique
- [ ] El foco es visible en todos los elementos interactivos (nunca `outline: none` sin alternativa)
- [ ] El orden de tabulación coincide con el orden visual
- [ ] Contraste de texto ≥ 4.5:1 (normal) y ≥ 3:1 (grande / iconos)
- [ ] Todos los inputs tienen `<label>` asociado o `aria-label`
- [ ] Los errores de formulario usan `aria-describedby` y `aria-invalid`
- [ ] Las actualizaciones dinámicas usan `aria-live` o `role="status"`
- [ ] Las imágenes informativas tienen `alt` descriptivo; las decorativas tienen `alt=""`
- [ ] No se usa solo el color para transmitir estado
- [ ] Los modales gestionan el focus trap y devuelven el foco al cerrar

### Rendimiento

- [ ] CSS crítico está inline en `<head>`; el resto se carga de forma no bloqueante
- [ ] Fuentes cargadas con `font-display: swap` y `preload` de WOFF2
- [ ] Imágenes en WebP o AVIF, con `width` y `height` definidos
- [ ] Imágenes fuera del viewport tienen `loading="lazy"` y `decoding="async"`
- [ ] Scripts usan `defer` o están al final del `<body>`
- [ ] Eventos `scroll`/`resize` están debounced o usan `IntersectionObserver`
- [ ] El DOM no monta nodos innecesarios (sin elementos ocultos cargados en memoria)
- [ ] Los activos estáticos están versionados y con cabeceras de caché largas

### CSS y Layout

- [ ] El layout es mobile-first con `min-width` media queries
- [ ] No hay `height` fijo en contenedores de texto (se usa `min-height`)
- [ ] No hay layout shift al cargar (CLS < 0.1)
- [ ] `prefers-reduced-motion` desactiva animaciones y transiciones
- [ ] `prefers-color-scheme` adapta la paleta (modo oscuro)
- [ ] No se usa `!important` salvo en overrides justificados y documentados

### SEO

- [ ] `<title>` único y descriptivo (50–60 caracteres)
- [ ] `<meta name="description">` presente (120–160 caracteres)
- [ ] Meta tags Open Graph completos (title, description, image, url)
- [ ] Twitter Card configurada
- [ ] URL canónica `<link rel="canonical">` definida
- [ ] Datos estructurados JSON-LD presentes y validados
- [ ] Ningún enlace usa "haz clic aquí" o "más información" como texto ancla
- [ ] `robots.txt` limpio y `sitemap.xml` referenciado

---

*Guía mantenida por el equipo de SPECIMEN · Última actualización: 2025*