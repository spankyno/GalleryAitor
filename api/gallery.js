
import { sql } from '@vercel/postgres';
import { v2 as cloudinary } from 'cloudinary';

// Configuración de Cloudinary usando la variable de entorno estándar
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_api_url: process.env.CLOUDINARY_URL,
    secure: true
  });
}

export default async function handler(request, response) {
  // CORS Headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

  try {
    if (!process.env.POSTGRES_URL) {
      throw new Error('Falta la variable de entorno POSTGRES_URL');
    }

    // 1. Obtener los álbumes/carpetas registrados en la DB
    let dbResult;
    try {
      dbResult = await sql`SELECT * FROM "Gallery" ORDER BY id ASC`;
    } catch (e) {
      dbResult = await sql`SELECT * FROM Gallery ORDER BY id ASC`;
    }

    const allPhotos = [];

    // 2. Iterar sobre cada registro para expandir colecciones si es necesario
    for (const item of dbResult.rows) {
      const isCollectionUrl = item.url.includes('collection.cloudinary.com');

      if (isCollectionUrl && process.env.CLOUDINARY_URL) {
        try {
          // Extraer el ID de la colección de la URL (el último segmento)
          const urlParts = item.url.split('/');
          const collectionId = urlParts[urlParts.length - 1];

          /**
           * Utilizamos el Search API para buscar por collection_id.
           * Es el método más fiable para URLs compartidas de la Media Library.
           */
          const searchResult = await cloudinary.search
            .expression(`collection_id:${collectionId}`)
            .max_results(100)
            .execute();

          if (searchResult.resources && searchResult.resources.length > 0) {
            searchResult.resources.forEach(asset => {
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
            // Si el Search API no encuentra nada con collection_id, 
            // intentamos como fallback el ID de la colección mediante el API de Admin (si estuviera soportado)
            console.warn(`No se encontraron assets para la colección: ${collectionId}`);
            allPhotos.push({
              ...item,
              id: `empty-${item.id}`,
              nombre: 'Colección vacía o no indexada'
            });
          }
        } catch (colError) {
          console.error(`Error procesando colección ${item.url}:`, colError.message);
          // Fallback: mostrar al menos la entrada de la base de datos
          allPhotos.push({
            ...item,
            id: `err-${item.id}`,
            nombre: `Error: ${colError.message}`
          });
        }
      } else {
        // Es una URL de imagen normal o Cloudinary individual
        allPhotos.push({
          ...item,
          id: item.id || Math.random().toString(36).substr(2, 9),
          nombre: item.nombre || 'Imagen'
        });
      }
    }

    return response.status(200).json(allPhotos);

  } catch (error) {
    console.error('API Error General:', error);
    return response.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
}
