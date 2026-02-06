import { Photo } from '../types';

export const fetchPhotos = async (): Promise<Photo[]> => {
  try {
    const response = await fetch('/api/gallery');
    const data = await response.json();

    if (!response.ok) {
      console.error('Error de API:', data.error || response.statusText);
      return [];
    }
    
    if (!Array.isArray(data)) {
      console.error('La API no devolvió un array:', data);
      return [];
    }
    
    return data.map((item: any) => ({
      id: item.id?.toString() || Math.random().toString(),
      url: item.url, 
      carpeta: item.carpeta || 'General',
      nombre: item.nombre || 'Imagen',
      fecha: item.fecha ? new Date(item.fecha).toLocaleDateString() : new Date().toLocaleDateString(),
      formato: item.formato || 'JPG',
      size: item.size || 'N/A'
    }));
  } catch (err) {
    console.error('Error de red o parseo:', err);
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
    const downloadUrl = url.includes('upload/') 
      ? url.replace('upload/', 'upload/fl_attachment/')
      : url;
      
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    window.open(url, '_blank');
  }
};