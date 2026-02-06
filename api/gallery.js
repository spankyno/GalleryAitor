import { sql } from '@vercel/postgres';

/**
 * Extrae credenciales de CLOUDINARY_URL
 */
function getCloudinaryCredentials() {
  const rawUrl = process.env.CLOUDINARY_URL;
  if (!rawUrl) return null;
  try {
    const cleanUrl = rawUrl.replace(/[<>]/g, '').trim();
    const url = new URL(cleanUrl);
    return {
      apiKey: url.username,
      apiSecret: url.password,
      cloudName: url.hostname,
      auth: Buffer.from(`${url.username}:${url.password}`).toString('base64')
    };
  } catch (err) {
    return null;
  }
}

/**
 * Intenta extraer el Cloud Name y el ID de una URL de colección de Cloudinary
 */
function parseCollectionUrl(urlString) {
  try {
    const url = new URL(urlString);
    const parts = url.pathname.split('/').filter(Boolean);
    
    // Formato: https://collection.cloudinary.com/cloud_name/id
    if (url.hostname === 'collection.cloudinary.com') {
      return {
        cloudName: parts[0],
        collectionId: parts[1]
      };
    }
    
    // Formato: https://cloudinary.com/collections/id
    const collIdx = parts.indexOf('collections');
    if (collIdx !== -1 && parts[collIdx + 1]) {
      return {
        cloudName: null, // Asumir el propio
        collectionId: parts[collIdx + 1]
      };
    }
  } catch (e) {}
  return null;
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

  const creds = getCloudinaryCredentials();
  if (!creds) return response.status(500).json({ error: 'Faltan credenciales de Cloudinary' });

  try {
    let dbResult;
    try {
      dbResult = await sql`SELECT * FROM "Gallery" ORDER BY id ASC`;
    } catch (e) {
      dbResult = await sql`SELECT * FROM gallery ORDER BY id ASC`;
    }

    const allPhotos = [];

    for (const item of dbResult.rows) {
      const collectionInfo = item.url ? parseCollectionUrl(item.url) : null;
      let resources = [];
      let found = false;

      // CASO 1: ES UNA COLECCIÓN
      if (collectionInfo) {
        try {
          // Usar el cloud name de la URL si existe, si no el de las credenciales
          const targetCloud = collectionInfo.cloudName || creds.cloudName;
          const collUrl = `https://api.cloudinary.com/v1_1/${targetCloud}/collections/${collectionInfo.collectionId}/assets`;
          
          const res = await fetch(collUrl, {
            headers: { 'Authorization': `Basic ${creds.auth}`, 'Accept': 'application/json' }
          });

          if (res.ok) {
            const data = await res.json();
            resources = data.resources || [];
            found = true;
          } else {
            console.log(`Colección ${collectionInfo.collectionId} falló con status ${res.status}.`);
          }
        } catch (e) {
          console.error("Error consultando colección:", e.message);
        }
      }

      // CASO 2 o FALLBACK: ES UNA CARPETA (O búsqueda por nombre de colección como carpeta)
      // Si no se encontraron recursos por colección, intentamos buscar una carpeta con ese nombre
      if (!found && item.carpeta) {
        try {
          const searchUrl = `https://api.cloudinary.com/v1_1/${creds.cloudName}/resources/search`;
          const searchRes = await fetch(searchUrl, {
            method: 'POST',
            headers: { 
              'Authorization': `Basic ${creds.auth}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              // Buscamos en la carpeta o que contenga el nombre en el path
              expression: `folder:"${item.carpeta}/*" OR folder:"${item.carpeta}"`,
              max_results: 100
            })
          });

          if (searchRes.ok) {
            const data = await searchRes.json();
            resources = data.resources || [];
            found = true;
          }
        } catch (e) {
          console.error("Error en Search API:", e.message);
        }
      }

      // PROCESAMIENTO DE RESULTADOS
      if (found && resources.length > 0) {
        resources.forEach(asset => {
          allPhotos.push({
            id: asset.public_id,
            url: asset.secure_url,
            carpeta: item.carpeta || 'General',
            nombre: asset.filename || asset.public_id.split('/').pop(),
            fecha: asset.created_at,
            formato: (asset.format || 'img').toUpperCase(),
            size: asset.bytes ? (asset.bytes / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'
          });
        });
      } else if (item.url && !collectionInfo) {
        // Es una imagen individual estática
        allPhotos.push({
          ...item,
          id: item.id.toString(),
          nombre: item.nombre || 'Imagen'
        });
      }
    }

    return response.status(200).json(allPhotos);
  } catch (error) {
    console.error('Error crítico:', error.message);
    return response.status(500).json({ error: error.message });
  }
}