import Dexie, { type Table } from 'dexie';
import { VirtualFile } from '../types';

export class PDFkuDatabase extends Dexie {
  files!: Table<VirtualFile, string>;

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores({
      files: 'id, parentId, name, type, isFolder, isDeleted, isFavorite, createdAt, updatedAt'
    });
  }
}

// Cache database per ID pengguna untuk isolasi total
const dbInstances = new Map<string, PDFkuDatabase>();

export function getDatabaseForUser(userId?: number | string | null): PDFkuDatabase {
  const key = userId ? `PDFkuDB_User_${userId}` : 'PDFkuDB_Temp';
  if (!dbInstances.has(key)) {
    dbInstances.set(key, new PDFkuDatabase(key));
  }
  return dbInstances.get(key)!;
}

// Inisialisasi folder bawaan per pengguna (jika baru pertama kali dan offline)
export async function initializeUserDefaultFolders(db: PDFkuDatabase, userId?: number | string | null): Promise<void> {
  const uId = userId || 'default';
  const defaultFolders: VirtualFile[] = [
    {
      id: `folder-scan-${uId}`,
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
      id: `folder-conv-${uId}`,
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
      id: `folder-doc-${uId}`,
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
      id: `folder-arc-${uId}`,
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

export function normalizeFolderId(folderId: string | null | undefined, userId?: number | string | null): string | null {
  if (!folderId || typeof folderId !== 'string') return null;
  const trimmed = folderId.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed.startsWith('#')) return null;
  const uid = userId ? String(userId) : '';
  if (trimmed === 'folder-scan' || trimmed === `folder-scan-${uid}`) return uid ? `folder-scan-${uid}` : 'folder-scan';
  if (trimmed === 'folder-converted' || trimmed === 'folder-conv' || trimmed === `folder-conv-${uid}`) return uid ? `folder-conv-${uid}` : 'folder-conv';
  if (trimmed === 'folder-my-docs' || trimmed === 'folder-doc' || trimmed === `folder-doc-${uid}`) return uid ? `folder-doc-${uid}` : 'folder-doc';
  if (trimmed === 'folder-archive' || trimmed === 'folder-arc' || trimmed === `folder-arc-${uid}`) return uid ? `folder-arc-${uid}` : 'folder-arc';
  return trimmed;
}
