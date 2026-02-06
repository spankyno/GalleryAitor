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
      // Detección de URL de colección
      const isCollection = item.url && (
        item.url.includes('collection.cloudinary.com') || 
        item.url.includes('/collections/')
      );

      if (isCollection && creds) {
        try {
          /**
           * ANALISIS DE LA URL DE COLECCION
           * Ejemplo: https://collection.cloudinary.com/mi-cloud/abc123def456/view
           */
          const urlObj = new URL(item.url);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          
          let targetCloudName = creds.cloudName;
          let collectionId = '';

          if (urlObj.hostname === 'collection.cloudinary.com') {
            // En collection.cloudinary.com, el primer path suele ser el cloud name
            // y el segundo es el ID de la colección.
            if (pathParts.length >= 2) {
              targetCloudName = pathParts[0];
              collectionId = pathParts[1];
            }
          } else {
            // URLs tipo .../v1_1/cloudname/collections/id
            const collIndex = pathParts.indexOf('collections');
            if (collIndex !== -1 && pathParts[collIndex + 1]) {
              collectionId = pathParts[collIndex + 1];
              // El cloudName suele estar antes de /collections/
              if (collIndex > 0) targetCloudName = pathParts[collIndex - 1];
            } else {
              // Fallback: último segmento
              collectionId = pathParts.filter(p => p !== 'view' && p !== 'edit').pop();
            }
          }
          
          if (!collectionId) throw new Error('No se pudo identificar el ID de la colección');

          // IMPORTANTE: La API de Administración SIEMPRE usa el Cloud Name asociado a la API Key.
          // Si la colección pertenece a otro Cloud Name, la API Key debe tener permisos sobre él.
          const apiUrl = `https://api.cloudinary.com/v1_1/${creds.cloudName}/collections/${collectionId}`;
          
          const cloudinaryResponse = await fetch(apiUrl, {
            headers: {
              'Authorization': `Basic ${creds.auth}`,
              'Accept': 'application/json'
            }
          });

          if (!cloudinaryResponse.ok) {
            const errorText = await cloudinaryResponse.text();
            let errorDetail = `Error ${cloudinaryResponse.status}`;
            try {
              const errorData = JSON.parse(errorText);
              errorDetail = errorData.error?.message || errorDetail;
            } catch (e) {}
            
            if (cloudinaryResponse.status === 404) {
              throw new Error(`Colección no encontrada (ID: ${collectionId} en Cloud: ${creds.cloudName})`);
            }
            throw new Error(errorDetail);
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
        // Imagen única o registro normal
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