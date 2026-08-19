# 🖨️ Print2Web — Copistería & Reprografía Digital A4 Online

**Print2Web** es la plataforma de copistería y reprografía digital A4 bajo demanda de **Tramas Solucions Gràfiques SL** (taller propio en Sant Just Desvern, Barcelona, en activo desde 2008). 

Permite a estudiantes, opositores y profesionales configurar al instante sus impresiones en formato A4 (blanco y negro / color, simple o doble cara, encuadernación espiral y acabados), calcular el presupuesto en tiempo real, pagar de forma segura con Stripe y elegir entre **recogida exprés en taller sin colas** o **envío a domicilio en 24h**.

---

## 🚀 Stack Tecnológico y Arquitectura

- **Frontend:** HTML5 semántico, CSS3 moderno con estética brutalista utilitaria (sin frameworks pesados), JavaScript modular nativo (ES6+).
- **Procesamiento de Documentos:** Lectura y recuento de páginas PDF en el navegador mediante [PDF.js](https://mozilla.github.io/pdf.js/).
- **Backend / API Serverless:** Node.js en Vercel Serverless Functions (`/api/checkout.js`) para creación de sesiones de pago seguras con [Stripe API](https://stripe.com/).
- **Infraestructura & Despliegue:** [Vercel](https://vercel.com/) con URLs limpias, cabeceras de seguridad HTTP y compresión automática.

---

## 📂 Estructura del Proyecto

```text
print2web/
├── 🌐 Archivos de Producción & Despliegue en Raíz (Vercel)
│   ├── index.html              # Landing principal y configurador de impresión A4
│   ├── exito.html              # Página de confirmación tras pago completado
│   ├── cancelado.html          # Página informativa si el pago es cancelado
│   ├── 404.html                # Página de error 404 personalizada con estética brutalista
│   ├── aviso-legal.html        # Información legal de la empresa (LSSI-CE)
│   ├── privacidad.html         # Política de privacidad y protección de datos (RGPD)
│   ├── cookies.html            # Política y desglose de cookies técnicas y analíticas
│   ├── terminos.html           # Términos y condiciones de compra y contratación
│   ├── styles.css              # Hoja de estilos global (estética brutalista, layout responsive)
│   ├── script.js               # Lógica interactiva del configurador, modal y llamadas a API
│   ├── manifest.json           # Manifiesto PWA para instalación y accesos directos
│   ├── robots.txt              # Directivas de rastreo para motores de búsqueda
│   ├── sitemap.xml             # Mapa del sitio XML para indexación SEO
│   └── vercel.json             # Configuración de Vercel (URLs limpias, headers de seguridad)
│
├── ⚡ Backend Serverless
│   └── api/
│       └── checkout.js         # Endpoint serverless para procesar pedidos y sesión de Stripe
│
├── 🖼️ Recursos Multimedia
│   └── img/                    # Iconos SVG, logotipos e imágenes optimizadas
│
├── 📚 Documentación, Análisis y Estrategia (docs/)
│   ├── docs/
│   │   ├── auditorias/         # Auditorías de código, accesibilidad WCAG, UX y buenas prácticas
│   │   │   ├── auditoria_modal.md
│   │   │   ├── buenas_practicas_web.md
│   │   │   └── README.md
│   │   ├── lighthouse/         # Auditorías de rendimiento, Core Web Vitals y PageSpeed
│   │   │   ├── auditoria_lighthouse.md
│   │   │   └── README.md
│   │   ├── estudios/           # Estrategia de producto, modelo de negocio y SEO local
│   │   │   ├── informe_estrategico_producto_negocio.md
│   │   │   └── README.md
│   │   ├── analisis-calor/     # Pautas y capturas de Microsoft Clarity / Hotjar
│   │   │   └── README.md
│   │   ├── legal/              # Informes jurídicos, DPAs y revisiones de políticas
│   │   │   └── README.md
│   │   └── prototipaje/        # Mockups y prototipos visuales responsive
│   │       ├── Movile - Inicio.png
│   │       ├── Tablet - Inicio.png
│   │       ├── Ordenador - Inicio.jpg
│   │       └── README.md
│
├── ⚙️ Configuración del Entorno & Dependencias
│   ├── .env.example            # Plantilla de variables de entorno requeridas
│   ├── .gitignore              # Archivos y carpetas excluidos de control de versiones
│   ├── package.json            # Dependencias y scripts de desarrollo
│   └── package-lock.json       # Árbol de dependencias bloqueado
```

---

## 📖 Documentos Clave y Enlaces de Interés

- 📊 **Estrategia & Negocio:** [Informe Estratégico de Negocio y Producto Digital](file:///c:/Users/oscar/Desktop/print2web/docs/estudios/informe_estrategico_producto_negocio.md)
- ⚡ **Rendimiento:** [Auditoría Lighthouse & Optimización de Assets](file:///c:/Users/oscar/Desktop/print2web/docs/lighthouse/auditoria_lighthouse.md)
- ♿ **Accesibilidad & UX:** [Auditoría del Modal de Confirmación de Pedido](file:///c:/Users/oscar/Desktop/print2web/docs/auditorias/auditoria_modal.md)
- 📋 **Estándares Frontend:** [Guía de Buenas Prácticas (HTML, CSS, a11y, SEO)](file:///c:/Users/oscar/Desktop/print2web/docs/auditorias/buenas_practicas_web.md)
- 🗺️ **Analítica de Sesión:** [Pautas para Análisis de Mapas de Calor](file:///c:/Users/oscar/Desktop/print2web/docs/analisis-calor/README.md)
- 🎨 **Diseño:** [Directrices de Prototipaje y Mockups](file:///c:/Users/oscar/Desktop/print2web/docs/prototipaje/README.md)

---

## 🛠️ Desarrollo Local y Despliegue

### 1. Requisitos Previos
- Node.js (v18 o superior)
- Cuenta en [Vercel](https://vercel.com/) y CLI de Vercel instalado (`npm i -g vercel`)
- Clave de API de Stripe (Modo Test o Live)

### 2. Configurar Variables de Entorno
Copia el archivo `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```
Configura los valores correspondientes en `.env.local`:
```ini
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
VERCEL_ENV=development
```

### 3. Ejecutar en Local con Vercel CLI
Para simular tanto los archivos estáticos como las Serverless Functions (`/api/checkout.js`):
```bash
npx vercel dev
```
La aplicación estará disponible en `http://localhost:3000`.

### 4. Despliegue en Producción en Vercel
1. Conectar el repositorio de GitHub con el proyecto en el panel de Vercel.
2. En la sección **Settings > Environment Variables** de Vercel, añadir:
   - `STRIPE_SECRET_KEY`
   - Cualquier otra variable de pasarela o analítica.
3. Cada `push` a la rama `main` activará automáticamente un nuevo despliegue en producción con las rutas y cabeceras definidas en `vercel.json`.

---

## 🏢 Datos de la Empresa

- **Razón Social:** Tramas Solucions Gràfiques SL (NIF B64817006)
- **Taller Físico:** Ctra. Reial, 15-17, Local 2, 08960 Sant Just Desvern, Barcelona
- **Sitio Web Oficial:** [https://print2web.es](https://print2web.es)
