
import { db } from '@vercel/postgres';

/**
 * Este archivo es una Vercel Serverless Function.
 * Se encarga de conectar con tu base de datos Vercel Postgres (Neon)
 * y devolver los registros de la tabla "Gallery".
 */
export default async function handler(request, response) {
  try {
    // Establecer conexión con la base de datos
    // Requiere que la variable POSTGRES_URL esté configurada en Vercel Settings
    const client = await db.connect();
    
    // Ejecutar la consulta SQL para obtener todas las fotos
    // Se ordena por ID descendente para ver las últimas primero
    const { rows } = await client.query('SELECT * FROM gallery ORDER BY id DESC');
    
    // Responder con los datos en formato JSON
    return response.status(200).json(rows);
  } catch (error) {
    // Manejo de errores detallado en la consola de Vercel
    console.error('Error en /api/gallery:', error);
    
    return response.status(500).json({ 
      error: 'Error al obtener los datos de la galería',
      message: error.message 
    });
  }
}
