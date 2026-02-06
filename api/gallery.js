import { sql } from '@vercel/postgres';

/**
 * Parsea las credenciales de Cloudinary.
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
    // INTENTO RESILIENTE DE CONSULTA SQL
    try {
      // Intento 1: Tabla con G mayúscula (sensible a mayúsculas)
      dbResult = await sql`SELECT * FROM "Gallery" ORDER BY id ASC`;
    } catch (dbError) {
      if (dbError.message.includes('relation') || dbError.message.includes('does not exist')) {
        try {
          // Intento 2: Tabla en minúsculas (estándar de Postgres)
          dbResult = await sql`SELECT * FROM gallery ORDER BY id ASC`;
        } catch (dbError2) {
          throw new Error(`No se encontró la tabla 'Gallery' ni 'gallery'. Verifica el nombre en tu Dashboard de Vercel. Error: ${dbError2.message}`);
        }
      } else {
        throw dbError;
      }
    }

    const allPhotos = [];

    for (const item of dbResult.rows) {
      const isCollectionUrl = item.url && item.url.includes('cloudinary.com') && (item.url.includes('collection') || item.url.includes('collections'));
      
      let resources = [];
      let success = false;

      // 1. INTENTO POR COLECCIÓN
      if (isCollectionUrl) {
        try {
          const urlObj = new URL(item.url);
          const parts = urlObj.pathname.split('/').filter(Boolean);
          const collectionId = parts.find(p => p.length > 20) || parts[parts.length - 1];
          
          const collUrl = `https://api.cloudinary.com/v1_1/${creds.cloudName}/collections/${collectionId}/assets`;
          const res = await fetch(collUrl, {
            headers: { 'Authorization': `Basic ${creds.auth}`, 'Accept': 'application/json' }
          });

          if (res.ok) {
            const data = await res.json();
            resources = data.resources || [];
            success = true;
          }
        } catch (e) {
          console.error("Error parseando colección:", e.message);
        }
      }

      // 2. FALLBACK POR CARPETA (Si la colección falló o no existe ID)
      if (!success && item.carpeta) {
        try {
          const searchUrl = `https://api.cloudinary.com/v1_1/${creds.cloudName}/resources/search`;
          const searchRes = await fetch(searchUrl, {
            method: 'POST',
            headers: { 
              'Authorization': `Basic ${creds.auth}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              expression: `folder:"${item.carpeta}/*" OR folder:"${item.carpeta}"`,
              max_results: 100,
              sort_by: [{ created_at: "desc" }]
            })
          });

          if (searchRes.ok) {
            const data = await searchRes.json();
            resources = data.resources || [];
            success = true;
          }
        } catch (e) {
          console.error("Error en Search API:", e.message);
        }
      }

      // Procesar resultados
      if (success && resources.length > 0) {
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
      } else if (!isCollectionUrl && item.url) {
        // Registro estático (foto individual)
        allPhotos.push({
          ...item,
          id: item.id.toString(),
          nombre: item.nombre || 'Imagen'
        });
      }
    }

    return response.status(200).json(allPhotos);
  } catch (error) {
    console.error('Error Crítico API:', error.message);
    return response.status(500).json({ error: error.message });
  }
}