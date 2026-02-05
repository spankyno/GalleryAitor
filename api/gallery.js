
import { sql } from '@vercel/postgres';
import { v2 as cloudinary } from 'cloudinary';

// Configurar Cloudinary usando la variable de entorno CLOUDINARY_URL
// Formato esperado: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
  });
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

  try {
    if (!process.env.POSTGRES_URL) {
      throw new Error('Falta POSTGRES_URL');
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

      if (isCollection && process.env.CLOUDINARY_URL) {
        try {
          // Extraer el ID de la colección de la URL
          // Ejemplo: https://collection.cloudinary.com/nombre/ID_COLECCION
          const urlParts = item.url.split('/');
          const collectionId = urlParts[urlParts.length - 1];

          // Llamar a la API de Cloudinary para obtener los assets de la colección
          const cloudinaryData = await cloudinary.api.collection_assets(collectionId);
          
          if (cloudinaryData.resources) {
            cloudinaryData.resources.forEach(asset => {
              allPhotos.push({
                id: asset.public_id,
                url: asset.secure_url,
                carpeta: item.carpeta, // Mantenemos el nombre de carpeta definido en la DB
                nombre: asset.filename || asset.public_id.split('/').pop(),
                fecha: asset.created_at,
                formato: asset.format.toUpperCase(),
                size: (asset.bytes / 1024 / 1024).toFixed(2) + ' MB'
              });
            });
          }
        } catch (colError) {
          console.error(`Error expandiendo colección ${item.url}:`, colError);
          // Si falla la expansión, añadimos el item original como fallback (aunque sea una URL de página)
          allPhotos.push(item);
        }
      } else {
        // Es una URL directa o no tenemos API Key, la añadimos tal cual
        allPhotos.push({
          ...item,
          id: item.id || Math.random().toString(36).substr(2, 9)
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
