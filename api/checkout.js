const { IncomingForm } = require('formidable');
const { put } = require('@vercel/blob');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');
const { Ratelimit } = require('@upstash/ratelimit');

// Configuración para que Vercel no parsee el body automáticamente (formidable procesará multipart/form-data)
const config = {
    api: { bodyParser: false },
};

// Exportar la configuración tanto en sintaxis CommonJS como global
module.exports.config = config;

// Inicialización de Upstash Redis Rate Limiter si están las variables configuradas
let ratelimit = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        ratelimit = new Ratelimit({
            redis: redis,
            limiter: Ratelimit.slidingWindow(5, '1 h'), // Máximo 5 peticiones por hora por IP
            analytics: true,
        });
    } catch (e) {
        console.warn('⚠️ No se pudo inicializar Upstash Redis Rate Limiter:', e.message);
    }
}

// Precios de imprenta extraídos opcionalmente de variables de entorno con fallback por defecto
const PRECIO_PAGINA_COLOR = parseFloat(process.env.PRECIO_PAGINA_COLOR || '0.50');
const PRECIO_PAGINA_BW = parseFloat(process.env.PRECIO_PAGINA_BW || '0.30');
const PRECIO_ENCUADERNACION = parseFloat(process.env.PRECIO_ENCUADERNACION || '2.00');
const PRECIO_ENVIO = parseFloat(process.env.PRECIO_ENVIO || '5.00');

/**
 * Enmascara direcciones de correo electrónico para logging seguro (PII Masking)
 */
function maskEmail(email) {
    if (!email || typeof email !== 'string') return '***@***';
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? name.substring(0, 2) + '***' : name + '***';
    return `${maskedName}@${domain}`;
}

/**
 * Calcula el importe total del pedido en el servidor.
 */
function calcularTotal(campos) {
    const numP = Math.min(2000, Math.max(1, parseInt(campos.numPaginas || '1', 10) || 1));
    const copias = Math.min(500, Math.max(1, parseInt(campos.numCopias || '1', 10) || 1));
    const modoColor = (campos.modoColor === 'bw') ? 'bw' : 'color';
    const precioPagina = modoColor === 'color' ? PRECIO_PAGINA_COLOR : PRECIO_PAGINA_BW;

    let totalImprenta = (numP * precioPagina * copias);
    
    if (campos.encuadernado === 'true') {
        totalImprenta += (PRECIO_ENCUADERNACION * copias);
    }

    let costoEnvio = 0;
    if (campos.envio === 'true') {
        costoEnvio = PRECIO_ENVIO;
    }

    let finalTotal = Math.round((totalImprenta + costoEnvio) * 100) / 100;
    return Math.max(0.50, finalTotal);
}

/**
 * Inspecciona los Magic Bytes y firma binaria para verificar la autenticidad del archivo.
 */
function validarMagicBytes(filepath) {
    const bufferHeader = Buffer.alloc(12);
    const fd = fs.openSync(filepath, 'r');
    fs.readSync(fd, bufferHeader, 0, 12, 0);
    fs.closeSync(fd);

    const hexHeader = bufferHeader.toString('hex').toUpperCase();

    // Magic Bytes permitidos:
    // PDF: %PDF- (25 50 44 46)
    // PNG: 89 50 4E 47
    // JPEG: FF D8 FF
    const esPDF = hexHeader.startsWith('25504446');
    const esPNG = hexHeader.startsWith('89504E47');
    const esJPEG = hexHeader.startsWith('FFD8FF');

    if (!esPDF && !esPNG && !esJPEG) {
        throw new Error('Formato de archivo no permitido. Solo se aceptan documentos PDF o imágenes PNG/JPEG auténticas.');
    }

    return true;
}

/**
 * Sanitiza el nombre del archivo para evitar caracteres peligrosos.
 */
function sanitizarNombreArchivo(nombreOriginal) {
    const parsed = path.parse(nombreOriginal || 'documento.pdf');
    const nameClean = parsed.name.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 50);
    const extClean = parsed.ext.toLowerCase().replace(/[^a-z0-9]/g, '');
    const validExts = ['pdf', 'png', 'jpg', 'jpeg'];
    const safeExt = validExts.includes(extClean) ? extClean : 'pdf';
    return `${nameClean || 'documento'}.${safeExt}`;
}

/**
 * Validador de formato de correo electrónico.
 */
