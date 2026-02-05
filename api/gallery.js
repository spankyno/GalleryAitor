import { sql } from '@vercel/postgres';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Procesa la CLOUDINARY_URL eliminando caracteres < > y configurando el SDK.
 */
function configureCloudinary() {
  const rawUrl = process.env.CLOUDINARY_URL;
  if (!rawUrl) {
    console.error('CLOUDINARY_URL no está definida en las variables de entorno.');
    return false;
  }

  try {
    const cleanUrl = rawUrl.replace(/[<>]/g, '').trim();
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
    } else {
      console.error('El formato de CLOUDINARY_URL es inválido.');
    }
  } catch (err) {
    console.error('Error al configurar Cloudinary:', err);
  }
  return false;
}

const isConfigured = configureCloudinary();

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

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
      const isCollection = item.url.includes('collection.cloudinary.com');

      if (isCollection && isConfigured) {
        try {
          const urlParts = item.url.split('/');
          const collectionId = urlParts[urlParts.length - 1];

          // Usamos collection_assets del ADMIN API, no el Search API.
          const result = await cloudinary.api.collection_assets(collectionId, {
            max_results: 100
          });

          if (result && result.resources) {
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
          }
        } catch (error) {
          console.error(`Error procesando colección ${item.carpeta}:`, error.message);
          // Fallback: mostrar el item de la DB si falla la API
          allPhotos.push({
            ...item,
            id: `db-${item.id}`,
            nombre: `${item.nombre || item.carpeta} (Error API)`
          });
        }
      } else {
        allPhotos.push({
          ...item,
          id: item.id?.toString() || Math.random().toString(36).substr(2, 9),
          nombre: item.nombre || 'Imagen'
        });
      }
    }

    return response.status(200).json(allPhotos);

  } catch (error) {
    console.error('Error Crítico:', error);
    return response.status(500).json({ error: error.message });
  }
}