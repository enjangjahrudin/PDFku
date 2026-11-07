import { useState, useEffect, useCallback, useMemo } from 'react';
import { VirtualFile, FolderNode } from '../types';
import { getDatabaseForUser, initializeUserDefaultFolders, normalizeFolderId } from '../services/db';
import { authService } from '../services/authService';
import { cloudFileService } from '../services/cloudFileService';
import { useAuth } from '../context/AuthContext';

export function useFileSystem() {
  const { user } = useAuth();
  const userId = user?.id;

  // Database IndexedDB terisolasi 100% per akun
  const db = useMemo(() => getDatabaseForUser(userId), [userId]);

  const defaultFolderId = normalizeFolderId('folder-scan', userId) || 'folder-scan';

  const isSystemRootFolder = useCallback((id: string | null) => {
    if (!id) return true;
    const defaultScanId = normalizeFolderId('folder-scan', userId);
    const defaultConvId = normalizeFolderId('folder-converted', userId);
    const defaultDocId = normalizeFolderId('folder-my-docs', userId);
    const defaultArcId = normalizeFolderId('folder-archive', userId);
    return (
      id === defaultScanId ||
      id === defaultConvId ||
      id === defaultDocId ||
      id === defaultArcId ||
      id === 'folder-scan' ||
      id === 'folder-converted' ||
      id === 'folder-my-docs' ||
      id === 'folder-archive' ||
      id.startsWith('folder-scan-') ||
      id.startsWith('folder-conv-') ||
      id.startsWith('folder-doc-') ||
      id.startsWith('folder-arc-')
    );
  }, [userId]);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(defaultFolderId);
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'details'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'updatedAt' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState<'folder' | 'recent' | 'favorites' | 'recycle_bin'>('folder');

  // History navigasi back / forward
  const [history, setHistory] = useState<(string | null)[]>([defaultFolderId]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Muat folder tree
  const loadFolderTree = useCallback(async () => {
    const allFiles = await db.files.toArray();
    const activeFolders = allFiles.filter((f) => !!f.isFolder && !f.isDeleted);

    const defaultScanId = normalizeFolderId('folder-scan', userId);
    const defaultConvId = normalizeFolderId('folder-converted', userId);
    const defaultDocId = normalizeFolderId('folder-my-docs', userId);
    const defaultArcId = normalizeFolderId('folder-archive', userId);

    const isSystemRoot = (id: string) =>
      id === defaultScanId || id === defaultConvId || id === defaultDocId || id === defaultArcId ||
      id === 'folder-scan' || id === 'folder-converted' || id === 'folder-my-docs' || id === 'folder-archive' ||
      id.startsWith('folder-scan-') || id.startsWith('folder-conv-') || id.startsWith('folder-doc-') || id.startsWith('folder-arc-');

    const map = new Map<string, FolderNode>();

    activeFolders.forEach((f) => {
      let resolvedParentId = normalizeFolderId(f.parentId, userId);

      // Jika bukan folder root bawaan, pastikan memiliki induk (tidak sejajar di root)
      if (!isSystemRoot(f.id) && (!resolvedParentId || resolvedParentId === f.id)) {
        if (f.colorTag === '#10b981') {
          resolvedParentId = defaultConvId; // Masuk ke subfolder Hasil Konversi
        } else {
          resolvedParentId = defaultScanId; // Masuk ke subfolder Hasil Scan
        }

        // Perbarui di database
        db.files.update(f.id, { parentId: resolvedParentId }).catch(() => {});
        if (authService.getToken()) {
          cloudFileService.updateFile(f.id, { folderId: resolvedParentId || undefined }).catch(() => {});
        }
      }

      map.set(f.id, {
        id: f.id,
        name: f.name,
        parentId: resolvedParentId,
        colorTag: f.colorTag,
        children: []
      });
    });

    const rootNodes: FolderNode[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId) && node.parentId !== node.id) {
        map.get(node.parentId)!.children!.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Urutkan root folders: Hasil Scan di atas, lalu Hasil Konversi, Dokumen Saya, Arsip
    rootNodes.sort((a, b) => {
      const order = [defaultScanId, defaultConvId, defaultDocId, defaultArcId];
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    setFolderTree(rootNodes);
  }, [db, userId]);

  // Muat files berdasarkan navigasi aktif
  const loadCurrentFiles = useCallback(async () => {
    let result: VirtualFile[] = [];

    if (activeNav === 'recent') {
      result = await db.files
        .filter((f) => !f.isDeleted && !f.isFolder)
        .reverse()
        .sortBy('updatedAt');
      result = result.slice(0, 30);
    } else if (activeNav === 'favorites') {
      result = await db.files
        .filter((f) => !f.isDeleted && !!f.isFavorite)
        .toArray();
    } else if (activeNav === 'recycle_bin') {
      result = await db.files
        .filter((f) => !!f.isDeleted)
        .toArray();
    } else {
      // Navigasi folder biasa dengan normalisasi folder target
      const targetFolder = normalizeFolderId(currentFolderId, userId);
      result = await db.files
        .filter((f) => normalizeFolderId(f.parentId, userId) === targetFolder && !f.isDeleted)
        .toArray();
    }

    // Filter berdasarkan query pencarian jika ada
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.tags && f.tags.some((t) => t.toLowerCase().includes(q))) ||
          (f.ocrText && f.ocrText.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
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
  }, [db, userId, activeNav, currentFolderId, searchQuery, sortBy, sortOrder]);

  const refreshAll = useCallback(async () => {
    await loadFolderTree();
    await loadCurrentFiles();
  }, [loadFolderTree, loadCurrentFiles]);

  // Sinkronisasi data dari VPS Cloud khusus untuk akun user ini
  const syncWithCloud = useCallback(async () => {
    if (!authService.getToken() || !userId) return;
    try {
      const { folders: serverFolders, files: serverFiles } = await cloudFileService.fetchFiles({ view: 'all' });

      // Sinkronisasi folder server ke database lokal akun ini
      for (const sf of serverFolders) {
        const existing = await db.files.get(sf.id);
        const resolvedParentId = normalizeFolderId(sf.parent_id, userId);
        if (!existing) {
          await db.files.add({
            id: sf.id,
            name: sf.name,
            parentId: resolvedParentId,
            type: 'folder',
            isFolder: true,
            size: 0,
            createdAt: new Date(sf.created_at).getTime(),
            updatedAt: new Date(sf.created_at).getTime(),
            colorTag: sf.color || '#3b82f6'
          });
        } else if (existing.parentId !== resolvedParentId) {
          await db.files.update(sf.id, { parentId: resolvedParentId });
        }
      }

      // Bersihkan & pindahkan folder bawaan generic lama yang tidak ber-suffix
      const genericFolders = ['folder-scan', 'folder-converted', 'folder-my-docs', 'folder-archive'];
      for (const gid of genericFolders) {
        const target = normalizeFolderId(gid, userId);
        if (target && target !== gid) {
          // Pindahkan sub-folder dan berkas yang mengarah ke generic ID
          await db.files.where('parentId').equals(gid).modify({ parentId: target });
          // Hapus generic folder agar tidak duplikat di sidebar
          await db.files.delete(gid);
        }
      }

      // Sinkronisasi file server ke database lokal akun ini
      for (const sf of serverFiles) {
        const existing = await db.files.get(sf.id);
        const resolvedFolderId = normalizeFolderId(sf.folder_id, userId);
        if (!existing) {
          await db.files.add({
            id: sf.id,
            name: sf.name,
            parentId: resolvedFolderId,
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
        } else if (existing.parentId !== resolvedFolderId) {
          await db.files.update(sf.id, { parentId: resolvedFolderId });
        }
      }
    } catch (e) {
      console.warn('Gagal sinkronisasi dari cloud VPS:', e);
    }
  }, [userId, db]);

  // Ketika akun user berubah (login / ganti akun), inisialisasi ulang storage
  useEffect(() => {
    let isMounted = true;
    const initialFolder = normalizeFolderId('folder-scan', userId) || 'folder-scan';
    setCurrentFolderId(initialFolder);
    setHistory([initialFolder]);
    setHistoryIndex(0);
    setSelectedIds([]);

    (async () => {
      await initializeUserDefaultFolders(db, userId);
      if (authService.getToken() && userId) {
        await syncWithCloud();
      }
      if (isMounted) {
        await loadFolderTree();
        await loadCurrentFiles();
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    loadCurrentFiles();
  }, [loadCurrentFiles]);

  // Handler navigasi folder
  const navigateToFolder = (folderId: string | null) => {
    const resolvedId = normalizeFolderId(folderId, userId);
    setCurrentFolderId(resolvedId);
    setActiveNav('folder');
    setSelectedIds([]);

    setHistory((prev) => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      nextHistory.push(resolvedId);
      return nextHistory;
    });
    setHistoryIndex((prev) => prev + 1);
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
    const rawParentId = targetParentId !== undefined ? targetParentId : currentFolderId;
    const finalParentId = normalizeFolderId(rawParentId, userId);

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
    const rawParentId = file.parentId !== undefined ? file.parentId : currentFolderId;
    const finalParentId = normalizeFolderId(rawParentId, userId);

    const newFile: VirtualFile = {
      ...file,
      id: 'file-' + now + '-' + Math.random().toString(36).substring(2, 6),
      parentId: finalParentId,
      createdAt: now,
      updatedAt: now
    };
    await db.files.add(newFile);

    // Unggah ke VPS Cloud jika sedang login
    if (authService.getToken() && file.blob) {
      try {
        const uploaded = await cloudFileService.uploadFile(file.blob, {
          name: file.name,
          folderId: finalParentId || undefined,
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

  // Ganti nama folder
  const renameFolder = async (id: string, newName: string) => {
    if (isSystemRootFolder(id)) {
      alert('Folder sistem bawaan tidak dapat diubah namanya.');
      return;
    }
    const cleanName = newName.trim();
    if (!cleanName) return;

    await db.files.update(id, { name: cleanName, updatedAt: Date.now() });
    if (authService.getToken()) {
      try {
        await cloudFileService.renameFolder(id, cleanName);
      } catch (e) {
        console.warn('Gagal rename folder di cloud:', e);
      }
    }
    await refreshAll();
  };

  // Hapus folder beserta isinya
  const deleteFolder = async (id: string) => {
    if (isSystemRootFolder(id)) {
      alert('Folder sistem bawaan tidak dapat dihapus.');
      return;
    }

    // Cari seluruh subfolder dan file di dalamnya secara rekursif di IndexedDB
    const allItems = await db.files.toArray();
    const folderIdsToDelete = [id];
    let queue = [id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = allItems.filter(f => f.isFolder && f.parentId === current);
      for (const child of children) {
        folderIdsToDelete.push(child.id);
        queue.push(child.id);
      }
    }

    const fileIdsToDelete = allItems
      .filter(f => !f.isFolder && f.parentId && folderIdsToDelete.includes(f.parentId))
      .map(f => f.id);

    // Hapus dari IndexedDB
    await db.files.bulkDelete([...folderIdsToDelete, ...fileIdsToDelete]);

    // Hapus dari VPS Cloud jika login
    if (authService.getToken()) {
      try {
        await cloudFileService.deleteFolder(id);
      } catch (err) {
        console.warn('Gagal menghapus folder di cloud:', err);
      }
    }

    // Jika user sedang berada di folder yang dihapus, arahkan ke folder induk atau default
    if (currentFolderId && folderIdsToDelete.includes(currentFolderId)) {
      const deletedItem = allItems.find(f => f.id === id);
      const parentTarget = deletedItem?.parentId ? normalizeFolderId(deletedItem.parentId, userId) : normalizeFolderId('folder-scan', userId);
      setCurrentFolderId(parentTarget || null);
    }

    setSelectedIds(prev => prev.filter(selectedId => !folderIdsToDelete.includes(selectedId) && !fileIdsToDelete.includes(selectedId)));
    await refreshAll();
  };

  // Ganti nama file / folder
  const renameFile = async (id: string, newName: string) => {
    const item = await db.files.get(id);
    if (item && item.isFolder) {
      await renameFolder(id, newName);
      return;
    }

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
    const finalTargetId = normalizeFolderId(targetFolderId, userId);
    await db.files.where('id').anyOf(ids).modify({ parentId: finalTargetId, updatedAt: Date.now() });
    if (authService.getToken()) {
      for (const id of ids) {
        try {
          await cloudFileService.updateFile(id, { folderId: finalTargetId || undefined });
        } catch (e) {}
      }
    }
    setSelectedIds([]);
    await refreshAll();
  };

  // Pindahkan ke Recycle Bin (soft delete) atau Hapus permanen
  const deleteFiles = async (ids: string[], permanent: boolean = false) => {
    const regularFileIds: string[] = [];

    for (const id of ids) {
      const item = await db.files.get(id);
      if (item && item.isFolder) {
        await deleteFolder(id);
      } else {
        regularFileIds.push(id);
      }
    }

    if (regularFileIds.length > 0) {
      if (permanent || activeNav === 'recycle_bin') {
        await db.files.bulkDelete(regularFileIds);
        if (authService.getToken()) {
          for (const id of regularFileIds) {
            try {
              await cloudFileService.deleteFilePermanently(id);
            } catch (e) {}
          }
        }
      } else {
        await db.files.where('id').anyOf(regularFileIds).modify({ isDeleted: true, updatedAt: Date.now() });
        if (authService.getToken()) {
          for (const id of regularFileIds) {
            try {
              await cloudFileService.updateFile(id, { isTrash: true });
            } catch (e) {}
          }
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
    const deletedFiles = await db.files.filter((f) => !!f.isDeleted).toArray();
    const ids = deletedFiles.map((f) => f.id);
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
    renameFolder,
    deleteFolder,
    isSystemRootFolder,
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