function esEmailValido(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && email.length <= 100 && re.test(email.trim());
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // 1. Protección contra abuso: Rate Limiting
    const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.socket.remoteAddress || '127.0.0.1');
    if (ratelimit) {
        try {
            const { success } = await ratelimit.limit(`checkout_${clientIp}`);
            if (!success) {
                return res.status(429).json({ error: 'Ha superado el límite de solicitudes. Por favor intente más tarde.' });
            }
        } catch (rlErr) {
            console.error('Error al evaluar Rate Limit:', rlErr.message);
        }
    }

    // Configurar formidable con límites estrictos de tamaño
    const form = new IncomingForm({
        maxFileSize: 50 * 1024 * 1024, // Máximo 50 MB
        maxFiles: 1,
        keepExtensions: true,
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido (50MB) o la solicitud es inválida.' });
        }

        try {
            const getField = (name) => {
                const val = Array.isArray(fields[name]) ? fields[name][0] : fields[name];
                return typeof val === 'string' ? val.trim() : '';
            };

            // Detección de Honeypot contra bots
            const honeypot = getField('website_hp');
            if (honeypot && honeypot.length > 0) {
                // Silenciosamente simular procesamiento para bloquear bots
                return res.status(200).json({ url: `${process.env.APP_URL || 'https://tramasweb.com'}/exito` });
            }

            const campos = {
                orderId: getField('orderId') || (`p2w_srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
                numPaginas: getField('numPaginas'),
                numCopias: getField('numCopias'),
                modoColor: getField('modoColor') === 'bw' ? 'bw' : 'color',
                modoDiapositiva: getField('modoDiapositiva') === 'doble' ? 'doble' : 'simple',
                encuadernado: getField('encuadernado') === 'true' ? 'true' : 'false',
                envio: getField('envio') === 'true' ? 'true' : 'false',
                custName: getField('custName').substring(0, 100),
                custEmail: getField('custEmail').substring(0, 100),
                custPhone: getField('custPhone').substring(0, 30),
                custAddress: getField('custAddress').substring(0, 200),
                custCp: getField('custCp').substring(0, 10),
                custCity: getField('custCity').substring(0, 100)
            };

            // Validación de Email del cliente
            if (!esEmailValido(campos.custEmail)) {
                return res.status(400).json({ error: 'Por favor proporcione un correo electrónico válido.' });
            }

            // Validar existencia de archivo
            const file = Array.isArray(files.documento) ? files.documento[0] : files.documento;
            if (!file || !file.filepath) {
                return res.status(400).json({ error: 'No se adjuntó ningún documento válido.' });
            }

            // 2. Validación de Magic Bytes (PDF, PNG, JPG auténticos)
            try {
                validarMagicBytes(file.filepath);
            } catch (validationErr) {
                return res.status(400).json({ error: validationErr.message });
            }

            // 3. Subir a Vercel Blob de forma PRIVADA (access: 'private')
            const safeName = sanitizarNombreArchivo(file.originalFilename);
            const fileStream = fs.createReadStream(file.filepath);
            
            const blobResult = await put(`documentos/${safeName}`, fileStream, {
                access: 'private',
                addRandomSuffix: true,
                token: process.env.BLOB_READ_WRITE_TOKEN
            });

            // 4. Calcular precio 100% en servidor
            const totalEuro = calcularTotal(campos);
            const totalCentimos = Math.round(totalEuro * 100);

            // 5. Determinar Origen Seguro para URLs de Stripe
            let baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : null;
            if (!baseUrl) {
                const host = req.headers.host || 'tramasweb.com';
                const protocol = host.includes('localhost') ? 'http' : 'https';
                baseUrl = `${protocol}://${host}`;
            }

            // 6. Clave de idempotencia ESTABLE basada en orderId único de cliente
            const idempotencyKey = crypto.createHash('sha256').update(campos.orderId).digest('hex');

            console.log(`Creando sesión de pago segura Stripe [OrderId: ${campos.orderId}, Email: ${maskEmail(campos.custEmail)}]`);

            // 7. Crear sesión de Stripe Checkout
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'eur',
                            product_data: {
                                name: 'Impresión Digital A4 - Print2Web',
                                description: `${campos.numCopias} copia(s) | ${campos.modoColor.toUpperCase()} | Encuadernado: ${campos.encuadernado === 'true' ? 'Sí' : 'No'} | Envío: ${campos.envio === 'true' ? 'Sí' : 'Recogida'}`,
                            },
                            unit_amount: totalCentimos,
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${baseUrl}/exito`,
                cancel_url: `${baseUrl}/cancelado`,
                metadata: {
                    orderId: campos.orderId,
                    documentUrl: blobResult.url, // Guardado de forma privada en metadatos de Stripe
                    documentName: safeName,
                    custName: campos.custName,
                    custEmail: campos.custEmail,
                    custPhone: campos.custPhone,
                    custAddress: campos.custAddress,
                    custCp: campos.custCp,
                    custCity: campos.custCity,
                    numCopias: campos.numCopias,
                    modoColor: campos.modoColor,
                    modoDiapositiva: campos.modoDiapositiva,
                    encuadernado: campos.encuadernado,
                    envio: campos.envio
                },
                customer_email: campos.custEmail,
            }, {
                idempotencyKey: idempotencyKey
            });

            // 8. Devolver ÚNICAMENTE la URL de Stripe Checkout al cliente (Jamás exponer Blob URL)
            return res.status(200).json({ url: session.url });

        } catch (error) {
            console.error('Error procesando checkout [Server Log]:', error.message || error);
            return res.status(500).json({ error: 'Ocurrió un error al procesar el pago en el servidor. Por favor verifique sus datos e intente nuevamente.' });
        }
    });
}

module.exports = handler;
module.exports.config = config;
