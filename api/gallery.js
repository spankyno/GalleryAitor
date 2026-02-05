import { sql } from '@vercel/postgres';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Configura Cloudinary limpiando caracteres < > de la URL y usando el soporte nativo de cloudinary_url.
 */
function configureCloudinary() {
  const rawUrl = process.env.CLOUDINARY_URL;
  if (!rawUrl) {
    console.error('CLOUDINARY_URL no definida');
    return false;
  }

  try {
    // Limpieza de posibles brackets pegados desde el panel de Vercel
    const cleanUrl = rawUrl.replace(/[<>]/g, '').trim();
    
    // Configuración directa mediante URL, que es el método más fiable
    cloudinary.config({
      cloudinary_url: cleanUrl,
      secure: true
    });
    return true;
  } catch (err) {
    console.error('Error configurando Cloudinary:', err);
  }
  return false;
}

const isConfigured = configureCloudinary();

export default async function handler(request, response) {
  // Headers CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

  try {
    if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL no definida');

    let dbResult;
    try {
      dbResult = await sql`SELECT * FROM "Gallery" ORDER BY id ASC`;
    } catch (e) {
      dbResult = await sql`SELECT * FROM Gallery ORDER BY id ASC`;
    }

    const allPhotos = [];

    for (const item of dbResult.rows) {
      const isCollection = item.url.includes('collection.cloudinary.com');

      if (isCollection && isConfigured) {
        try {
          const urlParts = item.url.split('/');
          const collectionId = urlParts[urlParts.length - 1];

          // Utilizar el método oficial: cloudinary.api.collection
          // Este método devuelve los detalles de la colección, incluyendo el array 'resources'
          const result = await cloudinary.api.collection(collectionId, {
            max_results: 100
          });

          if (result && result.resources) {
            result.resources.forEach(asset => {
              allPhotos.push({
                id: asset.public_id,
                url: asset.secure_url,
                carpeta: item.carpeta,
                nombre: asset.filename || asset.public_id.split('/').pop(),
                fecha: asset.created_at,
                formato: asset.format ? asset.format.toUpperCase() : 'IMG',
                size: asset.bytes ? (asset.bytes / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'
              });
            });
          }
        } catch (error) {
          console.error(`Error procesando colección ${item.carpeta}:`, error.message);
          // Fallback: mostrar la entrada original con aviso de error
          allPhotos.push({
            ...item,
            id: `err-${item.id}`,
            nombre: `${item.carpeta} (Error: ${error.message})`
          });
        }
      } else {
        // Imagen individual o URL no Cloudinary
        allPhotos.push({
          ...item,
          id: item.id?.toString() || Math.random().toString(36).substr(2, 9),
          nombre: item.nombre || 'Imagen'
        });
      }
    }

    return response.status(200).json(allPhotos);

  } catch (error) {
    console.error('Error Crítico API:', error);
    return response.status(500).json({ error: error.message });
  }
}