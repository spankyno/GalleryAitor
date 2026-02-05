
import { sql } from '@vercel/postgres';

/**
 * Parsea el CLOUDINARY_URL para extraer credenciales
 * Formato: cloudinary://api_key:api_secret@cloud_name
 */
function parseCloudinaryUrl(url) {
  if (!url) return null;
  try {
    const cleanUrl = url.replace('cloudinary://', '');
    const [credentials, cloudName] = cleanUrl.split('@');
    const [apiKey, apiSecret] = credentials.split(':');
    return { apiKey, apiSecret, cloudName };
  } catch (e) {
    console.error("Error parseando CLOUDINARY_URL:", e);
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
      throw new Error('Falta la variable de entorno POSTGRES_URL');
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

          // Autenticación para Cloudinary
          const auth = Buffer.from(`${cloudConfig.apiKey}:${cloudConfig.apiSecret}`).toString('base64');
          
          /**
           * Usamos el Search API en lugar del Collections API directo.
           * El Search API permite buscar recursos que pertenezcan a una colección específica.
           */
          const searchUrl = `https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/resources/search`;
          
          const cloudinaryResponse = await fetch(searchUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              expression: `collection_id:${collectionId}`,
              max_results: 100,
              with_field: ["context", "metadata"]
            })
          });

          if (!cloudinaryResponse.ok) {
            const errorText = await cloudinaryResponse.text();
            throw new Error(`Cloudinary Search API Error (${cloudinaryResponse.status}): ${errorText}`);
          }

          const cloudinaryData = await cloudinaryResponse.json();
          
          if (cloudinaryData.resources && cloudinaryData.resources.length > 0) {
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
          } else {
            // Si el Search API no devuelve nada por ID, intentamos un fallback 
            // Esto sucede si el ID de la URL no es el ID interno del Search API
            console.warn(`No se encontraron recursos para la colección ${collectionId} usando Search API.`);
            allPhotos.push({
              ...item,
              id: item.id || `fallback-${Math.random()}`,
              nombre: 'Colección vacía o privada'
            });
          }
        } catch (colError) {
          console.error(`Error expandiendo colección ${item.url}:`, colError.message);
          allPhotos.push({
            ...item,
            id: item.id || `err-${Math.random()}`,
            nombre: 'Error al expandir colección'
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
