
import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  // Manejo de CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    // Verificación de conexión
    if (!process.env.POSTGRES_URL) {
      return response.status(500).json({ 
        error: 'Config Error', 
        message: 'No se encontró POSTGRES_URL. Asegúrate de conectar la DB en el panel de Vercel Storage.' 
      });
    }

    let result;
    try {
      // Intento 1: Tabla con mayúsculas (Case-sensitive)
      result = await sql`SELECT * FROM "Gallery" ORDER BY id DESC`;
    } catch (e) {
      console.warn('Fallo consulta a "Gallery", intentando "gallery"...');
      // Intento 2: Tabla en minúsculas (Estándar Postgres)
      result = await sql`SELECT * FROM gallery ORDER BY id DESC`;
    }

    return response.status(200).json(result.rows);

  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ 
      error: 'Error de Base de Datos',
      message: error.message,
      code: error.code
    });
  }
}
