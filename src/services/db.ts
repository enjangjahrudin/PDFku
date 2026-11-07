import Dexie, { type Table } from 'dexie';
import { VirtualFile } from '../types';

export class SmartDocDatabase extends Dexie {
  files!: Table<VirtualFile, string>;

  constructor() {
    super('SmartDocDB');
    this.version(1).stores({
      files: 'id, parentId, name, type, isFolder, isDeleted, isFavorite, createdAt, updatedAt'
    });
  }
}

export const db = new SmartDocDatabase();

// Inisialisasi folder bawaan (Pastikan selalu ada di database)
export async function initializeDefaultFolders(): Promise<void> {
  const defaultFolders: VirtualFile[] = [
    {
      id: 'folder-scan',
      name: 'Hasil Scan',
      parentId: null,
      type: 'folder',
      isFolder: true,
      size: 0,
      createdAt: 1000,
      updatedAt: 1000,
      colorTag: '#3b82f6'
    },
    {
      id: 'folder-converted',
      name: 'Hasil Konversi',
      parentId: null,
      type: 'folder',
      isFolder: true,
      size: 0,
      createdAt: 2000,
      updatedAt: 2000,
      colorTag: '#10b981'
    },
    {
      id: 'folder-my-docs',
      name: 'Dokumen Saya',
      parentId: null,
      type: 'folder',
      isFolder: true,
      size: 0,
      createdAt: 3000,
      updatedAt: 3000,
      colorTag: '#f59e0b'
    },
    {
      id: 'folder-archive',
      name: 'Arsip Dokumen',
      parentId: null,
      type: 'folder',
      isFolder: true,
      size: 0,
      createdAt: 4000,
      updatedAt: 4000,
      colorTag: '#8b5cf6'
    }
  ];

  for (const folder of defaultFolders) {
    const existing = await db.files.get(folder.id);
    if (!existing) {
      await db.files.put(folder);
    }
  }
}
