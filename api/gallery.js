
import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  // CORS y cabeceras de respuesta
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Content-Type', 'application/json');

  try {
    if (!process.env.POSTGRES_URL) {
      throw new Error('La variable POSTGRES_URL no está configurada.');
    }

    let result;
    try {
      // Intentamos con comillas dobles (case-sensitive)
      result = await sql`SELECT * FROM "Gallery" ORDER BY id DESC`;
    } catch (e) {
      // Si falla, intentamos sin comillas (estándar de Postgres)
      result = await sql`SELECT * FROM Gallery ORDER BY id DESC`;
    }

    return response.status(200).json(result.rows);

  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ 
      error: 'Error al conectar con la base de datos',
      message: error.message,
      hint: 'Asegúrate de haber conectado tu Base de Datos a este proyecto en el panel de Vercel.'
    });
  }
}
