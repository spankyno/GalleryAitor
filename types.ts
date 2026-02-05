
export interface Photo {
  id: string;
  url: string;
  carpeta: string;
  nombre: string;
  fecha?: string;
  dimensiones?: string;
  formato?: string;
  size?: string;
}

export type ViewMode = 'grid' | 'mosaic' | 'list';

export interface AppState {
  folders: string[];
  currentFolder: string | null;
  photos: Photo[];
  viewMode: ViewMode;
  loading: boolean;
  searchQuery: string;
}
