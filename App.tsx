
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import PhotoCard from './components/PhotoCard';
import Lightbox from './components/Lightbox';
import { AppState, Photo, ViewMode } from './types';
import { fetchPhotos, getFoldersFromPhotos } from './services/dataService';
import { ICONS } from './constants';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    folders: [],
    currentFolder: null,
    photos: [],
    viewMode: 'grid',
    loading: true,
    searchQuery: '',
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const photos = await fetchPhotos();
        const folders = getFoldersFromPhotos(photos);
        setState(prev => ({
          ...prev,
          photos,
          folders,
          loading: false
        }));
      } catch (err) {
        console.error('Failed to load photos:', err);
        setState(prev => ({ ...prev, loading: false }));
      }
    };
    loadData();
  }, []);

  const filteredPhotos = useMemo(() => {
    return state.photos.filter(photo => {
      const matchesFolder = state.currentFolder ? photo.carpeta === state.currentFolder : true;
      const matchesSearch = photo.nombre.toLowerCase().includes(state.searchQuery.toLowerCase());
      return matchesFolder && matchesSearch;
    });
  }, [state.photos, state.currentFolder, state.searchQuery]);

  const handleOpenLightbox = (photo: Photo) => setSelectedPhoto(photo);
  const handleCloseLightbox = () => setSelectedPhoto(null);

  const navigateLightbox = (direction: 'next' | 'prev') => {
    if (!selectedPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % filteredPhotos.length;
    } else {
      nextIndex = (currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length;
    }
    setSelectedPhoto(filteredPhotos[nextIndex]);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        folders={state.folders}
        currentFolder={state.currentFolder}
        onSelectFolder={(folder) => setState(prev => ({ ...prev, currentFolder: folder }))}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-6 border-b border-white/5 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 lg:hidden text-gray-400 hover:text-white"
            >
              <ICONS.Menu />
            </button>
            
            <div className="relative group max-w-md w-full hidden sm:block">
              <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text"
                placeholder="Buscar por nombre..."
                value={state.searchQuery}
                onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="w-full bg-[#151515] border border-white/5 rounded-xl py-2.5 pl-12 pr-4 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#151515] rounded-xl border border-white/5 ml-4">
            <button 
              onClick={() => setState(prev => ({ ...prev, viewMode: 'grid' }))}
              className={`p-2 rounded-lg transition-all ${state.viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              title="Cuadrícula"
            >
              <ICONS.Grid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setState(prev => ({ ...prev, viewMode: 'mosaic' }))}
              className={`p-2 rounded-lg transition-all ${state.viewMode === 'mosaic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              title="Mosaico"
            >
              <ICONS.Layout className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setState(prev => ({ ...prev, viewMode: 'list' }))}
              className={`p-2 rounded-lg transition-all ${state.viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              title="Lista"
            >
              <ICONS.List className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 scroll-smooth">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {state.currentFolder || 'Todas las fotos'}
            </h2>
            <p className="text-gray-500 text-sm font-medium">
              {filteredPhotos.length} {filteredPhotos.length === 1 ? 'fotografía encontrada' : 'fotografías encontradas'}
            </p>
          </div>

          {state.loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 w-12 h-12 border-2 border-transparent border-b-indigo-400 rounded-full animate-spin delay-150"></div>
              </div>
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="p-6 bg-white/5 rounded-full mb-6">
                <ICONS.Folder className="w-12 h-12 text-gray-700" />
              </div>
              <p className="text-xl font-semibold text-gray-400">No se encontraron fotos</p>
              <p className="text-gray-500 mt-2">Intenta cambiar el álbum o el término de búsqueda.</p>
            </div>
          ) : (
            <div className={`
              ${state.viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : ''}
              ${state.viewMode === 'mosaic' ? 'mosaic-grid' : ''}
              ${state.viewMode === 'list' ? 'flex flex-col gap-3 max-w-4xl mx-auto' : ''}
            `}>
              {filteredPhotos.map(photo => (
                <PhotoCard 
                  key={photo.id} 
                  photo={photo} 
                  mode={state.viewMode} 
                  onOpen={handleOpenLightbox}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Lightbox 
        photo={selectedPhoto}
        onClose={handleCloseLightbox}
        onNext={() => navigateLightbox('next')}
        onPrev={() => navigateLightbox('prev')}
      />
    </div>
  );
};

export default App;
