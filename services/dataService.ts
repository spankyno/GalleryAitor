
import { Photo } from '../types';

/**
 * CONFIGURACIÓN DE VARIABLES DE ENTORNO EN VERCEL:
 * 
 * 1. CLOUDINARY_CLOUD_NAME: (Desde el Dashboard de Cloudinary)
 * 2. CLOUDINARY_API_KEY: (Desde el Dashboard de Cloudinary)
 * 3. POSTGRES_URL: (Desde Vercel Storage o Neon Connection String)
 * 
 * NOTA: Para seguridad, las consultas a la base de datos y la generación de firmas 
 * de Cloudinary deben realizarse en una API Route (/api/photos) y no directamente 
 * desde el cliente para evitar exponer credenciales sensibles.
 */

// Datos de ejemplo para desarrollo local
const MOCK_PHOTOS: Photo[] = [
  { id: '1', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', carpeta: 'Paisajes', nombre: 'Valle Central.jpg', fecha: '2023-12-01', formato: 'JPG', size: '2.4MB' },
  { id: '2', url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80', carpeta: 'Paisajes', nombre: 'Lago Espejo.png', fecha: '2023-11-15', formato: 'PNG', size: '1.8MB' },
  { id: '3', url: 'https://images.unsplash.com/photo-1449156001446-d6c6956dd383?auto=format&fit=crop&w=1200&q=80', carpeta: 'Arquitectura', nombre: 'Cabaña Alpina.jpg', fecha: '2024-01-10', formato: 'JPG', size: '4.1MB' },
  { id: '4', url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80', carpeta: 'Viajes', nombre: 'Costa Azul.jpg', fecha: '2024-02-05', formato: 'JPG', size: '3.2MB' },
  { id: '5', url: 'https://images.unsplash.com/photo-1433086566236-1a0300305845?auto=format&fit=crop&w=1200&q=80', carpeta: 'Naturaleza', nombre: 'Cascada Velo.webp', fecha: '2023-10-22', formato: 'WEBP', size: '1.1MB' },
  { id: '6', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80', carpeta: 'Paisajes', nombre: 'Cumbres Nevadas.jpg', fecha: '2024-01-20', formato: 'JPG', size: '5.6MB' },
];

export const fetchPhotos = async (): Promise<Photo[]> => {
  try {
    // Cuando tengas tu API lista, el código sería algo como:
    // const response = await fetch('/api/photos');
    // if (!response.ok) throw new Error('Error al obtener datos');
    // return await response.json();

    // Por ahora, simulamos la carga de datos
    await new Promise(resolve => setTimeout(resolve, 1000));
    return MOCK_PHOTOS;
  } catch (err) {
    console.error('Error fetching gallery data:', err);
    return [];
  }
};

export const getFoldersFromPhotos = (photos: Photo[]): string[] => {
  const folders = Array.from(new Set(photos.map(p => p.carpeta)));
  return folders.sort();
};

export const downloadPhoto = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Error downloading image:', err);
    // Fallback abriendo en nueva pestaña si hay error de CORS
    window.open(url, '_blank');
  }
};
