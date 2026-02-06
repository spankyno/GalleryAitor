import { sql } from '@vercel/postgres';

/**
 * Obtiene las credenciales de Cloudinary desde el entorno.
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
  // Configuración de cabeceras para CORS y JSON
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
      // Detección de colecciones compartidas de Cloudinary
      const isCollectionUrl = item.url && (
        item.url.includes('collection.cloudinary.com') || 
        item.url.includes('/collections/')
      );

      if (isCollectionUrl && creds) {
        try {
          const urlObj = new URL(item.url);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          
          let cloudNameInUrl = '';
          let collectionId = '';

          // Extracción de datos según el formato de URL
          if (urlObj.hostname === 'collection.cloudinary.com') {
            cloudNameInUrl = pathParts[0]; 
            collectionId = pathParts[1];
          } else {
            const collIdx = pathParts.indexOf('collections');
            if (collIdx !== -1 && pathParts[collIdx + 1]) {
              collectionId = pathParts[collIdx + 1];
              if (collIdx > 0) cloudNameInUrl = pathParts[collIdx - 1];
            }
          }

          if (!collectionId) throw new Error('No se encontró el ID de colección');

          /**
           * REGLA CRÍTICA: La Admin API de Cloudinary (/v1_1/:cloud_name) 
           * solo permite acceder a recursos SI el cloud_name coincide con el de la API KEY.
           * Si intentas consultar una colección de 'kalbo' con llaves de 'mi_nube', dará 404.
           */
          const targetCloud = creds.cloudName;
          
          // Si el cloud de la URL no es el tuyo, avisamos en logs pero intentamos con el tuyo
          if (cloudNameInUrl && cloudNameInUrl !== targetCloud) {
            console.warn(`Aviso: La colección pertenece a '${cloudNameInUrl}' pero tu API KEY es de '${targetCloud}'. Cloudinary denegará el acceso si no eres el dueño.`);
          }

          const apiUrl = `https://api.cloudinary.com/v1_1/${targetCloud}/collections/${collectionId}/assets`;
          
          const cloudinaryResponse = await fetch(apiUrl, {
            headers: {
              'Authorization': `Basic ${creds.auth}`,
              'Accept': 'application/json'
            }
          });

          if (!cloudinaryResponse.ok) {
            const errorText = await cloudinaryResponse.text();
            let errorMessage = `Error ${cloudinaryResponse.status}`;
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {}

            if (cloudinaryResponse.status === 404) {
              throw new Error(`404: La colección '${collectionId}' no se encuentra en tu cuenta (${targetCloud}).`);
            }
            throw new Error(errorMessage);
          }

          const data = await cloudinaryResponse.json();
          
          if (data && Array.isArray(data.resources)) {
            data.resources.forEach(asset => {
              allPhotos.push({
                id: asset.public_id,
                url: asset.secure_url,
                carpeta: item.carpeta || 'Colección',
                nombre: asset.filename || asset.public_id.split('/').pop(),
                fecha: asset.created_at,
                formato: asset.format ? asset.format.toUpperCase() : 'IMG',
                size: asset.bytes ? (asset.bytes / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'
              });
            });
          }
        } catch (error) {
          console.error(`Error procesando colección '${item.carpeta}':`, error.message);
          // Fallback visual para el error en la interfaz
          allPhotos.push({
            id: `error-${item.id}`,
            url: `https://placehold.co/600x400/111/white?text=Error+en+${item.carpeta}`,
            carpeta: item.carpeta,
            nombre: `Error: ${error.message}`,
            fecha: new Date().toISOString(),
            formato: '!',
            size: '0 MB'
          });
        }
      } else {
        // Registro de imagen única normal
        allPhotos.push({
          ...item,
          id: item.id?.toString() || Math.random().toString(36).substr(2, 9),
          nombre: item.nombre || 'Imagen'
        });
      }
    }

    return response.status(200).json(allPhotos);

  } catch (error) {
    console.error('Error crítico en la API:', error);
    return response.status(500).json({ error: error.message });
  }
}