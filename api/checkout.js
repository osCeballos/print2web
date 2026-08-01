const { IncomingForm } = require('formidable');
const { put } = require('@vercel/blob');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');

// Configuración para que Vercel no parsee el body, permitiendo que formidable lo haga (solo si usamos Next.js, pero lo añadimos por si acaso)
const config = {
    api: { bodyParser: false },
};

// Precios Base (deben coincidir con el frontend)
const PRECIO_PAGINA_COLOR = 0.50;
const PRECIO_PAGINA_BW = 0.30;
const PRECIO_ENCUADERNACION = 2.00;
const PRECIO_ENVIO = 5.00;

function calcularTotal(campos) {
    const numP = Math.max(1, parseInt(campos.numPaginas || '1', 10));
    const copias = Math.max(1, parseInt(campos.numCopias || '1', 10));
    const color = campos.modoColor === 'color';
    const precioPagina = color ? PRECIO_PAGINA_COLOR : PRECIO_PAGINA_BW;

    let totalImprenta = (numP * precioPagina * copias);
    
    // Convertimos "true" a booleano
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

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const form = new IncomingForm({ keepExtensions: true });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Error procesando formulario:', err);
            return res.status(500).json({ error: 'Error procesando la solicitud' });
        }

        try {
            // Extraer campos (formidable en v3 devuelve arrays, por lo que tomamos el primer elemento si es array)
            const getField = (name) => Array.isArray(fields[name]) ? fields[name][0] : fields[name];
            
            const campos = {
                numPaginas: getField('numPaginas'),
                numCopias: getField('numCopias'),
                modoColor: getField('modoColor'),
                modoDiapositiva: getField('modoDiapositiva'),
                encuadernado: getField('encuadernado'),
                envio: getField('envio'),
                custName: getField('custName'),
                custEmail: getField('custEmail'),
                custPhone: getField('custPhone'),
                custAddress: getField('custAddress') || '',
                custCp: getField('custCp') || '',
                custCity: getField('custCity') || ''
            };

            const file = Array.isArray(files.documento) ? files.documento[0] : files.documento;
            if (!file) {
                return res.status(400).json({ error: 'No se adjuntó ningún documento.' });
            }

            // 1. Subir a Vercel Blob
            const fileStream = fs.createReadStream(file.filepath);
            const safeName = (file.originalFilename || 'documento.pdf').replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const blobResult = await put(safeName, fileStream, {
                access: 'public',
                addRandomSuffix: true,
                token: process.env.BLOB_READ_WRITE_TOKEN
            });

            // 2. Calcular precio real
            const total = calcularTotal(campos);

            // 3. Crear sesión de Stripe
            // La URL base depende del entorno (localhost o vercel)
            const host = req.headers.host;
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const origin = `${protocol}://${host}`;

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'eur',
                            product_data: {
                                name: 'Impresión de Documento - Print2Web',
                                description: `${campos.numCopias} copia(s) | ${campos.modoColor.toUpperCase()} | Encuadernado: ${campos.encuadernado === 'true' ? 'Sí' : 'No'} | Envío: ${campos.envio === 'true' ? 'Sí' : 'Recogida'}`,
                            },
                            unit_amount: Math.round(total * 100), // En céntimos
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${origin}/exito.html`,
                cancel_url: `${origin}/cancelado.html`,
                metadata: {
                    documentUrl: blobResult.url,
                    documentName: file.originalFilename,
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
                customer_email: campos.custEmail, // Pre-rellenar email en Stripe
            });

            // 4. Devolver la URL de la sesión para que el frontend redirija
            res.status(200).json({ url: session.url });

        } catch (error) {
            console.error('Error en checkout:', error);
            res.status(500).json({ error: 'Error procesando el pago: ' + error.message });
        }
    });
}

module.exports = handler;
module.exports.config = config;
