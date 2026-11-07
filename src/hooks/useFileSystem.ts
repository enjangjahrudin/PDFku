import { useState, useEffect, useCallback } from 'react';
import { VirtualFile, FolderNode } from '../types';
import { db, initializeDefaultFolders } from '../services/db';

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

  // Inisialisasi awal
  useEffect(() => {
    (async () => {
      await initializeDefaultFolders();
      await refreshAll();
    })();
  }, []);

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

  useEffect(() => {
    loadCurrentFiles();
  }, [loadCurrentFiles]);

  // Navigasi ke folder
  const navigateToFolder = (folderId: string | null) => {
    setActiveNav('folder');
    setCurrentFolderId(folderId);
    setSelectedIds([]);
    setSearchQuery('');

    // Tambah ke history
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
    await refreshAll();
    return newFile;
  };

  // Ganti nama file / folder
  const renameFile = async (id: string, newName: string) => {
    await db.files.update(id, { name: newName.trim(), updatedAt: Date.now() });
    await refreshAll();
  };

  // Toggle favorite
  const toggleFavorite = async (id: string) => {
    const file = await db.files.get(id);
    if (file) {
      await db.files.update(id, { isFavorite: !file.isFavorite });
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
    setSelectedIds([]);
    await refreshAll();
  };

  // Pindahkan ke Recycle Bin (soft delete) atau Hapus permanen
  const deleteFiles = async (ids: string[], permanent: boolean = false) => {
    if (permanent || activeNav === 'recycle_bin') {
      await db.files.bulkDelete(ids);
    } else {
      await db.files.where('id').anyOf(ids).modify({ isDeleted: true, updatedAt: Date.now() });
    }
    setSelectedIds([]);
    await refreshAll();
  };

  // Pulihkan dari Recycle Bin
  const restoreFiles = async (ids: string[]) => {
    await db.files.where('id').anyOf(ids).modify({ isDeleted: false, updatedAt: Date.now() });
    setSelectedIds([]);
    await refreshAll();
  };

  // Kosongkan Recycle Bin
  const emptyRecycleBin = async () => {
    const deletedFiles = await db.files.filter(f => !!f.isDeleted).toArray();
    const ids = deletedFiles.map(f => f.id);
    await db.files.bulkDelete(ids);
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
    refreshAll
  };
}
