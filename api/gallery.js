import { sql } from '@vercel/postgres';

/**
 * Extrae credenciales de la URL de Cloudinary.
 * Formato esperado: cloudinary://api_key:api_secret@cloud_name
 */
function getCloudinaryCredentials() {
  const rawUrl = process.env.CLOUDINARY_URL;
  if (!rawUrl) return null;

  try {
    const cleanUrl = rawUrl.replace(/[<>]/g, '').trim();
    const regex = /cloudinary:\/\/([^:]+):([^@]+)@(.+)/;
    const match = cleanUrl.match(regex);
    
    if (match) {
      return {
        apiKey: match[1],
        apiSecret: match[2],
        cloudName: match[3],
        auth: Buffer.from(`${match[1]}:${match[2]}`).toString('base64')
      };
    }
  } catch (err) {
    console.error('Error parseando CLOUDINARY_URL:', err);
  }
  return null;
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

  const creds = getCloudinaryCredentials();

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
      const isCollection = item.url && item.url.includes('collection.cloudinary.com');

      if (isCollection && creds) {
        try {
          const urlParts = item.url.split('/');
          const collectionId = urlParts[urlParts.length - 1];

          // Llamada directa a la API REST de Cloudinary (Admin API)
          // Documentación: https://cloudinary.com/documentation/admin_api#get_details_of_a_single_collection
          const apiUrl = `https://api.cloudinary.com/v1_1/${creds.cloudName}/collections/${collectionId}`;
          
          const cloudinaryResponse = await fetch(apiUrl, {
            headers: {
              'Authorization': `Basic ${creds.auth}`
            }
          });

          if (!cloudinaryResponse.ok) {
            const errorData = await cloudinaryResponse.json();
            throw new Error(errorData.error?.message || `HTTP ${cloudinaryResponse.status}`);
          }

          const data = await cloudinaryResponse.json();

          if (data && data.resources) {
            data.resources.forEach(asset => {
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
          console.error(`Error en colección '${item.carpeta}':`, error.message);
          allPhotos.push({
            ...item,
            id: `err-${item.id}-${Math.random().toString(36).substr(2, 5)}`,
            nombre: `${item.carpeta} (No disponible: ${error.message})`
          });
        }
      } else {
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