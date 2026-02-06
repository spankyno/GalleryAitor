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
    const dbResult = await sql`SELECT * FROM "Gallery" ORDER BY id ASC`;
    const allPhotos = [];

    for (const item of dbResult.rows) {
      const isCollectionUrl = item.url && item.url.includes('cloudinary.com') && (item.url.includes('collection') || item.url.includes('collections'));
      
      let resources = [];
      let success = false;

      // 1. INTENTO POR COLECCIÓN (Si hay URL)
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
          } else {
            console.log(`Colección ${collectionId} falló con ${res.status}. Intentando fallback por carpeta...`);
          }
        } catch (e) {
          console.error("Error parseando URL de colección:", e.message);
        }
      }

      // 2. FALLBACK: BUSQUEDA POR CARPETA (Search API)
      // Si no era colección, o si la colección dio 404, buscamos por el nombre de la carpeta
      if (!success && item.carpeta) {
        try {
          // La Search API es POST y permite filtrar por carpeta exacta
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

      // Procesar los recursos encontrados
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
        // Es una imagen individual estática de la DB
        allPhotos.push({
          ...item,
          id: item.id.toString(),
          nombre: item.nombre || 'Imagen'
        });
      } else if (isCollectionUrl && !success) {
        // Caso de error total: no se encontró ni colección ni carpeta
        allPhotos.push({
          id: `err-${item.id}`,
          url: `https://placehold.co/600x400/1a1a1a/white?text=No+se+encontro+contenido+en+${item.carpeta}`,
          carpeta: item.carpeta,
          nombre: 'Error de carga',
          fecha: new Date().toISOString(),
          formato: '!',
          size: '0 MB'
        });
      }
    }

    return response.status(200).json(allPhotos);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}