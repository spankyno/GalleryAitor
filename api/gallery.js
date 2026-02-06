import { sql } from '@vercel/postgres';

/**
 * Extrae credenciales de la URL de Cloudinary de forma robusta.
 * Formato: cloudinary://api_key:api_secret@cloud_name
 */
function getCloudinaryCredentials() {
  const rawUrl = process.env.CLOUDINARY_URL;
  if (!rawUrl) return null;

  try {
    const cleanUrl = rawUrl.replace(/[<>]/g, '').trim();
    if (cleanUrl.startsWith('cloudinary://')) {
      const url = new URL(cleanUrl);
      return {
        apiKey: url.username,
        apiSecret: url.password,
        cloudName: url.hostname,
        auth: Buffer.from(`${url.username}:${url.password}`).toString('base64')
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
      const isCollection = item.url && (item.url.includes('collection.cloudinary.com') || item.url.includes('/collections/'));

      if (isCollection && creds) {
        try {
          // Extracción robusta del ID: busca /collections/ID o toma el último segmento antes de posibles parámetros
          let collectionId = '';
          const match = item.url.match(/\/collections\/([^\/\?\#]+)/);
          if (match) {
            collectionId = match[1];
          } else {
            // Si es una URL limpia tipo .../cloudname/id, quitamos el cloudname
            const parts = item.url.split('/').filter(p => p && p !== 'view');
            collectionId = parts.pop();
          }
          
          if (!collectionId) throw new Error('ID de colección no detectado');

          // El cloudName debe ser el que tenemos en las credenciales
          const apiUrl = `https://api.cloudinary.com/v1_1/${creds.cloudName}/collections/${collectionId}`;
          
          const cloudinaryResponse = await fetch(apiUrl, {
            headers: {
              'Authorization': `Basic ${creds.auth}`,
              'Accept': 'application/json'
            }
          });

          const contentType = cloudinaryResponse.headers.get('content-type');
          
          if (!cloudinaryResponse.ok) {
            let errorMsg = `Error ${cloudinaryResponse.status}`;
            if (contentType && contentType.includes('application/json')) {
              const errorData = await cloudinaryResponse.json();
              errorMsg = errorData.error?.message || errorMsg;
            } else if (cloudinaryResponse.status === 404) {
              errorMsg = "ID no encontrado en este Cloud Name";
            }
            throw new Error(errorMsg);
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
            nombre: `${item.carpeta} (${error.message})`
          });
        }
      } else {
        // Imagen única o registro manual
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