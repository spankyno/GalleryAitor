
import { Photo } from '../types';

/**
 * CONFIGURACIÓN DE VARIABLES DE ENTORNO EN VERCEL:
 * 1. POSTGRES_URL: Obligatoria para que api/gallery.js funcione.
 */

export const fetchPhotos = async (): Promise<Photo[]> => {
  try {
    // Llamada a la API Route que acabamos de crear
    const response = await fetch('/api/gallery');
    
    if (response.ok) {
      const data = await response.json();
      
      // Mapeamos los campos de la base de datos al formato de la interfaz Photo
      // Usamos valores por defecto si algún campo opcional falta en la tabla
      return data.map((item: any) => ({
        id: item.id?.toString() || Math.random().toString(),
        url: item.url, // Campo "url" de tu tabla
        carpeta: item.carpeta || 'Sin Carpeta', // Campo "carpeta" de tu tabla
        nombre: item.nombre || (item.url ? item.url.split('/').pop() : 'Imagen'),
        fecha: item.fecha || new Date().toLocaleDateString(),
        formato: item.formato || 'JPG',
        size: item.size || 'N/A'
      }));
    } else {
      console.warn('La API respondió con error. Verificando configuración...');
      return [];
    }
  } catch (err) {
    console.error('Error al conectar con /api/gallery:', err);
    return [];
  }
};

export const getFoldersFromPhotos = (photos: Photo[]): string[] => {
  if (!photos || !Array.isArray(photos)) return [];
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
    console.error('Error al descargar:', err);
    // Fallback: abrir en pestaña nueva si hay restricciones de CORS
    window.open(url, '_blank');
  }
};
