import { sql } from '@vercel/postgres';

/**
 * Extrae credenciales de la URL de Cloudinary de forma robusta.
 * Formato esperado: cloudinary://api_key:api_secret@cloud_name
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
  // CORS Headers
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
      // Detección de URL de colección compartida
      const isCollection = item.url && (
        item.url.includes('collection.cloudinary.com') || 
        item.url.includes('/collections/')
      );

      if (isCollection && creds) {
        try {
          const urlObj = new URL(item.url);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          
          let targetCloudName = creds.cloudName;
          let collectionId = '';

          // Caso: https://collection.cloudinary.com/kalbo/641a664a4d00ceee7d208df007a7c17d
          if (urlObj.hostname === 'collection.cloudinary.com') {
            if (pathParts.length >= 2) {
              targetCloudName = pathParts[0]; // 'kalbo'
              collectionId = pathParts[1];    // '641a...c17d'
            }
          } else {
            // Caso: URLs de API v1_1 u otras variantes
            const collIndex = pathParts.indexOf('collections');
            if (collIndex !== -1 && pathParts[collIndex + 1]) {
              collectionId = pathParts[collIndex + 1];
              if (collIndex > 0) targetCloudName = pathParts[collIndex - 1];
            } else {
              collectionId = pathParts.filter(p => p !== 'view' && p !== 'edit').pop();
            }
          }
          
          if (!collectionId) throw new Error('No se pudo identificar el ID de la colección');

          /**
           * DOCUMENTACION CLOUDINARY ADMIN API:
           * Endpoint para obtener recursos de una colección:
           * GET /collections/:collection_external_id/assets
           */
          const apiUrl = `https://api.cloudinary.com/v1_1/${targetCloudName}/collections/${collectionId}/assets`;
          
          console.log(`Consultando colección: ${apiUrl} usando cloud ${targetCloudName}`);

          const cloudinaryResponse = await fetch(apiUrl, {
            headers: {
              'Authorization': `Basic ${creds.auth}`,
              'Accept': 'application/json'
            }
          });

          if (!cloudinaryResponse.ok) {
            const errorText = await cloudinaryResponse.text();
            let errorMsg = `HTTP ${cloudinaryResponse.status}`;
            try {
              const errorData = JSON.parse(errorText);
              errorMsg = errorData.error?.message || errorMsg;
            } catch (e) {}
            
            // Si falla con el cloud de la URL, reintentar con el cloud de las credenciales
            if (cloudinaryResponse.status === 404 && targetCloudName !== creds.cloudName) {
              const fallbackUrl = `https://api.cloudinary.com/v1_1/${creds.cloudName}/collections/${collectionId}/assets`;
              const retryResponse = await fetch(fallbackUrl, {
                headers: { 'Authorization': `Basic ${creds.auth}`, 'Accept': 'application/json' }
              });
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                processResources(retryData.resources, item, allPhotos);
                continue;
              }
            }
            throw new Error(errorMsg);
          }

          const data = await cloudinaryResponse.json();
          processResources(data.resources, item, allPhotos);

        } catch (error) {
          console.error(`Error en '${item.carpeta}':`, error.message);
          allPhotos.push({
            ...item,
            id: `err-${item.id}`,
            nombre: `${item.carpeta} (${error.message})`,
            url: 'https://via.placeholder.com/400x300?text=Error+Coleccion'
          });
        }
      } else {
        // Imagen individual
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

/**
 * Helper para procesar recursos de Cloudinary y añadirlos a la lista
 */
function processResources(resources, sourceItem, list) {
  if (resources && Array.isArray(resources)) {
    resources.forEach(asset => {
      list.push({
        id: asset.public_id,
        url: asset.secure_url,
        carpeta: sourceItem.carpeta,
        nombre: asset.filename || asset.public_id.split('/').pop(),
        fecha: asset.created_at,
        formato: asset.format ? asset.format.toUpperCase() : 'IMG',
        size: asset.bytes ? (asset.bytes / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'
      });
    });
  }
}