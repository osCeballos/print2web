# Informe de Auditoría: Modal de Confirmación de Pedido

He revisado exhaustivamente el ciclo de vida del componente analizando `index.html`, `styles.css` y `script.js`.

---

## 📊 Resumen Ejecutivo

El modal de Print2Web tiene una base excelente. Has implementado muy buenas prácticas como la prevención de envíos dobles, el uso de atributos semánticos base (`role="dialog"`, `aria-modal`) y una separación limpia de los EventListeners en JavaScript.

Sin embargo, hay **un fallo crítico en la accesibilidad (la trampa de foco)** que se rompe debido a la naturaleza multi-paso del modal, así como áreas de mejora en el marcado ARIA para lectores de pantalla, la eliminación de estilos *inline* en JS y la falta de animaciones fluidas para pulir la experiencia de usuario general.

---

## 🚨 Tabla de Problemas y Soluciones

| Prioridad | Categoría | Descripción del Problema | Solución Propuesta |
| :--- | :--- | :--- | :--- |
| **Alta** | Accesibilidad | **Trampa de foco (Focus Trap) deficiente.** `script.js` calcula los elementos enfocables (el primero y el último) al abrir el modal. Como el modal tiene pasos ocultos (`display: none`), incluye inputs invisibles. Al navegar con `Tab`, el foco se pierde y se rompe. | Modificar `trapFocus` para filtrar elementos ocultos o recalcular los elementos enfocables cada vez que se llama a `irAPasoModal()`. (Ver fragmento 1 abajo). |
| **Alta** | Accesibilidad | **Uso incorrecto de roles en los pasos.** `.checkout-steps-bar` usa `role="tablist"` pero sus hijos son `<div class="step-item">`. Al no ser botones interactables, un lector de pantalla anunciará "pestañas" que el usuario no puede operar. | Cambiar a una lista semántica (`<ol>` y `<li>`) o usar `aria-label="Progreso del checkout"` y `aria-current="step"` para el paso activo. |
| **Media** | UX / Accesibilidad | **Foco inicial poco óptimo.** Al abrirse el modal, el foco se envía directamente al botón de cerrar (`modalClose.focus()`). | Lo ideal para un diálogo de resumen es que el foco se coloque en un elemento que fuerce a leer el contenido inicial, como el título (`<h3 tabindex="-1">`) o el primer botón de acción ("Continuar paso 2"). |
| **Media** | Código / Mantenimiento | **Estilos *inline* para gestionar pasos.** La función `irAPasoModal` utiliza `element.style.display = 'none'` o `'block'`. | Es más mantenible hacer un *toggle* de clases CSS (ej. `paso.classList.add('is-hidden')`) y manejar el `display: none` en la hoja de estilos. |
| **Media** | Accesibilidad | **Total dinámico silencioso y sin descripción.** El modal no usa `aria-describedby` y el precio final actualizado (`#modal-checkout-total`) no notifica a los lectores de pantalla cuando cambia entre pasos. | Añadir `aria-live="polite"` al `#modal-checkout-total` y `aria-describedby="modal-detail-summary"` al contenedor del modal. |
| **Baja** | Rendimiento / UX | **Aparición brusca (Sin animación).** El modal aparece instántaneamente, perdiendo la oportunidad de guiar la atención del usuario de manera fluida. | Añadir una transición CSS sutil en `.modal-overlay` usando `opacity` y `transform`, respetando `prefers-reduced-motion`. |

---

## 🛠 Fragmentos de Código Sugeridos

### 1. Arreglar la trampa de foco para elementos dinámicos (`script.js`)

Para solucionar el problema de los inputs ocultos, la función que maneja el tabulador debe recalcular dinámicamente qué elementos están realmente visibles, y debe llamarse cada vez que cambias de paso.

```javascript
function trapFocus(element) {
    // Si ya existe un handler previo, limpiarlo antes de volver a asignar
    releaseFocusTrap(element);

    function handler(e) {
        if (e.key !== 'Tab') return;
        
        // Calcular dinámicamente los elementos visibles en el momento exacto
        const focusable = Array.from(element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0); // Solo visibles
        
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
    element.addEventListener('keydown', handler);
    element._focusTrapHandler = handler;
}

// IMPORTANTE: Asegúrate de llamar a trapFocus(modal) al final de tu función irAPasoModal()
```

### 2. Mejorar semántica del HTML (`index.html`)

```html
<!-- En tu modal principal -->
<div id="modal" class="modal-overlay" hidden role="dialog" aria-modal="true" 
     aria-labelledby="modal-title" aria-describedby="modal-detail-summary">
     
<!-- Quitar role="tablist" del checkout-steps-bar y cambiar a lista -->
<ol class="checkout-steps-bar" aria-label="Progreso del proceso de compra">
  <li class="step-item active" id="step-tab-1" aria-current="step">
    <!-- ... -->
  </li>
  <li class="step-item" id="step-tab-2">
     <!-- ... -->
  </li>
</ol>
```

### 3. Animación accesible (`styles.css`)

```css
.modal-overlay {
  /* ... tus estilos base actuales ... */
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.modal-overlay:not([hidden]) {
  display: flex; /* Override para quitar display: none y usar visibility */
  opacity: 1;
  visibility: visible;
}

.modal-card {
  /* ... tus estilos base ... */
  transform: translateY(20px) scale(0.98);
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.modal-overlay:not([hidden]) .modal-card {
  transform: translateY(0) scale(1);
}

/* Respetar configuración del sistema operativo */
@media (prefers-reduced-motion: reduce) {
  .modal-overlay, .modal-card {
    transition: none;
    transform: none;
  }
}
```

---

## ✅ Checklist de Acciones (Lighthouse 100%)

- [ ] Reemplazar `role="tablist"` por `<ol>` y `<li>` en la barra superior.
- [ ] Incorporar `aria-current="step"` al paso que esté activo actualmente a través del JavaScript.
- [ ] Añadir `aria-describedby` apuntando al contenedor del resumen.
- [ ] Aplicar filtro de visibilidad `.filter(el => el.offsetWidth > 0)` en el querySelector de la función `trapFocus`.
- [ ] Actualizar el foco inicial (`abrirModal`) para que vaya al título (agregándole `tabindex="-1"`) o al botón "Continuar", en vez de a la "X" de cerrar.
- [ ] Cambiar las asignaciones de `style.display = 'none'` en JS por una clase CSS `.is-hidden` con `display: none !important`.
- [ ] Añadir `aria-live="polite"` al ID `#modal-checkout-total`.

## 💡 Recomendaciones adicionales

* **Áreas Táctiles en Móvil:** Revisa en un dispositivo móvil real que el botón `<button id="modal-close">×</button>` tenga, al menos, un área clickeable de **44x44px** (puedes arreglarlo fácilmente incrementando el `padding` o asignándole una anchura y altura fijas y mostrándolo como `flex`).
* **Mensaje de Loading en el Pago:** El botón de "Pagar" se deshabilita correctamente. Recomiendo agregar un ligero spinner SVG dentro del botón al presionar, esto reduce inmensamente la ansiedad de los usuarios durante el lapso de `fetch('/api/checkout')` en conexiones lentas.
