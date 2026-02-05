
import { Photo } from '../types';

export const fetchPhotos = async (): Promise<Photo[]> => {
  try {
    const response = await fetch('/api/gallery');
    
    if (response.ok) {
      const data = await response.json();
      console.log('Galería cargada con éxito:', data.length, 'fotos');
      
      return data.map((item: any) => ({
        id: item.id?.toString() || Math.random().toString(),
        url: item.url, 
        carpeta: item.carpeta || 'Sin Carpeta',
        nombre: item.nombre || (item.url ? item.url.split('/').pop().split('?')[0] : 'Imagen'),
        fecha: item.fecha ? new Date(item.fecha).toLocaleDateString() : new Date().toLocaleDateString(),
        formato: item.formato || 'JPG',
        size: item.size || 'N/A'
      }));
    } else {
      const errorText = await response.text();
      let errorData;
      try { errorData = JSON.parse(errorText); } catch(e) { errorData = { message: errorText }; }
      
      console.error('Fallo en la API /api/gallery:', response.status, errorData);
      return [];
    }
  } catch (err) {
    console.error('Error de red o conexión:', err);
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
    link.download = filename.includes('.') ? filename : `${filename}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Error al descargar:', err);
    window.open(url, '_blank');
  }
};
