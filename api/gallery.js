
import { sql } from '@vercel/postgres';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Procesa la CLOUDINARY_URL para limpiar posibles caracteres < > 
 * que el usuario haya incluido por error en las variables de entorno.
 */
function initializeCloudinary() {
  const rawUrl = process.env.CLOUDINARY_URL;
  if (!rawUrl) return false;

  try {
    // Eliminamos los brackets < > y espacios en blanco
    const cleanUrl = rawUrl.replace(/[<>]/g, '').trim();
    
    // El formato esperado es cloudinary://API_KEY:API_SECRET@CLOUD_NAME
    const regex = /cloudinary:\/\/([^:]+):([^@]+)@(.+)/;
    const match = cleanUrl.match(regex);

    if (match) {
      cloudinary.config({
        api_key: match[1],
        api_secret: match[2],
        cloud_name: match[3],
        secure: true
      });
      return true;
    }
  } catch (err) {
    console.error('Error parseando CLOUDINARY_URL:', err);
  }
  return false;
}

const isCloudinaryConfigured = initializeCloudinary();

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

  try {
    if (!process.env.POSTGRES_URL) {
      throw new Error('Falta la variable de entorno POSTGRES_URL');
    }

    let dbResult;
    try {
      dbResult = await sql`SELECT * FROM "Gallery" ORDER BY id ASC`;
    } catch (e) {
      dbResult = await sql`SELECT * FROM Gallery ORDER BY id ASC`;
    }

    const allPhotos = [];

    for (const item of dbResult.rows) {
      const isCollection = item.url.includes('collection.cloudinary.com');

      if (isCollection && isCloudinaryConfigured) {
        try {
          const urlParts = item.url.split('/');
          const collectionId = urlParts[urlParts.length - 1];

          // El Search API requiere que los assets estén indexados
          const result = await cloudinary.search
            .expression(`collection_id:${collectionId}`)
            .sort_by('created_at', 'desc')
            .max_results(100)
            .execute();

          if (result && result.resources && result.resources.length > 0) {
            result.resources.forEach(asset => {
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
            // Si no hay resultados en el search, mantenemos el registro de la DB como placeholder
            allPhotos.push({
              ...item,
              id: `empty-${item.id}`,
              nombre: `${item.carpeta} (Sin archivos encontrados)`
            });
          }
        } catch (colError) {
          console.error(`Fallo en Search API para ${item.url}:`, colError.message || colError);
          allPhotos.push({
            ...item,
            id: `err-${item.id}`,
            nombre: `Error de conexión: ${colError.http_code || 'Cloudinary'}`
          });
        }
      } else {
        // Entrada normal (URL directa)
        allPhotos.push({
          ...item,
          id: item.id?.toString() || Math.random().toString(36).substr(2, 9),
          nombre: item.nombre || 'Imagen'
        });
      }
    }

    return response.status(200).json(allPhotos);

  } catch (error) {
    console.error('Error Crítico API:', error);
    return response.status(500).json({ error: error.message });
  }
}
