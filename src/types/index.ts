export type FileType = 'pdf' | 'jpg' | 'png' | 'webp' | 'txt' | 'folder';

export type FilterType =
  | 'original'
  | 'lighten'
  | 'sharpen'
  | 'magic_color'
  | 'no_shadow'
  | 'bw'
  | 'grayscale';

export interface VirtualFile {
  id: string;
  name: string;
  parentId: string | null; // null = root
  type: FileType;
  isFolder: boolean;
  size: number; // in bytes
  createdAt: number;
  updatedAt: number;
  blob?: Blob; // binary data
  thumbnail?: string; // base64 or data URL for instant rendering
  pageCount?: number;
  tags?: string[];
  colorTag?: string; // e.g. '#ef4444', '#10b981', '#3b82f6'
  isFavorite?: boolean;
  isDeleted?: boolean; // in Recycle Bin
  ocrText?: string;
}

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  children?: FolderNode[];
  colorTag?: string;
}

export interface CropPoints {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

export interface FilterSettings {
  filter: FilterType;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  sharpness: number; // 0 to 100
  rotation: number; // 0, 90, 180, 270
}

export interface ScannedPage {
  id: string;
  originalImage: string; // base64 / blob URL
  warpedImage?: string;  // hasil perspektif rata sebelum filter (untuk Bandingkan & thumbnail filter)
  processedImage: string;
  cropPoints?: CropPoints;
  filters: FilterSettings;
  width: number;
  height: number;
}
