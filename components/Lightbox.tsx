
import React, { useEffect, useState } from 'react';
import { Photo } from '../types';
import { ICONS } from '../constants';
import { downloadPhoto } from '../services/dataService';

interface LightboxProps {
  photo: Photo | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ photo, onClose, onNext, onPrev }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (photo) {
      setIsVisible(true);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight') onNext();
        if (e.key === 'ArrowLeft') onPrev();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    } else {
      setIsVisible(false);
    }
  }, [photo, onClose, onNext, onPrev]);

  if (!photo) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-300 bg-black/95 backdrop-blur-xl ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* Header Actions */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-[110]">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-white">{photo.nombre}</h2>
          <p className="text-sm text-gray-400">{photo.carpeta}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => downloadPhoto(photo.url, photo.nombre)}
            className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors border border-white/10"
          >
            <ICONS.Download className="w-5 h-5" />
          </button>
          <button 
            onClick={onClose}
            className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors border border-white/10"
          >
            <ICONS.X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="relative w-full h-full flex items-center justify-center p-4 lg:p-12 select-none">
        <button 
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-6 lg:left-12 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 hover:scale-110 active:scale-95 z-[120]"
        >
          <ICONS.ChevronLeft className="w-8 h-8" />
        </button>

        <div className="max-w-full max-h-full flex items-center justify-center transition-all duration-500 transform">
          <img 
            src={photo.url} 
            alt={photo.nombre} 
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl shadow-indigo-500/10 ring-1 ring-white/10"
          />
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-6 lg:right-12 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 hover:scale-110 active:scale-95 z-[120]"
        >
          <ICONS.ChevronRight className="w-8 h-8" />
        </button>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center z-[110]">
        <div className="flex gap-8 text-xs font-medium text-gray-400 bg-white/5 backdrop-blur-md py-3 px-8 rounded-full border border-white/10">
          <span>{photo.formato}</span>
          <span className="w-px h-4 bg-white/10" />
          <span>{photo.size}</span>
          <span className="w-px h-4 bg-white/10" />
          <span>{photo.fecha}</span>
        </div>
      </div>
    </div>
  );
};

export default Lightbox;
