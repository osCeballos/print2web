const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const { Redis } = require('@upstash/redis');

const resend = new Resend(process.env.RESEND_API_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Inicializar cliente Redis para deduplicación
let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
    } catch (e) {
        console.warn('⚠️ Redis no configurado en Webhook:', e.message);
    }
}

// Configuración obligatoria para Vercel Functions: desactivar bodyParser automático
const config = {
    api: { bodyParser: false },
};

module.exports.config = config;

/**
 * Captura el body crudo para verificar la firma de Stripe
 */
const getRawBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = [];
        req.on('data', (chunk) => body.push(chunk));
        req.on('end', () => resolve(Buffer.concat(body)));
        req.on('error', reject);
    });
};

/**
 * Sanitiza valores de texto para evitar inyección HTML
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Envío de correo electrónico con reintentos
 */
async function enviarEmailConReintentos(payload, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            attempt++;
            const response = await resend.emails.send(payload);
            return response;
        } catch (err) {
            console.error(`Intento ${attempt} de envío de correo falló [Log interno]:`, err.message);
            if (attempt >= maxRetries) throw err;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
    }
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    if (!webhookSecret) {
        console.error('CRÍTICO: STRIPE_WEBHOOK_SECRET no está definido en las variables de entorno.');
        return res.status(500).send('Error interno de configuración del servidor');
    }

    let event;
    try {
        const rawBody = await getRawBody(req);
        const signature = req.headers['stripe-signature'];

        if (!signature) {
            return res.status(400).send('Falta cabecera stripe-signature');
        }

        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
        console.error('Firma de Webhook de Stripe inválida o alterada [Log interno]');
        return res.status(400).send('Firma de webhook inválida');
    }

    // 1. Deduplicación e Idempotencia con Upstash Redis (Fallback estricto si falla)
    if (event.id) {
        if (redis) {
            try {
                const yaProcesado = await redis.get(`event_${event.id}`);
                if (yaProcesado) {
                    console.log(`Evento duplicado de Stripe ignorado de forma idempotente [ID: ${event.id}]`);
                    return res.status(200).json({ received: true, status: 'already_processed' });
                }
            } catch (rErr) {
                console.error('CRÍTICO: Falló la consulta de deduplicación en Redis:', rErr.message);
                // Si Redis falla, responder 500 para forzar a Stripe a reintentar cuando Redis se recupere
                return res.status(500).send('Fallo temporal en el servicio de deduplicación');
            }
        } else {
            console.warn('ADVERTENCIA: Upstash Redis no está configurado. La deduplicación de eventos no está activa.');
        }
    }

    // 2. Procesamiento del evento checkout.session.completed
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata || {};

        console.log(`Procesando pedido confirmado [Stripe Session ID: ${session.id}, Order ID: ${metadata.orderId || 'N/A'}]`);

        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'info@tramasweb.com';
            
            // Sanitización estricta de todos los campos HTML
            const safeName = escapeHtml(metadata.custName);
            const safeEmail = escapeHtml(metadata.custEmail);
            const safePhone = escapeHtml(metadata.custPhone);
            const safeAddress = escapeHtml(metadata.custAddress);
            const safeCp = escapeHtml(metadata.custCp);
            const safeCity = escapeHtml(metadata.custCity);
            const safeDocName = escapeHtml(metadata.documentName);
            const safeDocUrl = escapeHtml(metadata.documentUrl);

            const esEnvio = metadata.envio === 'true';
            const direccionFormateada = esEnvio 
                ? `${safeAddress}, ${safeCp} ${safeCity}` 
                : 'Recogida presencial en taller de Sant Just Desvern';

            await enviarEmailConReintentos({
                from: 'Print2Web Notificaciones <onboarding@resend.dev>',
                to: adminEmail,
                subject: `📦 Nuevo pedido online de ${safeName} (#${escapeHtml(metadata.orderId)})`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h1 style="color: #17b7e8;">Nuevo Pedido Confirmado ✅</h1>
                        <p>Se ha completado un nuevo pago de forma segura a través de Stripe Checkout.</p>
                        
                        <h2 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Datos del Cliente</h2>
                        <ul>
                            <li><strong>Nombre:</strong> ${safeName}</li>
                            <li><strong>Email:</strong> ${safeEmail}</li>
                            <li><strong>Teléfono:</strong> ${safePhone}</li>
                            <li><strong>Modalidad de Entrega:</strong> ${direccionFormateada}</li>
                        </ul>
                        
                        <h2 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Detalles del Trabajo</h2>
                        <ul>
                            <li><strong>Número de Copias:</strong> ${escapeHtml(metadata.numCopias)}</li>
                            <li><strong>Modo de Color:</strong> ${escapeHtml(metadata.modoColor)}</li>
                            <li><strong>Formato Caras:</strong> ${escapeHtml(metadata.modoDiapositiva)}</li>
                            <li><strong>Encuadernado:</strong> ${metadata.encuadernado === 'true' ? 'Sí (Espiral A4)' : 'No'}</li>
                            <li><strong>Envío a Domicilio:</strong> ${esEnvio ? 'Sí' : 'No (Recogida)'}</li>
                        </ul>
                        
                        <h2 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Documento Adjunto (Almacenamiento Privado Seguro)</h2>
                        <p>Nombre original del archivo: <strong>${safeDocName}</strong></p>
                        <p style="margin-top: 15px;">
                            <a href="${safeDocUrl}" style="display:inline-block; padding:12px 24px; background-color:#131313; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold;">
                                Descargar Archivo Adjunto (Almacenamiento Seguro)
                            </a>
                        </p>
                        
                        <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
                        <p style="font-size: 12px; color: #999;">ID de Pedido: ${escapeHtml(metadata.orderId)} | Transacción Stripe: ${session.id}</p>
                    </div>
                `
            });

            // Marcar evento como procesado en Upstash Redis (TTL 7 días = 604800s)
            if (redis && event.id) {
                try {
                    await redis.set(`event_${event.id}`, 'processed', { ex: 604800 });
                } catch (rSetErr) {
                    console.error('CRÍTICO: Falló el guardado del estado de deduplicación en Redis:', rSetErr.message);
                    return res.status(500).send('Fallo al registrar estado de deduplicación');
                }
            }

        } catch (error) {
            console.error('Error procesando notificación de pedido [Server Log]:', error.message);
            // Devolver 500 para que Stripe reintente la entrega del webhook si fue fallo de envío
            return res.status(500).send('Error procesando la notificación del webhook');
        }
    }

    return res.status(200).json({ received: true });
}

module.exports = handler;
