
import React from 'react';
import { ICONS } from '../constants';

interface SidebarProps {
  folders: string[];
  currentFolder: string | null;
  onSelectFolder: (folder: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ folders, currentFolder, onSelectFolder, isOpen, onClose }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed top-0 left-0 bottom-0 w-72 bg-[#0d0d0d] border-r border-white/5 z-50 transform transition-transform duration-300 ease-in-out
        lg:relative lg:transform-none lg:z-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent tracking-tight">
              CloudiGallery
            </h1>
            <button onClick={onClose} className="lg:hidden ml-auto p-1 text-gray-500 hover:text-white">
              <ICONS.X />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto pr-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 px-3">
              ÁLBUMES
            </p>
            
            <button
              onClick={() => { onSelectFolder(null); onClose(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                currentFolder === null ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ICONS.Grid className={`w-4 h-4 ${currentFolder === null ? 'text-indigo-400' : 'group-hover:text-white'}`} />
              Todas las fotos
            </button>

            {folders.map(folder => (
              <button
                key={folder}
                onClick={() => { onSelectFolder(folder); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  currentFolder === folder ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <ICONS.Folder className={`w-4 h-4 ${currentFolder === folder ? 'text-indigo-400' : 'group-hover:text-white'}`} />
                {folder}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/5">
            <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-gray-400 mb-1">Espacio usado</p>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-[45%]" />
              </div>
              <p className="text-[10px] text-gray-500 mt-2 text-right font-medium">1.2 GB de 10 GB</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
