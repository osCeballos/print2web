(function() {
    'use strict';

    // Inyección dinámica de datos estructurados JSON-LD (Schema.org) para cumplir con CSP sin unsafe-inline
    try {
        const schemaScript = document.createElement('script');
        schemaScript.type = 'application/ld+json';
        schemaScript.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "Print2Web by Tramas Solucions Gràfiques SL",
            "legalName": "Tramas Soluciones Gráficas SL",
            "description": "Plataforma de impresión online de Tramas Solucions Gràfiques SL. Impresión digital de alta resolución (hasta 1800 dpi) con tintas ecológicas y taller propio.",
            "url": "https://tramasweb.com/",
            "telephone": "+34933722949",
            "email": "info@tramasweb.com",
            "foundingDate": "2008",
            "image": "https://tramasweb.com/img/logotipo.webp",
            "logo": "https://tramasweb.com/img/logotipo.webp",
            "sameAs": ["https://tramasweb.com"],
            "openingHours": ["Mo-Fr 09:00-18:00"],
            "priceRange": "€€",
            "currenciesAccepted": "EUR",
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "reviewCount": "54"
            },
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "Carretera Reial, 15-17, Primer Local",
                "addressLocality": "Sant Just Desvern",
                "addressRegion": "Barcelona",
                "postalCode": "08960",
                "addressCountry": "ES"
            }
        });
        document.head.appendChild(schemaScript);
    } catch (e) {
        console.warn('Error al inyectar JSON-LD:', e);
    }

    let currentOrderId = null;

    function obtenerOGenerarOrderId() {
        try {
            let orderId = sessionStorage.getItem('p2w_current_order_id');
            if (!orderId) {
                orderId = 'p2w_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                sessionStorage.setItem('p2w_current_order_id', orderId);
            }
            return orderId;
        } catch (e) {
            if (!currentOrderId) {
                currentOrderId = 'p2w_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            }
            return currentOrderId;
        }
    }

    function resetearOrderId() {
        currentOrderId = null;
        try {
            sessionStorage.removeItem('p2w_current_order_id');
        } catch (e) {
            // Fallback silencioso
        }
    }

    // ----------------------------------------------------------------
    // Referencias DOM principales del formulario de impresión
    // ----------------------------------------------------------------
    const form = document.getElementById('print-form');
    const numPaginas = document.getElementById('num-paginas');
    const numCopias = document.getElementById('num-copias');
    const modoColor = document.getElementById('modo-color');
    const modoDiapositiva = document.getElementById('modo-diapositiva');
    const encuadernado = document.getElementById('encuadernado');
    const envio = document.getElementById('envio');
    const fileInput = document.getElementById('file-input');
    const fileNameSpan = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const formErrorMsg = document.getElementById('form-error-msg');
    const totalAmountSpan = document.getElementById('total-amount');
    const addFileBtn = document.getElementById('add-file-btn');
    const comprarBtn = document.getElementById('comprar-btn');
    const headerCta = document.getElementById('header-cta');
    const mockupContainer = document.getElementById('mockup-container');

    // Referencias DOM para el Mockup Interactivo A4
    const mockupSheet = document.getElementById('mockup-sheet');
    const mockupBinding = document.getElementById('mockup-binding');
    const mockupDefaultContent = document.getElementById('mockup-default-content');
    const mockupPreviewContent = document.getElementById('mockup-preview-content');
    const mockupPreviewImg = document.getElementById('mockup-preview-img');
    const mockupPreviewPdf = document.getElementById('mockup-preview-pdf');
    const mockupPdfCanvas = document.getElementById('mockup-pdf-canvas');
    const mockupPreviewDoc = document.getElementById('mockup-preview-doc');
    const mockupDocTitle = document.getElementById('mockup-doc-title');
    const mockupDocPages = document.getElementById('mockup-doc-pages');

    // Referencias DOM para el Modal de Checkout Multi-Paso
    const modal = document.getElementById('modal');
    const modalClose = document.getElementById('modal-close');
    const stepTab1 = document.getElementById('step-tab-1');
    const stepTab2 = document.getElementById('step-tab-2');
    const stepTab3 = document.getElementById('step-tab-3');
    
    const checkoutStep1 = document.getElementById('checkout-step-1');
    const checkoutStep2 = document.getElementById('checkout-step-2');
    const checkoutStep3 = document.getElementById('checkout-step-3');
    const checkoutStep4 = document.getElementById('checkout-step-4');

    const modalDetailSummary = document.getElementById('modal-detail-summary');
    const modalCheckoutTotal = document.getElementById('modal-checkout-total');
    const modalErrorBanner = document.getElementById('modal-error-banner');

    const modalPrevBtn = document.getElementById('modal-prev-btn');
    const modalNextBtn = document.getElementById('modal-next-btn');
    const confirmPayBtn = document.getElementById('confirm-pay-btn');

    // Datos del Cliente y Modalidad de Entrega
    const custName = document.getElementById('cust-name');
    const custEmail = document.getElementById('cust-email');
    const custPhone = document.getElementById('cust-phone');
    const deliveryOptionEnvio = document.getElementById('delivery-option-envio');
    const deliveryOptionRecogida = document.getElementById('delivery-option-recogida');
    const shippingAddressFields = document.getElementById('shipping-address-fields');
    const custAddress = document.getElementById('cust-address');
    const custCp = document.getElementById('cust-cp');
    const custCity = document.getElementById('cust-city');

    // Métodos de Pago (Manejado 100% por pasarela segura Stripe Checkout)
    const orderCodeDisplay = document.getElementById('order-code-display');

    const orderReceiptSummary = document.getElementById('order-receipt-summary');
    const printReceiptBtn = document.getElementById('print-receipt-btn');
    const newOrderBtn = document.getElementById('new-order-btn');

    // Variables de Estado
    let currentObjectUrl = null;
    let detectedOrientation = 'vertical'; // 'vertical' o 'horizontal'
    let currentModalStep = 1;
    let selectedPaymentMethod = 'bizum';
    let currentOrderData = null;

    // Configurar worker de PDF.js si está disponible
    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // Precios Base
    const PRECIO_PAGINA_COLOR = 0.50;
    const PRECIO_PAGINA_BW = 0.30;
    const PRECIO_ENCUADERNACION = 2.00;
    const PRECIO_ENVIO = 5.00;

    // ----------------------------------------------------------------
    // Cálculo Dinámico de Total
    // ----------------------------------------------------------------
    function calcularTotal() {
        if (!numPaginas || !modoColor) return 0;
        const numP = Math.max(1, parseInt(numPaginas.value, 10) || 1);
        const copias = numCopias ? Math.max(1, parseInt(numCopias.value, 10) || 1) : 1;
        const color = modoColor.value === 'color';
        const precioPagina = color ? PRECIO_PAGINA_COLOR : PRECIO_PAGINA_BW;

        let totalImprenta = (numP * precioPagina * copias);
        if (encuadernado && encuadernado.checked) {
            totalImprenta += (PRECIO_ENCUADERNACION * copias);
        }

        let costoEnvio = 0;
        const esRecogidaEnTienda = (deliveryOptionRecogida && deliveryOptionRecogida.checked);
        
        // Si no está seleccionada recogida presencial y el envío a domicilio está activo
        if (!esRecogidaEnTienda && envio && envio.checked) {
            costoEnvio = PRECIO_ENVIO;
        }

        let finalTotal = Math.round((totalImprenta + costoEnvio) * 100) / 100;
        return Math.max(0.50, finalTotal);
    }

    function actualizarTotal() {
        const total = calcularTotal();
        if (totalAmountSpan) {
            totalAmountSpan.textContent = total.toFixed(2);
        }
        if (modalCheckoutTotal) {
            modalCheckoutTotal.textContent = total.toFixed(2) + ' €';
        }
    }

    // ----------------------------------------------------------------
    // Drag & Drop sobre el Visor Mockup A4
    // ----------------------------------------------------------------
    if (mockupContainer) {
        ['dragenter', 'dragover'].forEach(eventName => {
            mockupContainer.addEventListener(eventName, function(e) {
                e.preventDefault();
                e.stopPropagation();
                mockupContainer.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            mockupContainer.addEventListener(eventName, function(e) {
                e.preventDefault();
                e.stopPropagation();
                mockupContainer.classList.remove('drag-over');
            }, false);
        });

        mockupContainer.addEventListener('drop', function(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0 && fileInput) {
                fileInput.files = files;
                actualizarPrevisualizacionMockup();
                ocultarErrorFormulario();
            }
        });
    }

    // ----------------------------------------------------------------
    // Actualización visual del Mockup A4
    // ----------------------------------------------------------------
    function actualizarOrientacionMockup() {
        if (!mockupSheet) return;
        if (detectedOrientation === 'horizontal') {
            mockupSheet.classList.add('is-horizontal');
        } else {
            mockupSheet.classList.remove('is-horizontal');
        }
        actualizarEncuadernadoMockup();
    }

    function actualizarEncuadernadoMockup() {
        if (!mockupBinding || !mockupSheet) return;
        const esEncuadernado = encuadernado && encuadernado.checked;

        mockupSheet.classList.remove('has-spiral-left', 'has-spiral-top');
        mockupBinding.classList.remove('mockup-binding-left', 'mockup-binding-top');

        if (esEncuadernado) {
            mockupBinding.hidden = false;
            mockupBinding.style.display = 'block';
            if (detectedOrientation === 'horizontal') {
                mockupBinding.classList.add('mockup-binding-top');
                mockupSheet.classList.add('has-spiral-top');
            } else {
                mockupBinding.classList.add('mockup-binding-left');
                mockupSheet.classList.add('has-spiral-left');
            }
        } else {
            mockupBinding.hidden = true;
            mockupBinding.style.display = 'none';
        }
    }

    function actualizarModoColorMockup() {
        if (!mockupSheet || !modoColor) return;
        const esBW = modoColor.value === 'bw';
        if (esBW) {
            mockupSheet.classList.add('is-grayscale');
        } else {
            mockupSheet.classList.remove('is-grayscale');
        }
    }

    function actualizarPaginasBadgeMockup() {
        if (!mockupDocPages) return;
        const numP = numPaginas ? Math.max(1, parseInt(numPaginas.value, 10) || 1) : 1;
        const copias = numCopias ? Math.max(1, parseInt(numCopias.value, 10) || 1) : 1;
        mockupDocPages.textContent = `${numP} pág${numP > 1 ? 's' : ''} (${copias} copia${copias > 1 ? 's' : ''})`;
    }

    function renderizarPagina1PDF(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const typedarray = new Uint8Array(e.target.result);
            if (!window.pdfjsLib) {
                mostrarTarjetaDocumento(file.name);
                return;
            }

            pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
                if (numPaginas && pdf.numPages) {
                    numPaginas.value = pdf.numPages;
                    actualizarTotal();
                    actualizarPaginasBadgeMockup();
                }

                pdf.getPage(1).then(function(page) {
                    if (!mockupPdfCanvas) return;

                    const unscaledViewport = page.getViewport({ scale: 1 });
                    detectedOrientation = (unscaledViewport.width > unscaledViewport.height) ? 'horizontal' : 'vertical';
                    actualizarOrientacionMockup();

                    requestAnimationFrame(function() {
                        const context = mockupPdfCanvas.getContext('2d');
                        const parentContainer = mockupSheet || mockupPdfCanvas.parentElement;
                        const targetWidth = parentContainer.clientWidth || 320;
                        const scale = targetWidth / unscaledViewport.width;
                        const viewport = page.getViewport({ scale: scale });

                        const outputScale = window.devicePixelRatio || 1;
                        mockupPdfCanvas.width = Math.floor(viewport.width * outputScale);
                        mockupPdfCanvas.height = Math.floor(viewport.height * outputScale);
                        mockupPdfCanvas.style.width = Math.floor(viewport.width) + 'px';
                        mockupPdfCanvas.style.height = Math.floor(viewport.height) + 'px';

                        context.scale(outputScale, outputScale);

                        const renderContext = {
                            canvasContext: context,
                            viewport: viewport
                        };
                        page.render(renderContext).promise.then(function() {
                            if (mockupPdfCanvas) mockupPdfCanvas.style.display = 'block';
                            if (mockupPreviewImg) mockupPreviewImg.style.display = 'none';
                            if (mockupPreviewPdf) mockupPreviewPdf.style.display = 'none';
                            if (mockupPreviewDoc) mockupPreviewDoc.style.display = 'none';
                        });
                    });
                });
            }).catch(function() {
                mostrarTarjetaDocumento(file.name);
            });
        };
        reader.readAsArrayBuffer(file);
    }

    function mostrarTarjetaDocumento(fileName) {
        if (mockupPdfCanvas) mockupPdfCanvas.style.display = 'none';
        if (mockupPreviewImg) mockupPreviewImg.style.display = 'none';
        if (mockupPreviewPdf) mockupPreviewPdf.style.display = 'none';
        if (mockupPreviewDoc) {
            mockupPreviewDoc.style.display = 'flex';
            if (mockupDocTitle) mockupDocTitle.textContent = fileName;
            actualizarPaginasBadgeMockup();
        }
    }

    function actualizarPrevisualizacionMockup() {
        if (!fileInput) return;
        const files = fileInput.files;

        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }

        if (!files || files.length === 0) {
            if (numPaginas) numPaginas.value = 1;
            detectedOrientation = 'vertical';
            actualizarOrientacionMockup();
            actualizarTotal();
            actualizarPaginasBadgeMockup();
            if (mockupDefaultContent) mockupDefaultContent.style.display = 'block';
            if (mockupPreviewContent) mockupPreviewContent.style.display = 'none';
            if (mockupPreviewImg) mockupPreviewImg.style.display = 'none';
            if (mockupPdfCanvas) mockupPdfCanvas.style.display = 'none';
            if (mockupPreviewPdf) mockupPreviewPdf.style.display = 'none';
            if (mockupPreviewDoc) mockupPreviewDoc.style.display = 'none';
            return;
        }

        const file = files[0];
        const fileName = file.name;
        const fileType = file.type || '';
        const ext = fileName.split('.').pop().toLowerCase();

        if (mockupDefaultContent) mockupDefaultContent.style.display = 'none';
        if (mockupPreviewContent) mockupPreviewContent.style.display = 'flex';

        if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            if (numPaginas) numPaginas.value = 1;
            actualizarTotal();
            actualizarPaginasBadgeMockup();
            currentObjectUrl = URL.createObjectURL(file);
            if (mockupPreviewImg) {
                mockupPreviewImg.src = currentObjectUrl;
                mockupPreviewImg.style.display = 'block';
                
                const img = new Image();
                img.onload = function() {
                    detectedOrientation = (img.naturalWidth > img.naturalHeight) ? 'horizontal' : 'vertical';
                    actualizarOrientacionMockup();
                };
                img.src = currentObjectUrl;
            }
            if (mockupPdfCanvas) mockupPdfCanvas.style.display = 'none';
            if (mockupPreviewPdf) mockupPreviewPdf.style.display = 'none';
            if (mockupPreviewDoc) mockupPreviewDoc.style.display = 'none';
        } else if (fileType === 'application/pdf' || ext === 'pdf') {
            renderizarPagina1PDF(file);
        } else {
            if (numPaginas) numPaginas.value = 1;
            detectedOrientation = 'vertical';
            actualizarOrientacionMockup();
            mostrarTarjetaDocumento(fileName);
            actualizarTotal();
            actualizarPaginasBadgeMockup();
        }
    }

    // ----------------------------------------------------------------
    // Validación previa al pedido
    // ----------------------------------------------------------------
    function mostrarErrorFormulario(mensaje) {
        if (!formErrorMsg) return;
        formErrorMsg.textContent = mensaje;
        formErrorMsg.hidden = false;
        formErrorMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function ocultarErrorFormulario() {
        if (!formErrorMsg) return;
        formErrorMsg.hidden = true;
        formErrorMsg.textContent = '';
    }

    function mostrarErrorModal(mensaje) {
        if (!modalErrorBanner) return;
        modalErrorBanner.textContent = mensaje;
        modalErrorBanner.hidden = false;
    }

    function ocultarErrorModal() {
        if (!modalErrorBanner) return;
        modalErrorBanner.hidden = true;
        modalErrorBanner.textContent = '';
    }

    function validarFormularioPrincipal() {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            mostrarErrorFormulario('⚠️ Por favor, selecciona o arrastra tu archivo A4 antes de continuar.');
            if (addFileBtn) addFileBtn.focus();
            return false;
        }

        const numP = parseInt(numPaginas ? numPaginas.value : '1', 10);
        if (isNaN(numP) || numP < 1) {
            mostrarErrorFormulario('⚠️ El número de páginas debe ser al menos 1.');
            if (numPaginas) numPaginas.focus();
            return false;
        }

        const numC = parseInt(numCopias ? numCopias.value : '1', 10);
        if (isNaN(numC) || numC < 1) {
            mostrarErrorFormulario('⚠️ El número de copias debe ser al menos 1.');
            if (numCopias) numCopias.focus();
            return false;
        }

        ocultarErrorFormulario();
        return true;
    }

    // ----------------------------------------------------------------
    // Controlador de Pasos del Modal de Checkout Multi-Paso
    // ----------------------------------------------------------------
    function irAPasoModal(paso) {
        currentModalStep = paso;
        ocultarErrorModal();

        // Ocultar todos los paneles de pasos
        if (checkoutStep1) checkoutStep1.classList.add('is-hidden');
        if (checkoutStep2) checkoutStep2.classList.add('is-hidden');
        if (checkoutStep3) checkoutStep3.classList.add('is-hidden');
        if (checkoutStep4) checkoutStep4.classList.add('is-hidden');

        // Actualizar pestañas indicadoras
        if (stepTab1) {
            stepTab1.classList.toggle('active', paso === 1);
            if (paso === 1) stepTab1.setAttribute('aria-current', 'step'); else stepTab1.removeAttribute('aria-current');
        }
        if (stepTab2) {
            stepTab2.classList.toggle('active', paso === 2);
            if (paso === 2) stepTab2.setAttribute('aria-current', 'step'); else stepTab2.removeAttribute('aria-current');
        }
        if (stepTab3) {
            stepTab3.classList.toggle('active', paso === 3);
            if (paso === 3) stepTab3.setAttribute('aria-current', 'step'); else stepTab3.removeAttribute('aria-current');
        }

        // Actualizar visibilidad de botones
        if (paso === 1) {
            if (checkoutStep1) checkoutStep1.classList.remove('is-hidden');
            if (modalPrevBtn) modalPrevBtn.classList.add('is-hidden');
            if (modalNextBtn) {
                modalNextBtn.classList.remove('is-hidden');
                modalNextBtn.textContent = 'Continuar a Datos & Entrega →';
            }
            if (confirmPayBtn) confirmPayBtn.classList.add('is-hidden');
            renderizarResumenPaso1();
        } else if (paso === 2) {
            if (checkoutStep2) checkoutStep2.classList.remove('is-hidden');
            if (modalPrevBtn) modalPrevBtn.classList.remove('is-hidden');
            if (modalNextBtn) {
                modalNextBtn.classList.remove('is-hidden');
                modalNextBtn.textContent = 'Continuar al Pago →';
            }
            if (confirmPayBtn) confirmPayBtn.classList.add('is-hidden');
        } else if (paso === 3) {
            if (checkoutStep3) checkoutStep3.classList.remove('is-hidden');
            if (modalPrevBtn) modalPrevBtn.classList.remove('is-hidden');
            if (modalNextBtn) modalNextBtn.classList.add('is-hidden');
            if (confirmPayBtn) confirmPayBtn.classList.remove('is-hidden');
            actualizarTotal();
        } else if (paso === 4) {
            // Paso Éxito
            if (checkoutStep4) checkoutStep4.classList.remove('is-hidden');
            if (modalPrevBtn) modalPrevBtn.classList.add('is-hidden');
            if (modalNextBtn) modalNextBtn.classList.add('is-hidden');
            if (confirmPayBtn) confirmPayBtn.classList.add('is-hidden');
        }

        trapFocus(modal);
    }

    function renderizarResumenPaso1() {
        if (!modalDetailSummary) return;
        const total = calcularTotal();
        const numP = numPaginas ? numPaginas.value : 1;
        const copias = numCopias ? numCopias.value : 1;
        const color = (modoColor && modoColor.value === 'color') ? 'Color (0,50€/pág)' : 'Blanco y negro (0,30€/pág)';
        const diapo = (modoDiapositiva && modoDiapositiva.value === 'simple') ? 'Una cara (Simple)' : 'Dos caras (Doble)';
        const enc = (encuadernado && encuadernado.checked) ? `Sí (+${(PRECIO_ENCUADERNACION * copias).toFixed(2)}€)` : 'No';
        const envText = (envio && envio.checked) ? 'Envío a domicilio (+5,00€)' : 'Recogida presencial gratuita';
        const fileName = (fileInput && fileInput.files && fileInput.files.length > 0) ? fileInput.files[0].name : 'Documento';

        modalDetailSummary.innerHTML = `
            <p><strong>Archivo adjunto:</strong> ${fileName}</p>
            <p><strong>Formato de papel:</strong> A4 Estándar (210 x 297 mm)</p>
            <p><strong>Páginas por ejemplar:</strong> ${numP} pág${numP > 1 ? 's' : ''}</p>
            <p><strong>Ejemplares (Copias):</strong> ${copias}</p>
            <p><strong>Modo de color:</strong> ${color}</p>
            <p><strong>Caras de impresión:</strong> ${diapo}</p>
            <p><strong>Encuadernación espiral:</strong> ${enc}</p>
            <p><strong>Opción de entrega actual:</strong> ${envText}</p>
            <hr style="border:none; border-top: 1px solid var(--gray-200); margin: 12px 0;">
            <p style="font-size: 1.1rem; color: var(--cyan);"><strong>Total estimado:</strong> <span style="font-size: 1.25rem; font-weight: 800; color: var(--black);">${total.toFixed(2)} €</span></p>
        `;
    }

    // Modalidad de Entrega (Envío vs Recogida)
    function actualizarOpcionesEntregaUI() {
        const esEnvio = deliveryOptionEnvio && deliveryOptionEnvio.checked;
        if (shippingAddressFields) {
            shippingAddressFields.style.display = esEnvio ? 'grid' : 'none';
        }
        // Marcar o desmarcar la casilla principal de envío
        if (envio) {
            envio.checked = esEnvio;
        }
        actualizarTotal();
    }

    if (deliveryOptionEnvio) deliveryOptionEnvio.addEventListener('change', actualizarOpcionesEntregaUI);
    if (deliveryOptionRecogida) deliveryOptionRecogida.addEventListener('change', actualizarOpcionesEntregaUI);


    // Validar Paso 2 (Datos de Cliente y Entrega)
    function validarPaso2() {
        if (!custName || !custName.value.trim()) {
            mostrarErrorModal('⚠️ Por favor, ingresa tu Nombre y Apellidos.');
            if (custName) custName.focus();
            return false;
        }
        if (!custEmail || !custEmail.value.trim() || !custEmail.value.includes('@')) {
            mostrarErrorModal('⚠️ Por favor, ingresa un correo electrónico válido.');
            if (custEmail) custEmail.focus();
            return false;
        }
        if (!custPhone || !custPhone.value.trim()) {
            mostrarErrorModal('⚠️ Por favor, ingresa un número de teléfono de contacto.');
            if (custPhone) custPhone.focus();
            return false;
        }

        const esEnvio = deliveryOptionEnvio && deliveryOptionEnvio.checked;
        if (esEnvio) {
            if (!custAddress || !custAddress.value.trim()) {
                mostrarErrorModal('⚠️ Por favor, ingresa tu dirección de envío.');
                if (custAddress) custAddress.focus();
                return false;
            }
            if (!custCp || !custCp.value.trim()) {
                mostrarErrorModal('⚠️ Por favor, ingresa el código postal.');
                if (custCp) custCp.focus();
                return false;
            }
            if (!custCity || !custCity.value.trim()) {
                mostrarErrorModal('⚠️ Por favor, ingresa la ciudad / población.');
                if (custCity) custCity.focus();
                return false;
            }
        }
        return true;
    }

    // Finalización del Pedido y Redirección a Stripe Checkout
    if (confirmPayBtn) {
        confirmPayBtn.addEventListener('click', async function() {
            const originalText = confirmPayBtn.innerHTML;
            confirmPayBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><style>@keyframes modal-spin{100%{transform:rotate(360deg)}}.spin-grp{transform-origin:center;animation:modal-spin 1s linear infinite}</style><g class="spin-grp"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></g></svg> Procesando...';
            confirmPayBtn.disabled = true;

            try {
                const formData = new FormData();
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    formData.append('documento', fileInput.files[0]);
                } else {
                    throw new Error("Falta el documento adjunto.");
                }

                const hpInput = document.getElementById('website_hp');
                if (hpInput) {
                    formData.append('website_hp', hpInput.value);
                }

                formData.append('orderId', obtenerOGenerarOrderId());

                formData.append('numPaginas', numPaginas ? numPaginas.value : '1');
                formData.append('numCopias', numCopias ? numCopias.value : '1');
                formData.append('modoColor', modoColor ? modoColor.value : 'color');
                formData.append('modoDiapositiva', modoDiapositiva ? modoDiapositiva.value : 'simple');
                formData.append('encuadernado', encuadernado ? encuadernado.checked : 'false');
                formData.append('envio', envio ? envio.checked : 'false');
                
                formData.append('custName', custName ? custName.value.trim() : '');
                formData.append('custEmail', custEmail ? custEmail.value.trim() : '');
                formData.append('custPhone', custPhone ? custPhone.value.trim() : '');
                formData.append('custAddress', custAddress ? custAddress.value.trim() : '');
                formData.append('custCp', custCp ? custCp.value.trim() : '');
                formData.append('custCity', custCity ? custCity.value.trim() : '');

                const response = await fetch('/api/checkout', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error de comunicación con el servidor');
                }

                const data = await response.json();
                
                // Redirigir a Stripe Checkout
                window.location.href = data.url;

            } catch (error) {
                console.error(error);
                mostrarErrorModal('⚠️ Error: ' + error.message);
                confirmPayBtn.innerHTML = originalText;
                confirmPayBtn.disabled = false;
            }
        });
    }

    // Imprimir Recibo / Factura
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', function() {
            window.print();
        });
    }

    // Realizar otro pedido (Reset)
    if (newOrderBtn) {
        newOrderBtn.addEventListener('click', function() {
            cerrarModal();
            resetearOrderId();
            if (form) form.reset();
            if (fileInput) fileInput.value = '';
            actualizarNombreArchivo();
            actualizarPrevisualizacionMockup();
            actualizarTotal();
        });
    }

    // Apertura y Cierre del Modal
    function abrirModal() {
        if (!validarFormularioPrincipal()) return;
        if (!modal) return;
        modal.hidden = false;
        // Forzar layout para desencadenar la animación
        void modal.offsetWidth;
        modal.classList.add('is-open');
        irAPasoModal(1);
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.focus();
    }

    function cerrarModal() {
        if (!modal) return;
        modal.classList.remove('is-open');
        setTimeout(() => {
            modal.hidden = true;
            releaseFocusTrap(modal);
            if (comprarBtn) comprarBtn.focus();
        }, 300); // 300ms debe coincidir con la transición en CSS
    }

    function trapFocus(element) {
        releaseFocusTrap(element);

        function handler(e) {
            if (e.key !== 'Tab') return;
            
            const focusable = Array.from(element.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);
            
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

    function releaseFocusTrap(element) {
        if (element._focusTrapHandler) {
            element.removeEventListener('keydown', element._focusTrapHandler);
            delete element._focusTrapHandler;
        }
    }

    // ----------------------------------------------------------------
    // Asignación de Event Listeners
    // ----------------------------------------------------------------
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            abrirModal();
        });
        form.addEventListener('change', function() {
            actualizarTotal();
            actualizarEncuadernadoMockup();
            actualizarModoColorMockup();
            ocultarErrorFormulario();
        });
        form.addEventListener('input', function() {
            actualizarTotal();
            actualizarPaginasBadgeMockup();
            ocultarErrorFormulario();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            actualizarPrevisualizacionMockup();
            ocultarErrorFormulario();
        });
        fileInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.click();
            }
        });
    }

    if (encuadernado) {
        encuadernado.addEventListener('change', actualizarEncuadernadoMockup);
    }
    if (modoColor) {
        modoColor.addEventListener('change', actualizarModoColorMockup);
    }
    if (numPaginas) {
        numPaginas.addEventListener('input', actualizarPaginasBadgeMockup);
        numPaginas.addEventListener('change', actualizarPaginasBadgeMockup);
    }
    if (numCopias) {
        numCopias.addEventListener('input', function() {
            actualizarTotal();
            actualizarPaginasBadgeMockup();
        });
        numCopias.addEventListener('change', function() {
            actualizarTotal();
            actualizarPaginasBadgeMockup();
        });
    }

    if (comprarBtn) {
        comprarBtn.addEventListener('click', abrirModal);
    }
    if (modalClose) {
        modalClose.addEventListener('click', cerrarModal);
    }
    if (modal) {
        modal.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') cerrarModal();
        });
        modal.addEventListener('click', function(e) {
            if (e.target === modal) cerrarModal();
        });
    }

    if (addFileBtn && fileInput) {
        addFileBtn.addEventListener('click', function() {
            fileInput.click();
        });
    }

    if (headerCta) {
        headerCta.addEventListener('click', function(e) {
            e.preventDefault();
            const section = document.getElementById('imprimir');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
                if (numPaginas) setTimeout(() => numPaginas.focus(), 300);
            }
        });
    }

    const contactForm = document.getElementById('contact-form');
    const contactFeedback = document.getElementById('contact-feedback');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (contactFeedback) {
                contactFeedback.hidden = false;
                contactForm.reset();
                setTimeout(() => {
                    contactFeedback.hidden = true;
                }, 5000);
            }
        });
    }

    // ----------------------------------------------------------------
    // Bento Grid - duplicar tracks para bucle infinito vía JS
    // ----------------------------------------------------------------
    document.querySelectorAll('.bento-track').forEach(function(track) {
        var clone = track.cloneNode(true);
        clone.querySelectorAll('img').forEach(function(img) {
            img.alt = '';
            img.setAttribute('aria-hidden', 'true');
            img.loading = 'lazy';
        });
        clone.querySelectorAll('video').forEach(function(video) {
            video.setAttribute('aria-hidden', 'true');
            Array.from(video.childNodes).forEach(function(node) {
                if (node.nodeType === Node.TEXT_NODE) video.removeChild(node);
            });
        });
        track.parentElement.appendChild(clone);
    });

    // Inicializar estado por defecto
    actualizarTotal();
    actualizarOrientacionMockup();
    actualizarEncuadernadoMockup();
    actualizarModoColorMockup();
    actualizarPrevisualizacionMockup();
    if (modal) modal.hidden = true;
})();
