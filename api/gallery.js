
import { sql } from '@vercel/postgres';

/**
 * Parsea el CLOUDINARY_URL para extraer credenciales
 * Formato: cloudinary://api_key:api_secret@cloud_name
 */
function parseCloudinaryUrl(url) {
  if (!url) return null;
  try {
    const regex = /cloudinary:\/\/([^:]+):([^@]+)@(.+)/;
    const matches = url.match(regex);
    if (!matches) return null;
    return {
      apiKey: matches[1],
      apiSecret: matches[2],
      cloudName: matches[3]
    };
  } catch (e) {
    return null;
  }
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

  const cloudConfig = parseCloudinaryUrl(process.env.CLOUDINARY_URL);

  try {
    if (!process.env.POSTGRES_URL) {
      throw new Error('Falta POSTGRES_URL');
    }

    // 1. Obtener registros de la base de datos
    let dbResult;
    try {
      dbResult = await sql`SELECT * FROM "Gallery" ORDER BY id ASC`;
    } catch (e) {
      dbResult = await sql`SELECT * FROM Gallery ORDER BY id ASC`;
    }

    const allPhotos = [];

    // 2. Procesar cada registro
    for (const item of dbResult.rows) {
      const isCollection = item.url.includes('collection.cloudinary.com');

      if (isCollection && cloudConfig) {
        try {
          const urlParts = item.url.split('/');
          const collectionId = urlParts[urlParts.length - 1];

          // Llamada directa a la API de Cloudinary (Admin API)
          // Endpoint: GET /collections/:collection_id/assets
          const auth = Buffer.from(`${cloudConfig.apiKey}:${cloudConfig.apiSecret}`).toString('base64');
          const apiUrl = `https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/collections/${collectionId}/assets`;

          const cloudinaryResponse = await fetch(apiUrl, {
            headers: {
              'Authorization': `Basic ${auth}`
            }
          });

          if (!cloudinaryResponse.ok) {
            throw new Error(`Cloudinary API respondió con ${cloudinaryResponse.status}`);
          }

          const cloudinaryData = await cloudinaryResponse.json();
          
          if (cloudinaryData.resources) {
            cloudinaryData.resources.forEach(asset => {
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
        } catch (colError) {
          console.error(`Error expandiendo colección ${item.url}:`, colError);
          allPhotos.push({
            ...item,
            id: item.id || `err-${Math.random()}`,
            nombre: 'Error al cargar colección'
          });
        }
      } else {
        // Es una URL de imagen directa (la mostramos tal cual)
        allPhotos.push({
          ...item,
          id: item.id || Math.random().toString(36).substr(2, 9),
          nombre: item.nombre || 'Imagen directa'
        });
      }
    }

    return response.status(200).json(allPhotos);

  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ 
      error: 'Server Error', 
      message: error.message 
    });
  }
}
