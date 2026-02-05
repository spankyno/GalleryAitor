
import React from 'react';
import { Photo, ViewMode } from '../types';
import { ICONS } from '../constants';
import { downloadPhoto } from '../services/dataService';

interface PhotoCardProps {
  photo: Photo;
  mode: ViewMode;
  onOpen: (photo: Photo) => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, mode, onOpen }) => {
  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(photo.url);
    alert('URL copiada al portapapeles');
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadPhoto(photo.url, photo.nombre);
  };

  if (mode === 'list') {
    return (
      <div 
        onClick={() => onOpen(photo)}
        className="flex items-center gap-4 p-3 bg-[#151515] hover:bg-[#1f1f1f] rounded-lg transition-colors cursor-pointer group border border-white/5"
      >
        <img 
          src={photo.url} 
          alt={photo.nombre} 
          className="w-16 h-16 object-cover rounded shadow-lg"
        />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-white truncate max-w-[200px]">{photo.nombre}</h3>
          <p className="text-xs text-gray-400">{photo.fecha} • {photo.formato} • {photo.size}</p>
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={handleCopyUrl}
            className="p-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-full text-white transition-colors"
            title="Copiar URL"
          >
            <ICONS.Copy className="w-4 h-4" />
          </button>
          <button 
            onClick={handleDownload}
            className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-full text-white transition-colors"
            title="Descargar"
          >
            <ICONS.Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const isMosaic = mode === 'mosaic';

  return (
    <div 
      onClick={() => onOpen(photo)}
      className={`relative group cursor-pointer overflow-hidden rounded-xl border border-white/5 bg-[#111] transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/10 ${isMosaic ? 'mosaic-item' : 'aspect-square'}`}
    >
      <img 
        src={photo.url} 
        alt={photo.nombre} 
        className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110`}
        loading="lazy"
      />
      
      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <div className="flex justify-between items-center">
          <div className="flex-1 min-w-0 mr-2">
            <h3 className="text-sm font-semibold text-white truncate">{photo.nombre}</h3>
            <p className="text-xs text-gray-300">{photo.carpeta}</p>
          </div>
          <div className="flex gap-2">
             <button 
              onClick={handleCopyUrl}
              className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg text-white transition-colors border border-white/10"
              title="Copiar URL"
            >
              <ICONS.Copy className="w-4 h-4" />
            </button>
            <button 
              onClick={handleDownload}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white shadow-lg transition-colors"
              title="Descargar"
            >
              <ICONS.Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoCard;
