import { sql } from '@vercel/postgres';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Configura Cloudinary limpiando la URL de posibles caracteres extraños.
 */
function configureCloudinary() {
  const rawUrl = process.env.CLOUDINARY_URL;
  if (!rawUrl) return false;

  try {
    // Elimina posibles brackets o espacios
    const cleanUrl = rawUrl.replace(/[<>]/g, '').trim();
    cloudinary.config({
      cloudinary_url: cleanUrl,
      secure: true
    });
    return true;
  } catch (err) {
    console.error('Error al configurar Cloudinary:', err);
    return false;
  }
}

const isConfigured = configureCloudinary();

export default async function handler(request, response) {
  // Headers CORS para despliegues Vercel
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

  try {
    if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL no definida');

    let dbResult;
    try {
      // Intentamos con comillas por si la tabla tiene mayúsculas
      dbResult = await sql`SELECT * FROM "Gallery" ORDER BY id ASC`;
    } catch (e) {
      dbResult = await sql`SELECT * FROM Gallery ORDER BY id ASC`;
    }

    const allPhotos = [];

    for (const item of dbResult.rows) {
      const isCollection = item.url && item.url.includes('collection.cloudinary.com');

      if (isCollection && isConfigured) {
        try {
          const urlParts = item.url.split('/');
          const collectionId = urlParts[urlParts.length - 1];

          // Detección dinámica de método para evitar "is not a function"
          const apiMethod = cloudinary.api.resources_by_collection || cloudinary.api.collection;
          
          if (typeof apiMethod !== 'function') {
            throw new Error('Método de colecciones no disponible en el SDK');
          }

          const result = await apiMethod(collectionId, {
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
          console.error(`Error en carpeta ${item.carpeta}:`, error.message);
          // Fallback: mostrar al menos la entrada de la base de datos
          allPhotos.push({
            ...item,
            id: `err-${item.id}-${Math.random().toString(36).substr(2, 5)}`,
            nombre: `${item.carpeta} (Error de sincronización)`
          });
        }
      } else {
        // Imagen estándar o registro directo de DB
        allPhotos.push({
          ...item,
          id: item.id?.toString() || Math.random().toString(36).substr(2, 9),
          nombre: item.nombre || 'Imagen'
        });
      }
    }

    return response.status(200).json(allPhotos);

  } catch (error) {
    console.error('Error crítico API:', error);
    return response.status(500).json({ error: error.message });
  }
}