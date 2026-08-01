const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Necesitamos el body en crudo (raw) para que Stripe pueda verificar la firma
export const config = {
    api: { bodyParser: false },
};

const getRawBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = [];
        req.on('data', (chunk) => body.push(chunk));
        req.on('end', () => resolve(Buffer.concat(body)));
        req.on('error', reject);
    });
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    let event;
    try {
        const rawBody = await getRawBody(req);
        const signature = req.headers['stripe-signature'];
        
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
        console.error('Error de validación del webhook de Stripe:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata;

        console.log('Pago completado con éxito. Procesando pedido para:', metadata.custEmail);

        try {
            // Enviar email al administrador con Resend
            const adminEmail = process.env.ADMIN_EMAIL || 'tucorreo@ejemplo.com'; 
            
            await resend.emails.send({
                from: 'Print2Web Notificaciones <onboarding@resend.dev>', // Usando el dominio por defecto de resend para pruebas
                to: adminEmail,
                subject: `¡Nuevo Pedido Pagado! - ${metadata.custName}`,
                html: `
                    <h1>Nuevo Pedido Confirmado ✅</h1>
                    <h2>Datos del Cliente</h2>
                    <ul>
                        <li><strong>Nombre:</strong> ${metadata.custName}</li>
                        <li><strong>Email:</strong> ${metadata.custEmail}</li>
                        <li><strong>Teléfono:</strong> ${metadata.custPhone}</li>
                        <li><strong>Dirección:</strong> ${metadata.envio === 'true' ? `${metadata.custAddress}, ${metadata.custCp} ${metadata.custCity}` : 'Recogida en tienda'}</li>
                    </ul>
                    <h2>Detalles de Impresión</h2>
                    <ul>
                        <li><strong>Copias:</strong> ${metadata.numCopias}</li>
                        <li><strong>Color:</strong> ${metadata.modoColor}</li>
                        <li><strong>Diapositiva (Caras):</strong> ${metadata.modoDiapositiva}</li>
                        <li><strong>Encuadernado:</strong> ${metadata.encuadernado === 'true' ? 'Sí' : 'No'}</li>
                        <li><strong>Envío:</strong> ${metadata.envio === 'true' ? 'Envío a domicilio' : 'Recogida presencial'}</li>
                    </ul>
                    <h2>Descarga del Documento</h2>
                    <p>El cliente ha subido un archivo: <strong>${metadata.documentName}</strong></p>
                    <a href="${metadata.documentUrl}" style="display:inline-block; padding:10px 20px; background-color:#3b82f6; color:white; text-decoration:none; border-radius:5px; font-weight:bold;">Descargar Archivo Seguro</a>
                    
                    <hr/>
                    <p><small>ID de Sesión de Stripe: ${session.id}</small></p>
                `
            });

            console.log('Email enviado al administrador correctamente.');
        } catch (error) {
            console.error('Error enviando el email por Resend:', error);
            // Aunque falle el email, devolvemos 200 a Stripe para que no reintente infinitamente
        }
    }

    res.status(200).json({ received: true });
}
