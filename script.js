(function() {
    'use strict';

    // JSON-LD LocalBusiness/PrintShop declarado estáticamente en el <head> de index.html
    // (Movido de inyección dinámica a HTML estático para compatibilidad total con crawlers
    //  estáticos, Search Console Rich Results Test y Googlebot sin render JS — SEO audit P3)

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
    // Referencias DOM principales del formulario de impresión y contacto
    // ----------------------------------------------------------------
    const form = document.getElementById('print-form');
    const numPaginas = document.getElementById('num-paginas');
    const numCopias = document.getElementById('num-copias');
    const modoColor = document.getElementById('modo-color');
    const modoDiapositiva = document.getElementById('modo-diapositiva');
    const encuadernado = document.getElementById('encuadernado');
    const envio = document.getElementById('envio');
    const fileInput = document.getElementById('file-input');
    const fileInfoContainer = document.getElementById('file-info-container');
    const fileNameSpan = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const formErrorMsg = document.getElementById('form-error-msg');
    const contactErrorMsg = document.getElementById('contact-error-msg');
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

    // Carga dinámica bajo demanda de PDF.js (0 bytes y 0 tiempo de parseo en carga inicial)
    let pdfJsLoadingPromise = null;
    function cargarPdfJsEnDemanda() {
        if (window.pdfjsLib) {
            return Promise.resolve(window.pdfjsLib);
        }
        if (pdfJsLoadingPromise) {
            return pdfJsLoadingPromise;
        }
        pdfJsLoadingPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.async = true;
            script.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    resolve(window.pdfjsLib);
                } else {
                    reject(new Error('PDF.js no disponible'));
                }
            };
            script.onerror = (err) => reject(err);
            document.head.appendChild(script);
        });
        return pdfJsLoadingPromise;
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

            cargarPdfJsEnDemanda().then(function(pdfjsLib) {
                return pdfjsLib.getDocument(typedarray).promise;
            }).then(function(pdf) {
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
                            if (mockupPdfCanvas) { mockupPdfCanvas.hidden = false; mockupPdfCanvas.style.display = 'block'; }
                            if (mockupPreviewImg) { mockupPreviewImg.hidden = true; mockupPreviewImg.style.display = 'none'; }
                            if (mockupPreviewPdf) { mockupPreviewPdf.hidden = true; mockupPreviewPdf.style.display = 'none'; }
                            if (mockupPreviewDoc) { mockupPreviewDoc.hidden = true; mockupPreviewDoc.style.display = 'none'; }
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
        if (mockupPdfCanvas) { mockupPdfCanvas.hidden = true; mockupPdfCanvas.style.display = 'none'; }
        if (mockupPreviewImg) { mockupPreviewImg.hidden = true; mockupPreviewImg.style.display = 'none'; }
        if (mockupPreviewPdf) { mockupPreviewPdf.hidden = true; mockupPreviewPdf.style.display = 'none'; }
        if (mockupPreviewDoc) {
            mockupPreviewDoc.hidden = false;
            mockupPreviewDoc.style.display = 'flex';
            if (mockupDocTitle) mockupDocTitle.textContent = fileName;
            actualizarPaginasBadgeMockup();
        }
    }

    function actualizarNombreArchivo() {
        if (!fileNameSpan || !fileInfoContainer) return;
        const files = fileInput && fileInput.files ? fileInput.files : null;
        if (files && files.length > 0) {
            fileNameSpan.textContent = files[0].name;
            fileInfoContainer.hidden = false;
        } else {
            fileNameSpan.textContent = 'Ningún archivo seleccionado';
            fileInfoContainer.hidden = true;
        }
    }

    function actualizarPrevisualizacionMockup() {
        if (!fileInput) return;
        const files = fileInput.files;

        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }

        actualizarNombreArchivo();

        if (!files || files.length === 0) {
            if (numPaginas) numPaginas.value = 1;
            detectedOrientation = 'vertical';
            actualizarOrientacionMockup();
            actualizarTotal();
            actualizarPaginasBadgeMockup();
            if (mockupDefaultContent) { mockupDefaultContent.hidden = false; mockupDefaultContent.style.display = 'block'; }
            if (mockupPreviewContent) { mockupPreviewContent.hidden = true; mockupPreviewContent.style.display = 'none'; }
            if (mockupPreviewImg) { mockupPreviewImg.hidden = true; mockupPreviewImg.style.display = 'none'; }
            if (mockupPdfCanvas) { mockupPdfCanvas.hidden = true; mockupPdfCanvas.style.display = 'none'; }
            if (mockupPreviewPdf) { mockupPreviewPdf.hidden = true; mockupPreviewPdf.style.display = 'none'; }
            if (mockupPreviewDoc) { mockupPreviewDoc.hidden = true; mockupPreviewDoc.style.display = 'none'; }
            return;
        }

        const file = files[0];
        const fileName = file.name;
        const fileType = file.type || '';
        const ext = fileName.split('.').pop().toLowerCase();

        if (mockupDefaultContent) { mockupDefaultContent.hidden = true; mockupDefaultContent.style.display = 'none'; }
        if (mockupPreviewContent) { mockupPreviewContent.hidden = false; mockupPreviewContent.style.display = 'flex'; }

        if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            if (numPaginas) numPaginas.value = 1;
            actualizarTotal();
            actualizarPaginasBadgeMockup();
            currentObjectUrl = URL.createObjectURL(file);
            if (mockupPreviewImg) {
                mockupPreviewImg.src = currentObjectUrl;
                mockupPreviewImg.hidden = false;
                mockupPreviewImg.style.display = 'block';
                
                const img = new Image();
                img.onload = function() {
                    detectedOrientation = (img.naturalWidth > img.naturalHeight) ? 'horizontal' : 'vertical';
                    actualizarOrientacionMockup();
                };
                img.src = currentObjectUrl;
            }
            if (mockupPdfCanvas) { mockupPdfCanvas.hidden = true; mockupPdfCanvas.style.display = 'none'; }
            if (mockupPreviewPdf) { mockupPreviewPdf.hidden = true; mockupPreviewPdf.style.display = 'none'; }
            if (mockupPreviewDoc) { mockupPreviewDoc.hidden = true; mockupPreviewDoc.style.display = 'none'; }
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
    let lastFocusedElement = null;

    function announceToScreenReader(message) {
        const announcer = document.getElementById('a11y-announcer');
        if (announcer) {
            announcer.textContent = '';
            setTimeout(() => {
                announcer.textContent = message;
            }, 50);
        }
    }

    // ----------------------------------------------------------------
    // Validación previa al pedido y gestión accesible de errores
    // ----------------------------------------------------------------
    function mostrarErrorFormulario(mensaje, targetInput) {
        if (!formErrorMsg) return;
        formErrorMsg.textContent = mensaje;
        formErrorMsg.hidden = false;
        if (targetInput) {
            ocultarErrorFormulario();
            formErrorMsg.hidden = false;
            formErrorMsg.textContent = mensaje;
            targetInput.setAttribute('aria-invalid', 'true');
            targetInput.setAttribute('aria-describedby', 'form-error-msg');
            targetInput.focus();
        }
        announceToScreenReader(mensaje);
        formErrorMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function ocultarErrorFormulario() {
        if (!formErrorMsg) return;
        formErrorMsg.hidden = true;
        formErrorMsg.textContent = '';
        if (form) {
            form.querySelectorAll('[aria-invalid]').forEach(el => {
                el.removeAttribute('aria-invalid');
                el.removeAttribute('aria-describedby');
            });
        }
    }

    // Gestión accesible e independiente de errores del formulario de contacto
    function mostrarErrorContacto(mensaje, targetInput) {
        if (!contactErrorMsg) return;
        contactErrorMsg.textContent = mensaje;
        contactErrorMsg.hidden = false;
        if (targetInput) {
            ocultarErrorContacto();
            contactErrorMsg.hidden = false;
            contactErrorMsg.textContent = mensaje;
            targetInput.setAttribute('aria-invalid', 'true');
            targetInput.setAttribute('aria-describedby', 'contact-error-msg');
            targetInput.focus();
        }
        announceToScreenReader(mensaje);
        contactErrorMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function ocultarErrorContacto() {
        if (!contactErrorMsg) return;
        contactErrorMsg.hidden = true;
        contactErrorMsg.textContent = '';
        const contactFormEl = document.getElementById('contact-form');
        if (contactFormEl) {
            contactFormEl.querySelectorAll('[aria-invalid]').forEach(el => {
                el.removeAttribute('aria-invalid');
                el.removeAttribute('aria-describedby');
            });
        }
    }

    function mostrarErrorModal(mensaje, targetInput) {
        if (!modalErrorBanner) return;
        modalErrorBanner.textContent = mensaje;
        modalErrorBanner.hidden = false;
        if (targetInput) {
            ocultarErrorModal();
            modalErrorBanner.hidden = false;
            modalErrorBanner.textContent = mensaje;
            targetInput.setAttribute('aria-invalid', 'true');
            targetInput.setAttribute('aria-describedby', 'modal-error-banner');
            targetInput.focus();
        }
        announceToScreenReader(mensaje);
    }

    function ocultarErrorModal() {
        if (!modalErrorBanner) return;
        modalErrorBanner.hidden = true;
        modalErrorBanner.textContent = '';
        if (modal) {
            modal.querySelectorAll('[aria-invalid]').forEach(el => {
                el.removeAttribute('aria-invalid');
                el.removeAttribute('aria-describedby');
            });
        }
    }

    function validarFormularioPrincipal() {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            mostrarErrorFormulario('⚠️ Por favor, selecciona o arrastra tu archivo A4 antes de continuar.', addFileBtn);
            return false;
        }

        const numP = parseInt(numPaginas ? numPaginas.value : '1', 10);
        if (isNaN(numP) || numP < 1) {
            mostrarErrorFormulario('⚠️ El número de páginas debe ser al menos 1.', numPaginas);
            return false;
        }

        const numC = parseInt(numCopias ? numCopias.value : '1', 10);
        if (isNaN(numC) || numC < 1) {
            mostrarErrorFormulario('⚠️ El número de copias debe ser al menos 1.', numCopias);
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
            cargarStripeJsEnDemanda();
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

        // Mover foco al encabezado del paso activo para navegación por teclado idónea (WCAG 2.4.3)
        const activeStepTitle = document.getElementById(`step-title-${paso}`);
        if (activeStepTitle) {
            activeStepTitle.focus();
        }
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

        // Construcción segura del DOM sin interpolación no confiable en innerHTML (SEC-01)
        modalDetailSummary.textContent = '';

        const items = [
            { label: 'Archivo adjunto:', value: fileName },
            { label: 'Formato de papel:', value: 'A4 Estándar (210 x 297 mm)' },
            { label: 'Páginas por ejemplar:', value: `${numP} pág${numP > 1 ? 's' : ''}` },
            { label: 'Ejemplares (Copias):', value: `${copias}` },
            { label: 'Modo de color:', value: color },
            { label: 'Caras de impresión:', value: diapo },
            { label: 'Encuadernación espiral:', value: enc },
            { label: 'Opción de entrega actual:', value: envText }
        ];

        items.forEach(function(item) {
            const p = document.createElement('p');
            const strong = document.createElement('strong');
            strong.textContent = item.label + ' ';
            p.appendChild(strong);
            p.appendChild(document.createTextNode(item.value));
            modalDetailSummary.appendChild(p);
        });

        const hr = document.createElement('hr');
        hr.className = 'modal-summary-hr';
        modalDetailSummary.appendChild(hr);

        const totalP = document.createElement('p');
        totalP.className = 'modal-summary-total-p';
        const totalStrong = document.createElement('strong');
        totalStrong.textContent = 'Total estimado: ';
        totalP.appendChild(totalStrong);

        const totalSpan = document.createElement('span');
        totalSpan.className = 'modal-summary-total-amount';
        totalSpan.textContent = `${total.toFixed(2)} €`;
        totalP.appendChild(totalSpan);

        modalDetailSummary.appendChild(totalP);
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
            mostrarErrorModal('⚠️ Por favor, ingresa tu Nombre y Apellidos.', custName);
            return false;
        }
        if (!custEmail || !custEmail.value.trim() || !custEmail.value.includes('@')) {
            mostrarErrorModal('⚠️ Por favor, ingresa un correo electrónico válido.', custEmail);
            return false;
        }
        if (!custPhone || !custPhone.value.trim()) {
            mostrarErrorModal('⚠️ Por favor, ingresa un número de teléfono de contacto.', custPhone);
            return false;
        }

        const esEnvio = deliveryOptionEnvio && deliveryOptionEnvio.checked;
        if (esEnvio) {
            if (!custAddress || !custAddress.value.trim()) {
                mostrarErrorModal('⚠️ Por favor, ingresa tu dirección de envío.', custAddress);
                return false;
            }
            if (!custCp || !custCp.value.trim()) {
                mostrarErrorModal('⚠️ Por favor, ingresa el código postal.', custCp);
                return false;
            }
            if (!custCity || !custCity.value.trim()) {
                mostrarErrorModal('⚠️ Por favor, ingresa la ciudad / población.', custCity);
                return false;
            }
        }
        return true;
    }

    // Avanzar y Retroceder en Modal
    if (modalNextBtn) {
        modalNextBtn.addEventListener('click', function() {
            if (currentModalStep === 1) {
                irAPasoModal(2);
            } else if (currentModalStep === 2) {
                if (validarPaso2()) {
                    irAPasoModal(3);
                }
            }
        });
    }

    if (modalPrevBtn) {
        modalPrevBtn.addEventListener('click', function() {
            if (currentModalStep > 1 && currentModalStep < 4) {
                irAPasoModal(currentModalStep - 1);
            }
        });
    }

    // Finalización del Pedido y Redirección a Stripe Checkout
    if (confirmPayBtn) {
        confirmPayBtn.addEventListener('click', async function() {
            const originalText = confirmPayBtn.innerHTML;
            confirmPayBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-spin-icon"><g class="spin-grp"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></g></svg> Procesando...';
            confirmPayBtn.disabled = true;

            try {
                const formData = new FormData();
                const selectedFile = (fileInput && fileInput.files && fileInput.files.length > 0) ? fileInput.files[0] : null;

                if (!selectedFile) {
                    throw new Error("Falta el documento adjunto.");
                }

                // Límite máximo de carga directa (4.4 MB)
                const maxServerlessBytes = 4.4 * 1024 * 1024;
                if (selectedFile.size > maxServerlessBytes) {
                    const mbSize = (selectedFile.size / (1024 * 1024)).toFixed(1);
                    throw new Error(`El archivo (${mbSize} MB) supera el tamaño máximo permitido para subir online (4.4 MB). Por favor comprime el documento o contacta con nosotros en el taller.`);
                }

                formData.append('documento', selectedFile);

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

                const responseText = await response.text();
                let data = {};

                try {
                    data = JSON.parse(responseText);
                } catch (parseErr) {
                    if (response.status === 413) {
                        throw new Error('El archivo adjunto supera el tamaño máximo permitido por el servidor serverless (4.5 MB).');
                    }
                    throw new Error(`Error en la respuesta del servidor (Estado ${response.status}).`);
                }

                if (!response.ok) {
                    throw new Error(data.error || 'Error de comunicación con el servidor');
                }

                if (!data.url) {
                    throw new Error('No se recibió la URL de redirección a la pasarela de pago.');
                }
                
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
        lastFocusedElement = document.activeElement;
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
            if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
                lastFocusedElement.focus();
            } else if (comprarBtn) {
                comprarBtn.focus();
            }
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
    // Referencias DOM para el Header (deben declararse antes de su primer uso)
    // ----------------------------------------------------------------
    const siteHeader = document.querySelector('.site-header');
    const skipLink = document.querySelector('.skip-link');

    // ----------------------------------------------------------------
    // Control del Menú Hamburguesa Móvil (WCAG 4.1.2, 2.1.1 & 2.1.2)
    // ----------------------------------------------------------------
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');

    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', function() {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', !isExpanded);
            mainNav.classList.toggle('is-open');
            if (siteHeader) siteHeader.classList.remove('header-hidden');
            if (!isExpanded) {
                announceToScreenReader('Menú de navegación abierto');
            } else {
                announceToScreenReader('Menú de navegación cerrado');
            }
        });

        // Soporte de tecla Escape para cerrar menú móvil si está desplegado
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
                menuToggle.setAttribute('aria-expanded', 'false');
                mainNav.classList.remove('is-open');
                menuToggle.focus();
                announceToScreenReader('Menú de navegación cerrado');
            }
        });
    }

    // ----------------------------------------------------------------
    // Enrutador SPA con History API (URLs limpias sin recarga de página)
    // ----------------------------------------------------------------
    const ROUTES_CONFIG = {
        '/': {
            id: 'inicio',
            sectionId: null,
            title: 'Imprenta Digital en Sant Just Desvern | Print2Web',
            description: 'Impresión digital rápida y profesional en Sant Just Desvern (Barcelona). Configura y encarga online tus impresiones A4, catálogos y dossieres con taller propio.',
            canonical: 'https://tramasweb.com/',
            ogImage: 'https://tramasweb.com/img/og-image.webp',
            navKey: '/'
        },
        '/imprimir': {
            id: 'imprimir',
            sectionId: 'imprimir',
            title: 'Imprimir Online A4 | Print2Web',
            description: 'Configura y encarga online tus documentos A4 a color o blanco y negro con acabado profesional y opción de encuadernación en espiral en Print2Web.',
            canonical: 'https://tramasweb.com/imprimir',
            ogImage: 'https://tramasweb.com/img/og-image.webp',
            navKey: '/imprimir'
        },
        '/contacto': {
            id: 'contacto',
            sectionId: 'contacto',
            title: 'Contacto y Taller en Sant Just | Print2Web',
            description: 'Visita nuestro taller de impresión en Ctra. Reial 15-17 (Sant Just Desvern) o contáctanos por teléfono y email para tus proyectos de artes gráficas.',
            canonical: 'https://tramasweb.com/contacto',
            ogImage: 'https://tramasweb.com/img/og-image.webp',
            navKey: '/contacto'
        },
        '/opiniones': {
            id: 'opiniones',
            sectionId: 'opiniones',
            title: 'Opiniones y Valoraciones | Print2Web',
            description: 'Descubre las opiniones de nuestros clientes sobre la calidad y rapidez de nuestros servicios de imprenta digital en Sant Just y Barcelona.',
            canonical: 'https://tramasweb.com/opiniones',
            ogImage: 'https://tramasweb.com/img/og-image.webp',
            navKey: '/opiniones'
        },
        '/quienes-somos': {
            id: 'quienes-somos',
            sectionId: 'quienes-somos',
            title: 'Quiénes Somos | Print2Web',
            description: 'Conoce más sobre Tramas Solucions Gràfiques SL, taller de imprenta y diseño gráfico en Sant Just Desvern ofreciendo servicios de impresión desde 2008.',
            canonical: 'https://tramasweb.com/quienes-somos',
            ogImage: 'https://tramasweb.com/img/og-image.webp',
            navKey: '/quienes-somos'
        }
    };

    function normalizarRuta(pathname) {
        if (!pathname || pathname === '' || pathname === '/index.html') return '/';
        const sinSlashFinal = pathname.replace(/\/+$/, '');
        return sinSlashFinal === '' ? '/' : sinSlashFinal;
    }

    function actualizarEnlaceActivoNav(navKey) {
        const mainNavLinks = document.querySelectorAll('.main-nav a');
        mainNavLinks.forEach(function(link) {
            const href = link.getAttribute('href');
            if (href === navKey || (navKey === '/' && (href === '/' || href === '#main-content'))) {
                link.setAttribute('aria-current', 'page');
                link.classList.add('active');
            } else {
                link.removeAttribute('aria-current');
                link.classList.remove('active');
            }
        });
    }

    // Cache de referencias a etiquetas meta/link para máxima velocidad en transiciones SPA
    const metaElementsCache = {
        metaDesc: document.querySelector('meta[name="description"]'),
        canonicalLink: document.querySelector('link[rel="canonical"]'),
        ogUrl: document.querySelector('meta[property="og:url"]'),
        ogTitle: document.querySelector('meta[property="og:title"]'),
        ogDesc: document.querySelector('meta[property="og:description"]'),
        twTitle: document.querySelector('meta[name="twitter:title"]'),
        twDesc: document.querySelector('meta[name="twitter:description"]'),
        twUrl: document.querySelector('meta[name="twitter:url"]')
    };

    function actualizarMetadatosYRuta(ruta, config) {
        if (!config) return;

        if (config.title) {
            document.title = config.title;
        }

        if (metaElementsCache.metaDesc && config.description) {
            metaElementsCache.metaDesc.setAttribute('content', config.description);
        }
        if (metaElementsCache.canonicalLink && config.canonical) {
            metaElementsCache.canonicalLink.setAttribute('href', config.canonical);
        }
        if (metaElementsCache.ogUrl && config.canonical) {
            metaElementsCache.ogUrl.setAttribute('content', config.canonical);
        }
        if (metaElementsCache.ogTitle && config.title) {
            metaElementsCache.ogTitle.setAttribute('content', config.title);
        }
        if (metaElementsCache.ogDesc && config.description) {
            metaElementsCache.ogDesc.setAttribute('content', config.description);
        }
        if (metaElementsCache.twTitle && config.title) {
            metaElementsCache.twTitle.setAttribute('content', config.title);
        }
        if (metaElementsCache.twDesc && config.description) {
            metaElementsCache.twDesc.setAttribute('content', config.description);
        }
        if (metaElementsCache.twUrl && config.canonical) {
            metaElementsCache.twUrl.setAttribute('content', config.canonical);
        }

        actualizarEnlaceActivoNav(config.navKey);
    }

    // Gestión accesible del foco al navegar entre secciones SPA (WCAG 2.4.3)
    function moverFocoASeccion(sectionEl, sectionId) {
        if (!sectionEl && !sectionId) {
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.focus();
            }
            return;
        }

        if (sectionId === 'imprimir') {
            if (numPaginas) {
                setTimeout(() => numPaginas.focus(), 350);
            }
            return;
        }

        // Buscar encabezado dentro de la sección o enfocar el contenedor con tabindex="-1"
        const heading = sectionEl ? sectionEl.querySelector('h1, h2, h3') : null;
        if (heading) {
            if (!heading.hasAttribute('tabindex')) {
                heading.setAttribute('tabindex', '-1');
            }
            heading.focus();
        } else if (sectionEl) {
            sectionEl.focus();
        }
    }

    function navegarARuta(ruta, opciones) {
        const opt = Object.assign({ pushState: true, smooth: true, focus: true }, opciones || {});
        const normalizada = normalizarRuta(ruta);
        let config = ROUTES_CONFIG[normalizada];

        // Manejo de rutas no definidas -> fallback seguro a inicio
        if (!config) {
            navegarARuta('/', { pushState: opt.pushState, smooth: false, focus: opt.focus });
            return false;
        }

        if (opt.pushState && window.location.pathname !== normalizada) {
            try {
                history.pushState({ route: normalizada }, config.title, normalizada);
            } catch (e) {
                // Fallback en entornos restringidos
            }
        }

        actualizarMetadatosYRuta(normalizada, config);
        if (config.title) {
            announceToScreenReader(config.title);
        }

        if (config.sectionId) {
            const section = document.getElementById(config.sectionId);
            if (section) {
                const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                section.scrollIntoView({ behavior: (opt.smooth && !prefersReduced) ? 'smooth' : 'auto', block: 'start' });
                if (opt.focus) {
                    moverFocoASeccion(section, config.sectionId);
                }
            }
        } else {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: (opt.smooth && !prefersReduced) ? 'smooth' : 'auto' });
            if (opt.focus) {
                moverFocoASeccion(null, null);
            }
        }

        return true;
    }

    function navigate(route, addToHistory = true) {
        return navegarARuta(route, { pushState: addToHistory, smooth: true, focus: true });
    }

    // ----------------------------------------------------------------
    // Navegación interna: Smooth Scroll con History API accesible
    // ----------------------------------------------------------------
    function inicializarNavegacion() {
        // Mapa: ruta limpia → id de sección en index.html
        const SECCION_MAP = {
            '/': null,                       // scroll al top
            '/imprimir': 'imprimir',
            '/contacto': 'contacto',
            '/opiniones': 'opiniones',
            '/quienes-somos': 'quienes-somos'
        };

        // Deep Linking en carga inicial: sincronización inmediata sin retraso artificial (elimina FOUC/salto visual)
        const initialPath = normalizarRuta(window.location.pathname);
        if (initialPath !== '/' && Object.prototype.hasOwnProperty.call(SECCION_MAP, initialPath)) {
            const initialSectionId = SECCION_MAP[initialPath];
            const initialSectionEl = initialSectionId ? document.getElementById(initialSectionId) : null;
            if (initialSectionEl) {
                requestAnimationFrame(function() {
                    initialSectionEl.scrollIntoView({ behavior: 'auto', block: 'start' });
                    moverFocoASeccion(initialSectionEl, initialSectionId);
                    const initConfig = ROUTES_CONFIG[initialPath];
                    if (initConfig && initConfig.title) {
                        announceToScreenReader(initConfig.title);
                    }
                });
            }
        }

        // Interceptor global de clics (delegación de eventos hacia navegarARuta)
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href || href === '#') return;

            // Dejar pasar el skip-link de accesibilidad
            if (link.classList.contains('skip-link')) return;

            // Dejar pasar enlaces externos, protocol-relative, mailto, tel y target="_blank"
            if (
                href.startsWith('//') ||
                href.startsWith('mailto:') ||
                href.startsWith('tel:') ||
                href.startsWith('http://') ||
                (href.startsWith('https://') && !href.startsWith(window.location.origin)) ||
                link.getAttribute('target') === '_blank'
            ) {
                return;
            }

            // Extraer el path limpio (sin dominio)
            let path = href;
            if (path.startsWith(window.location.origin)) {
                path = path.slice(window.location.origin.length);
            }

            // Anclas puras (#algo): dejar comportamiento nativo
            if (path.startsWith('#')) return;

            // Normalizar la ruta
            const ruta = path.replace(/\/+$/, '') || '/';

            // ¿Es una ruta del SPA (sección de index.html)?
            if (Object.prototype.hasOwnProperty.call(SECCION_MAP, ruta)) {
                const sectionId = SECCION_MAP[ruta];
                const sectionEl = sectionId ? document.getElementById(sectionId) : null;

                if (ruta === '/' || sectionEl) {
                    e.preventDefault();
                    navegarARuta(ruta, { pushState: true, smooth: true, focus: true });

                    // Cerrar menú móvil si está abierto
                    if (menuToggle && mainNav && window.innerWidth <= 1024 && menuToggle.getAttribute('aria-expanded') === 'true') {
                        menuToggle.setAttribute('aria-expanded', 'false');
                        mainNav.classList.remove('is-open');
                    }
                    return;
                }

                // La sección NO existe en este documento (página legal secundaria) → navegar a la ruta SPA limpia
                e.preventDefault();
                window.location.href = ruta;
                return;
            }

            // Para cualquier otra ruta (aviso-legal, privacidad, etc.): navegación nativa limpia
        });

        // ScrollSpy: actualiza el enlace activo del nav según la sección visible
        if ('IntersectionObserver' in window) {
            const spyOptions = { root: null, rootMargin: '-20% 0px -60% 0px', threshold: 0 };

            const sectionIds = ['imprimir', 'contacto', 'opiniones', 'quienes-somos'];
            const spyObserver = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        actualizarEnlaceActivoNav('/' + entry.target.id);
                    }
                });
            }, spyOptions);

            sectionIds.forEach(function(id) {
                const el = document.getElementById(id);
                if (el) spyObserver.observe(el);
            });

            // Hero: cuando es visible, marcar INICIO como activo
            const heroEl = document.querySelector('.hero');
            if (heroEl) {
                const heroObserver = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) actualizarEnlaceActivoNav('/');
                    });
                }, spyOptions);
                heroObserver.observe(heroEl);
            }
        }

        // Handler popstate — sincroniza sección, metadatos, foco y nav al usar Atrás/Adelante — WCAG 2.4.3
        window.addEventListener('popstate', function() {
            const ruta = normalizarRuta(window.location.pathname);
            const config = ROUTES_CONFIG[ruta];
            actualizarMetadatosYRuta(ruta, config);
            const sectionId = SECCION_MAP[ruta];
            if (sectionId) {
                const sectionEl = document.getElementById(sectionId);
                if (sectionEl) {
                    sectionEl.scrollIntoView({ behavior: 'auto', block: 'start' });
                    moverFocoASeccion(sectionEl, sectionId);
                }
            } else {
                window.scrollTo({ top: 0, behavior: 'auto' });
                moverFocoASeccion(null, null);
            }
            if (config && config.title) {
                announceToScreenReader(config.title);
            }
        });
    }

    // ----------------------------------------------------------------
    // Header Adaptativo Sticky con Ocultación Inteligente (Smart Hide/Show)
    // ----------------------------------------------------------------
    // siteHeader y skipLink se declaran más arriba, antes del primer uso (menuToggle handler).
    let lastScrollY = Math.max(0, window.pageYOffset || document.documentElement.scrollTop || 0);
    const hideThreshold = 150;
    const scrollDeltaThreshold = 6;
    let scrollTicking = false;

    function isHeaderExemptFromHiding() {
        // 1. Si el menú móvil está desplegado
        if (menuToggle && menuToggle.getAttribute('aria-expanded') === 'true') {
            return true;
        }
        // 2. Si el foco activo está dentro del header (navegación por teclado / a11y)
        if (siteHeader && siteHeader.contains(document.activeElement)) {
            return true;
        }
        // 3. Si el modal de checkout está abierto
        if (modal && !modal.hidden && modal.classList.contains('is-open')) {
            return true;
        }
        // 4. Si el enlace de salto (skip-link) está enfocado
        if (skipLink && document.activeElement === skipLink) {
            return true;
        }
        return false;
    }

    function updateHeaderState() {
        if (!siteHeader) {
            scrollTicking = false;
            return;
        }

        const currentScrollY = Math.max(0, window.pageYOffset || document.documentElement.scrollTop || 0);

        // Sombra sutil al desplazarse de la parte superior
        if (currentScrollY > 10) {
            siteHeader.classList.add('is-scrolled');
        } else {
            siteHeader.classList.remove('is-scrolled');
        }

        // Si estamos cerca de la parte superior de la página, mostrar siempre
        if (currentScrollY <= hideThreshold) {
            siteHeader.classList.remove('header-hidden');
            lastScrollY = currentScrollY;
            scrollTicking = false;
            return;
        }

        // Si hay una excepción activa (foco teclado, menú móvil abierto, modal), no ocultar
        if (isHeaderExemptFromHiding()) {
            siteHeader.classList.remove('header-hidden');
            lastScrollY = currentScrollY;
            scrollTicking = false;
            return;
        }

        const diff = currentScrollY - lastScrollY;

        // Scroll hacia abajo mayor que el umbral diferencial -> ocultar suavemente
        if (diff > scrollDeltaThreshold && currentScrollY > hideThreshold) {
            siteHeader.classList.add('header-hidden');
        }
        // Scroll hacia arriba mayor que el umbral diferencial -> mostrar inmediatamente
        else if (diff < -scrollDeltaThreshold) {
            siteHeader.classList.remove('header-hidden');
        }

        lastScrollY = currentScrollY;
        scrollTicking = false;
    }

    function onScroll() {
        if (!scrollTicking) {
            window.requestAnimationFrame(updateHeaderState);
            scrollTicking = true;
        }
    }

    // Escucha pasiva para máximo rendimiento de scroll a 60/120fps
    window.addEventListener('scroll', onScroll, { passive: true });

    // Accesibilidad por teclado (WCAG 2.2 Focus Visible & Operable)
    if (siteHeader) {
        siteHeader.addEventListener('focusin', function() {
            siteHeader.classList.remove('header-hidden');
        });
    }

    if (skipLink) {
        skipLink.addEventListener('focus', function() {
            if (siteHeader) siteHeader.classList.remove('header-hidden');
        });
        skipLink.addEventListener('click', function() {
            if (siteHeader) siteHeader.classList.remove('header-hidden');
        });
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
            if (fileInput.files && fileInput.files.length > 0) {
                announceToScreenReader(`Archivo ${fileInput.files[0].name} cargado correctamente.`);
            }
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

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', function() {
            if (fileInput) {
                fileInput.value = '';
            }
            actualizarNombreArchivo();
            actualizarPrevisualizacionMockup();
            actualizarTotal();
            if (addFileBtn) addFileBtn.focus();
            announceToScreenReader('Archivo eliminado.');
        });
    }

    // headerCta (#header-cta): gestionado por el interceptor global. El router SPA
    // detecta link.id === 'header-cta' y activa el foco en numPaginas automáticamente.

    const contactForm = document.getElementById('contact-form');
    const contactFeedback = document.getElementById('contact-feedback');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const contactName = document.getElementById('contact-name');
            const contactEmail = document.getElementById('contact-email');
            const contactMessage = document.getElementById('contact-message');

            if (contactName && !contactName.value.trim()) {
                mostrarErrorContacto('⚠️ Por favor, ingresa tu nombre.', contactName);
                return;
            }
            if (contactEmail && (!contactEmail.value.trim() || !contactEmail.value.includes('@'))) {
                mostrarErrorContacto('⚠️ Por favor, ingresa un correo electrónico válido.', contactEmail);
                return;
            }
            if (contactMessage && !contactMessage.value.trim()) {
                mostrarErrorContacto('⚠️ Por favor, escribe tu consulta o mensaje.', contactMessage);
                return;
            }

            ocultarErrorContacto();
            if (contactFeedback) {
                contactFeedback.hidden = false;
                announceToScreenReader(contactFeedback.textContent);
                contactForm.reset();
                setTimeout(() => {
                    contactFeedback.hidden = true;
                }, 5000);
            }
        });

        contactForm.addEventListener('input', ocultarErrorContacto);
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
            video.preload = 'none';
            video.autoplay = false;
            video.pause();
            // Evitar que el clon inicie peticiones de red adicionales de vídeo
            Array.from(video.querySelectorAll('source')).forEach(function(src) {
                src.removeAttribute('src');
            });
            Array.from(video.childNodes).forEach(function(node) {
                if (node.nodeType === Node.TEXT_NODE) video.removeChild(node);
            });
        });
        track.parentElement.appendChild(clone);
    });

    // Gestión accesible y dinámica de vídeos con movimiento reducido (WCAG 2.2.2)
    function sincronizarPreferenciaMovimiento() {
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.querySelectorAll('video.bento-video').forEach(function(vid) {
            if (reduceMotion) {
                vid.pause();
            } else {
                vid.play().catch(function() {});
            }
        });
    }

    if (window.matchMedia) {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        sincronizarPreferenciaMovimiento();
        if (typeof motionQuery.addEventListener === 'function') {
            motionQuery.addEventListener('change', sincronizarPreferenciaMovimiento);
        } else if (typeof motionQuery.addListener === 'function') {
            motionQuery.addListener(sincronizarPreferenciaMovimiento);
        }
    }

    // ----------------------------------------------------------------
    // Carga diferida bajo demanda de Stripe.js (Garantía de 0 cookies no esenciales en carga inicial)
    // ----------------------------------------------------------------
    let stripeScriptCargado = false;
    function cargarStripeJsEnDemanda() {
        if (stripeScriptCargado || document.querySelector('script[src="https://js.stripe.com/v3/"]')) {
            stripeScriptCargado = true;
            return;
        }
        try {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
            script.onload = function() {
                stripeScriptCargado = true;
                console.log('Stripe.js cargado dinámicamente para el paso de pago seguro.');
            };
            document.head.appendChild(script);
        } catch (e) {
            console.warn('No se pudo cargar Stripe.js dinámicamente:', e);
        }
    }

    // ----------------------------------------------------------------
    // Inicialización del Banner de Cookies Accesible (role="region", no modal)
    // ----------------------------------------------------------------
    function inicializarBannerCookies() {
        const cookieBanner = document.getElementById('cookie-banner');
        const cookieAcceptBtn = document.getElementById('cookie-accept-btn');
        if (!cookieBanner) return;

        try {
            const consent = localStorage.getItem('p2w_cookie_consent');
            if (!consent) {
                cookieBanner.hidden = false;
            }
        } catch (e) {
            cookieBanner.hidden = false;
        }

        if (cookieAcceptBtn) {
            cookieAcceptBtn.addEventListener('click', function() {
                try {
                    localStorage.setItem('p2w_cookie_consent', 'accepted');
                } catch (e) {
                    // Fallback silencioso
                }
                cookieBanner.hidden = true;
                announceToScreenReader('Preferencia de aviso de cookies guardada.');
            });
        }
    }

    // Inicializar estado por defecto
    actualizarTotal();
    actualizarOrientacionMockup();
    actualizarEncuadernadoMockup();
    actualizarModoColorMockup();
    actualizarPrevisualizacionMockup();
    inicializarBannerCookies();
    updateHeaderState();
    inicializarNavegacion();

    // Si hay hash en la URL al cargar, limpiarlo sin recargar
    if (window.location.hash) {
        try {
            history.replaceState(null, document.title, window.location.pathname + window.location.search);
        } catch (e) {}
    }
    if (modal) modal.hidden = true;
})();
