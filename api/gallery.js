
import { db } from '@vercel/postgres';

export default async function handler(request, response) {
  // Configuración de cabeceras para evitar problemas de caché y CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Content-Type', 'application/json');

  try {
    // 1. Verificar variables de entorno
    if (!process.env.POSTGRES_URL) {
      return response.status(500).json({ 
        error: 'Configuración incompleta', 
        message: 'No se encontró la variable POSTGRES_URL en Vercel.' 
      });
    }

    const client = await db.connect();
    
    let result;
    try {
      // Intentamos con comillas dobles por si la tabla se creó respetando mayúsculas
      result = await client.query('SELECT * FROM "Gallery" ORDER BY id DESC');
    } catch (e) {
      console.log('Fallo con "Gallery" (mayúsculas), probando con gallery (minúsculas)...');
      // Si falla, intentamos en minúsculas (comportamiento estándar de Postgres)
      result = await client.query('SELECT * FROM gallery ORDER BY id DESC');
    }

    return response.status(200).json(result.rows);

  } catch (error) {
    console.error('Error crítico en la función gallery.js:', error);
    
    return response.status(500).json({ 
      error: 'Error de ejecución en el servidor',
      message: error.message,
      code: error.code,
      hint: 'Revisa si la tabla existe en tu base de datos y si el nombre es correcto.'
    });
  }
}
