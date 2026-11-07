import { useState, useEffect, useCallback } from 'react';
import { VirtualFile, FolderNode } from '../types';
import { db, initializeDefaultFolders } from '../services/db';
import { authService } from '../services/authService';
import { cloudFileService } from '../services/cloudFileService';

export function useFileSystem() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>('folder-scan');
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'details'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'updatedAt' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState<'folder' | 'recent' | 'favorites' | 'recycle_bin'>('folder');

  // History navigasi back / forward
  const [history, setHistory] = useState<(string | null)[]>(['folder-scan']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Muat folder tree
  const loadFolderTree = useCallback(async () => {
    const allFiles = await db.files.toArray();
    const activeFolders = allFiles.filter(f => !!f.isFolder && !f.isDeleted);

    const map = new Map<string, FolderNode>();
    activeFolders.forEach(f => {
      map.set(f.id, {
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        colorTag: f.colorTag,
        children: []
      });
    });

    const rootNodes: FolderNode[] = [];
    map.forEach(node => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children!.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    setFolderTree(rootNodes);
  }, []);

  // Muat files berdasarkan navigasi aktif
  const loadCurrentFiles = useCallback(async () => {
    let result: VirtualFile[] = [];

    if (activeNav === 'recent') {
      result = await db.files
        .filter(f => !f.isDeleted && !f.isFolder)
        .reverse()
        .sortBy('updatedAt');
      result = result.slice(0, 30);
    } else if (activeNav === 'favorites') {
      result = await db.files
        .filter(f => !f.isDeleted && !!f.isFavorite)
        .toArray();
    } else if (activeNav === 'recycle_bin') {
      result = await db.files
        .filter(f => !!f.isDeleted)
        .toArray();
    } else {
      // Navigasi folder biasa
      result = await db.files
        .filter(f => f.parentId === currentFolderId && !f.isDeleted)
        .toArray();
    }

    // Filter berdasarkan query pencarian jika ada
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.tags && f.tags.some(t => t.toLowerCase().includes(q))) ||
        (f.ocrText && f.ocrText.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      // Folder selalu di atas berkas
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB);
        return sortOrder === 'asc' ? comp : -comp;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFiles(result);
  }, [activeNav, currentFolderId, searchQuery, sortBy, sortOrder]);

  const refreshAll = useCallback(async () => {
    await loadFolderTree();
    await loadCurrentFiles();
  }, [loadFolderTree, loadCurrentFiles]);

  // Sinkronisasi data dari VPS Cloud jika pengguna sedang login
  const syncWithCloud = useCallback(async () => {
    if (!authService.getToken()) return;
    try {
      const { folders: serverFolders, files: serverFiles } = await cloudFileService.fetchFiles({ view: 'all' });

      for (const sf of serverFolders) {
        const existing = await db.files.get(sf.id);
        if (!existing) {
          await db.files.add({
            id: sf.id,
            name: sf.name,
            parentId: sf.parent_id || null,
            type: 'folder',
            isFolder: true,
            size: 0,
            createdAt: new Date(sf.created_at).getTime(),
            updatedAt: new Date(sf.created_at).getTime(),
            colorTag: sf.color || '#3b82f6'
          });
        }
      }

      for (const sf of serverFiles) {
        const existing = await db.files.get(sf.id);
        if (!existing) {
          await db.files.add({
            id: sf.id,
            name: sf.name,
            parentId: sf.folder_id || null,
            type: sf.type.includes('pdf') ? 'pdf' : 'jpg',
            isFolder: false,
            size: sf.size,
            thumbnail: sf.thumbnail || undefined,
            ocrText: sf.ocr_text || undefined,
            isFavorite: sf.is_starred === 1,
            isDeleted: sf.is_trash === 1,
            createdAt: new Date(sf.created_at).getTime(),
            updatedAt: new Date(sf.updated_at).getTime()
          });
        }
      }
    } catch (e) {
      console.warn('Gagal sinkronisasi dari cloud VPS:', e);
    }
  }, []);

  // Inisialisasi awal
  useEffect(() => {
    (async () => {
      await initializeDefaultFolders();
      await syncWithCloud();
      await refreshAll();
    })();
  }, [syncWithCloud, refreshAll]);

  useEffect(() => {
    loadCurrentFiles();
  }, [loadCurrentFiles]);

  // Handler navigasi folder
  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setActiveNav('folder');
    setSelectedIds([]);

    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(folderId);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const prevId = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCurrentFolderId(prevId);
      setActiveNav('folder');
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const nextId = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCurrentFolderId(nextId);
      setActiveNav('folder');
    }
  };

  const goUp = async () => {
    if (!currentFolderId) return;
    const current = await db.files.get(currentFolderId);
    if (current && current.parentId !== undefined) {
      navigateToFolder(current.parentId);
    }
  };

  // Buat folder baru
  const createFolder = async (name: string, targetParentId?: string | null, colorTag?: string): Promise<VirtualFile> => {
    const now = Date.now();
    const finalParentId = targetParentId !== undefined ? targetParentId : currentFolderId;
    const newFolder: VirtualFile = {
      id: 'folder-' + now + '-' + Math.random().toString(36).substring(2, 6),
      name: name.trim() || 'Folder Baru',
      parentId: finalParentId,
      type: 'folder',
      isFolder: true,
      size: 0,
      createdAt: now,
      updatedAt: now,
      colorTag: colorTag || '#3b82f6'
    };
    await db.files.add(newFolder);

    // Kirim ke server jika login
    if (authService.getToken()) {
      try {
        const cloudFolder = await cloudFileService.createFolder(newFolder.name, finalParentId || undefined, newFolder.colorTag);
        if (cloudFolder && cloudFolder.id) {
          await db.files.update(newFolder.id, { id: cloudFolder.id });
          newFolder.id = cloudFolder.id;
        }
      } catch (err) {
        console.warn('Gagal sync folder ke VPS:', err);
      }
    }

    await refreshAll();
    return newFolder;
  };

  // Tambah file baru (dari scan atau converter)
  const addFile = async (file: Omit<VirtualFile, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newFile: VirtualFile = {
      ...file,
      id: 'file-' + now + '-' + Math.random().toString(36).substring(2, 6),
      parentId: file.parentId !== undefined ? file.parentId : currentFolderId,
      createdAt: now,
      updatedAt: now
    };
    await db.files.add(newFile);

    // Unggah ke VPS Cloud jika sedang login
    if (authService.getToken() && file.blob) {
      try {
        const uploaded = await cloudFileService.uploadFile(file.blob, {
          name: file.name,
          folderId: newFile.parentId || undefined,
          ocrText: file.ocrText,
          thumbnail: file.thumbnail
        });
        if (uploaded && uploaded.id) {
          await db.files.update(newFile.id, { id: uploaded.id });
          newFile.id = uploaded.id;
        }
      } catch (err) {
        console.warn('Gagal mengunggah file ke cloud VPS:', err);
      }
    }

    await refreshAll();
    return newFile;
  };

  // Ganti nama file / folder
  const renameFile = async (id: string, newName: string) => {
    await db.files.update(id, { name: newName.trim(), updatedAt: Date.now() });
    if (authService.getToken()) {
      try {
        await cloudFileService.updateFile(id, { name: newName.trim() });
      } catch (e) {
        console.warn('Gagal rename di cloud:', e);
      }
    }
    await refreshAll();
  };

  // Toggle favorite
  const toggleFavorite = async (id: string) => {
    const file = await db.files.get(id);
    if (file) {
      const nextFav = !file.isFavorite;
      await db.files.update(id, { isFavorite: nextFav });
      if (authService.getToken()) {
        try {
          await cloudFileService.updateFile(id, { isStarred: nextFav });
        } catch (e) {}
      }
      await refreshAll();
    }
  };

  // Beri warna tag
  const setColorTag = async (id: string, colorTag: string | undefined) => {
    await db.files.update(id, { colorTag, updatedAt: Date.now() });
    await refreshAll();
  };

  // Pindahkan berkas / folder ke folder tujuan
  const moveFiles = async (ids: string[], targetFolderId: string | null) => {
    await db.files.where('id').anyOf(ids).modify({ parentId: targetFolderId, updatedAt: Date.now() });
    if (authService.getToken()) {
      for (const id of ids) {
        try {
          await cloudFileService.updateFile(id, { folderId: targetFolderId || undefined });
        } catch (e) {}
      }
    }
    setSelectedIds([]);
    await refreshAll();
  };

  // Pindahkan ke Recycle Bin (soft delete) atau Hapus permanen
  const deleteFiles = async (ids: string[], permanent: boolean = false) => {
    if (permanent || activeNav === 'recycle_bin') {
      await db.files.bulkDelete(ids);
      if (authService.getToken()) {
        for (const id of ids) {
          try {
            await cloudFileService.deleteFilePermanently(id);
          } catch (e) {}
        }
      }
    } else {
      await db.files.where('id').anyOf(ids).modify({ isDeleted: true, updatedAt: Date.now() });
      if (authService.getToken()) {
        for (const id of ids) {
          try {
            await cloudFileService.updateFile(id, { isTrash: true });
          } catch (e) {}
        }
      }
    }
    setSelectedIds([]);
    await refreshAll();
  };

  // Pulihkan dari Recycle Bin
  const restoreFiles = async (ids: string[]) => {
    await db.files.where('id').anyOf(ids).modify({ isDeleted: false, updatedAt: Date.now() });
    if (authService.getToken()) {
      for (const id of ids) {
        try {
          await cloudFileService.updateFile(id, { isTrash: false });
        } catch (e) {}
      }
    }
    setSelectedIds([]);
    await refreshAll();
  };

  // Kosongkan Recycle Bin
  const emptyRecycleBin = async () => {
    const deletedFiles = await db.files.filter(f => !!f.isDeleted).toArray();
    const ids = deletedFiles.map(f => f.id);
    await db.files.bulkDelete(ids);
    if (authService.getToken()) {
      try {
        await cloudFileService.emptyTrash();
      } catch (e) {}
    }
    await refreshAll();
  };

  return {
    currentFolderId,
    files,
    folderTree,
    selectedIds,
    setSelectedIds,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    activeNav,
    setActiveNav,
    navigateToFolder,
    goBack,
    goForward,
    goUp,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    canGoUp: !!currentFolderId,
    createFolder,
    addFile,
    renameFile,
    moveFiles,
    toggleFavorite,
    setColorTag,
    deleteFiles,
    restoreFiles,
    emptyRecycleBin,
    refreshAll,
    syncWithCloud
  };
}
