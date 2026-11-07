import { useState, useEffect, useCallback, useMemo } from 'react';
import { VirtualFile, FolderNode, ClipboardState, ClipboardItem } from '../types';
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

    const map = new Map<string, FolderNode>();

    // Deduplikasi folder dengan nama dan parent yang sama agar sidebar selalu bersih tanpa duplikat
    const seenFolderKeys = new Set<string>();
    const uniqueFolders: typeof activeFolders = [];

    activeFolders.forEach((f) => {
      let resolvedParentId = normalizeFolderId(f.parentId, userId);
      if (resolvedParentId === f.id) {
        resolvedParentId = null;
      }

      const key = `${resolvedParentId || 'root'}:::${f.name.trim().toLowerCase()}`;
      if (!seenFolderKeys.has(key)) {
        seenFolderKeys.add(key);
        uniqueFolders.push(f);
      }
    });

    uniqueFolders.forEach((f) => {
      let resolvedParentId = normalizeFolderId(f.parentId, userId);
      if (resolvedParentId === f.id) {
        resolvedParentId = null;
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

    // Urutkan root folders: Hasil Scan di atas, lalu Hasil Konversi, Dokumen Saya, Arsip, lalu folder kustom root
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
      // Navigasi folder biasa dengan toleransi pencocokan ID server & lokal pada induk yang sama
      const targetFolder = normalizeFolderId(currentFolderId, userId);
      const currentFolderItem = currentFolderId ? await db.files.get(currentFolderId) : null;

      let matchingFolderIds: (string | null | undefined)[] = [targetFolder, currentFolderId];
      if (currentFolderItem && currentFolderItem.isFolder) {
        const currentParentNorm = normalizeFolderId(currentFolderItem.parentId, userId);
        const sameNameFolders = await db.files
          .filter(
            f =>
              !!f.isFolder &&
              f.name.trim().toLowerCase() === currentFolderItem.name.trim().toLowerCase() &&
              normalizeFolderId(f.parentId, userId) === currentParentNorm
          )
          .toArray();
        matchingFolderIds = [...new Set([targetFolder, currentFolderId, ...sameNameFolders.map(f => f.id)])];
      }

      result = await db.files
        .filter((f) => {
          if (f.isDeleted) return false;
          const pId = normalizeFolderId(f.parentId, userId);
          return matchingFolderIds.includes(pId) || matchingFolderIds.includes(f.parentId);
        })
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

      const serverFolderIds = new Set(serverFolders.map(sf => sf.id));

      // 1. Jika ada berkas lokal belum tersinkron (file-...) yang berada di dalam folder lokal sementara (folder-...),
      //    daftarkan dulu folder lokal tersebut ke MySQL agar berkas di dalamnya tidak menjadi yatim (orphan).
      const allLocalBeforeSync = await db.files.toArray();
      const unsyncedFiles = allLocalBeforeSync.filter(f => !f.isFolder && !f.isDeleted && f.id.startsWith('file-') && !!f.blob);
      const neededLocalFolderIds = new Set(unsyncedFiles.map(f => f.parentId).filter(Boolean) as string[]);

      for (const localFolderId of neededLocalFolderIds) {
        if (!serverFolderIds.has(localFolderId) && !isSystemRootFolder(localFolderId)) {
          const localFolder = allLocalBeforeSync.find(f => f.id === localFolderId && f.isFolder);
          if (localFolder) {
            try {
              const normParent = normalizeFolderId(localFolder.parentId, userId);
              const createdCloudFolder = await cloudFileService.createFolder(
                localFolder.name,
                normParent || undefined,
                localFolder.colorTag
              );
              if (createdCloudFolder && createdCloudFolder.id) {
                serverFolders.push(createdCloudFolder);
                serverFolderIds.add(createdCloudFolder.id);
                await db.files.where('parentId').equals(localFolder.id).modify({ parentId: createdCloudFolder.id });
                await db.files.delete(localFolder.id);
              }
            } catch (e) {
              console.warn('Gagal mendaftarkan folder lokal ke server:', e);
            }
          }
        }
      }

      // 2. Sinkronisasi folder dari server MySQL ke IndexedDB
      for (const sf of serverFolders) {
        const existing = await db.files.get(sf.id);
        const resolvedParentId = normalizeFolderId(sf.parent_id, userId);
        if (!existing) {
          await db.files.put({
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
        } else if (
          existing.parentId !== resolvedParentId ||
          existing.name !== sf.name ||
          existing.colorTag !== (sf.color || existing.colorTag)
        ) {
          await db.files.update(sf.id, {
            parentId: resolvedParentId,
            name: sf.name,
            colorTag: sf.color || existing.colorTag
          });
        }
      }

      // Hapus seluruh folder kustom lokal yang sudah dihapus di server agar tidak pernah muncul lagi
      const obsoleteLocalFolders = await db.files
        .filter(f => !!f.isFolder && !isSystemRootFolder(f.id) && !serverFolderIds.has(f.id))
        .toArray();
      if (obsoleteLocalFolders.length > 0) {
        await db.files.bulkDelete(obsoleteLocalFolders.map(f => f.id));
      }

      // Bersihkan & pindahkan folder bawaan generic lama yang tidak ber-suffix
      const genericFolders = ['folder-scan', 'folder-converted', 'folder-my-docs', 'folder-archive'];
      for (const gid of genericFolders) {
        const target = normalizeFolderId(gid, userId);
        if (target && target !== gid) {
          await db.files.where('parentId').equals(gid).modify({ parentId: target });
          await db.files.delete(gid);
        }
      }

      // 3. Sinkronisasi berkas dari server MySQL ke IndexedDB
      const serverFileIds = new Set(serverFiles.map(sf => sf.id));
      for (const sf of serverFiles) {
        const existing = await db.files.get(sf.id);
        const resolvedFolderId = normalizeFolderId(sf.folder_id, userId);
        if (!existing) {
          await db.files.put({
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
        } else {
          const updates: Partial<VirtualFile> = {};
          if (existing.parentId !== resolvedFolderId) updates.parentId = resolvedFolderId;
          if (existing.name !== sf.name) updates.name = sf.name;
          if (!existing.thumbnail && sf.thumbnail) updates.thumbnail = sf.thumbnail;
          const isFav = sf.is_starred === 1;
          const isDel = sf.is_trash === 1;
          if (existing.isFavorite !== isFav) updates.isFavorite = isFav;
          if (existing.isDeleted !== isDel) updates.isDeleted = isDel;
          if (Object.keys(updates).length > 0) {
            await db.files.update(sf.id, updates);
          }
        }
      }

      // Hapus berkas lokal (file_...) yang sudah dihapus permanen di server
      const obsoleteLocalFiles = await db.files
        .filter(f => !f.isFolder && !f.id.startsWith('file-') && !serverFileIds.has(f.id))
        .toArray();
      if (obsoleteLocalFiles.length > 0) {
        await db.files.bulkDelete(obsoleteLocalFiles.map(f => f.id));
      }

      // 4. Unggah otomatis berkas lokal sementara (file-...) ke database MySQL
      const serverFileKeys = new Set(
        serverFiles.map(sf => `${normalizeFolderId(sf.folder_id, userId) || 'root'}:::${sf.name.trim().toLowerCase()}`)
      );
      const unsyncedLocalFiles = await db.files
        .filter(f => !f.isFolder && !f.isDeleted && f.id.startsWith('file-') && !!f.blob)
        .toArray();

      for (const localFile of unsyncedLocalFiles) {
        const normParent = normalizeFolderId(localFile.parentId, userId);
        const fileKey = `${normParent || 'root'}:::${localFile.name.trim().toLowerCase()}`;
        if (serverFileKeys.has(fileKey)) {
          // Berkas sudah ada di server pada folder yang sama, hapus duplikat sementara lokal
          await db.files.delete(localFile.id);
          continue;
        }
        try {
          const uploaded = await cloudFileService.uploadFile(localFile.blob!, {
            name: localFile.name,
            folderId: normParent || undefined,
            ocrText: localFile.ocrText,
            thumbnail: localFile.thumbnail
          });
          if (uploaded && uploaded.id) {
            await db.files.delete(localFile.id);
            await db.files.put({
              ...localFile,
              id: uploaded.id,
              parentId: normalizeFolderId(uploaded.folder_id, userId) || normParent
            });
            serverFileKeys.add(fileKey);
          }
        } catch (upErr) {
          console.warn('Gagal mengunggah berkas lokal tertunda ke MySQL:', upErr);
        }
      }
    } catch (e) {
      console.warn('Gagal sinkronisasi dari cloud VPS:', e);
    }
  }, [userId, db, isSystemRootFolder]);

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
    const cleanName = name.trim() || 'Folder Baru';
    const finalColor = colorTag || '#3b82f6';

    // Cek apakah di database lokal sudah ada folder dengan nama yang sama di folder induk yang sama
    const existingLocal = await db.files
      .filter((f) => !!f.isFolder && !f.isDeleted && f.name.trim().toLowerCase() === cleanName.toLowerCase() && (f.parentId || null) === (finalParentId || null))
      .first();

    let folderId = existingLocal?.id || ('folder-' + now + '-' + Math.random().toString(36).substring(2, 6));

    // Kirim ke server jika login (dapatkan ID resmi dari server agar sinkron 100%)
    if (authService.getToken()) {
      try {
        const cloudFolder = await cloudFileService.createFolder(cleanName, finalParentId || undefined, finalColor);
        if (cloudFolder && cloudFolder.id) {
          folderId = cloudFolder.id;
          // Jika di lokal sebelumnya ada ID sementara yang berbeda, pindahkan isinya ke ID resmi server
          if (existingLocal && existingLocal.id !== folderId) {
            await db.files.where('parentId').equals(existingLocal.id).modify({ parentId: folderId });
            await db.files.delete(existingLocal.id);
          }
        }
      } catch (err) {
        console.warn('Gagal sync folder ke VPS:', err);
      }
    } else if (existingLocal) {
      return existingLocal;
    }

    const newFolder: VirtualFile = {
      id: folderId,
      name: cleanName,
      parentId: finalParentId,
      type: 'folder',
      isFolder: true,
      size: 0,
      createdAt: existingLocal?.createdAt || now,
      updatedAt: now,
      colorTag: finalColor
    };

    await db.files.put(newFolder);
    await refreshAll();
    return newFolder;
  };

  // Tambah file baru (dari scan atau converter)
  const addFile = async (
    file: Omit<VirtualFile, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { skipRefresh?: boolean }
  ) => {
    const now = Date.now();
    const rawParentId = file.parentId !== undefined ? file.parentId : currentFolderId;
    const finalParentId = normalizeFolderId(rawParentId, userId);

    let fileId = 'file-' + now + '-' + Math.random().toString(36).substring(2, 6);

    // Unggah ke VPS Cloud terlebih dahulu jika sedang login agar ID server sinkron
    if (authService.getToken() && file.blob) {
      try {
        const uploaded = await cloudFileService.uploadFile(file.blob, {
          name: file.name,
          folderId: finalParentId || undefined,
          ocrText: file.ocrText,
          thumbnail: file.thumbnail
        });
        if (uploaded && uploaded.id) {
          fileId = uploaded.id;
        }
      } catch (err) {
        console.warn('Gagal mengunggah file ke cloud VPS:', err);
      }
    }

    const newFile: VirtualFile = {
      ...file,
      id: fileId,
      parentId: finalParentId,
      createdAt: now,
      updatedAt: now
    };

    await db.files.put(newFile);
    if (!options?.skipRefresh) {
      await refreshAll();
    }
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

    // Cari seluruh subfolder, duplikat bernama sama pada induk yang sama, dan file di dalamnya secara rekursif di IndexedDB
    const allItems = await db.files.toArray();
    const deletedItem = allItems.find(f => f.id === id);
    const deletedParentNorm = deletedItem ? normalizeFolderId(deletedItem.parentId, userId) : null;
    const sameNameIds = deletedItem
      ? allItems
          .filter(
            f =>
              f.isFolder &&
              !isSystemRootFolder(f.id) &&
              f.name.trim().toLowerCase() === deletedItem.name.trim().toLowerCase() &&
              normalizeFolderId(f.parentId, userId) === deletedParentNorm
          )
          .map(f => f.id)
      : [];

    const folderIdsToDelete = Array.from(new Set([id, ...sameNameIds]));
    let queue = [...folderIdsToDelete];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = allItems.filter(f => f.isFolder && f.parentId === current);
      for (const child of children) {
        if (!folderIdsToDelete.includes(child.id)) {
          folderIdsToDelete.push(child.id);
          queue.push(child.id);
        }
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
        await cloudFileService.deleteFolder(id, deletedItem?.name);
      } catch (err) {
        console.warn('Gagal menghapus folder di cloud:', err);
      }
    }

    // Jika user sedang berada di folder yang dihapus, arahkan ke folder induk atau default
    if (currentFolderId && folderIdsToDelete.includes(currentFolderId)) {
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

  // Pindahkan berkas / folder ke folder tujuan (dengan proteksi hierarki)
  const moveFiles = async (ids: string[], targetFolderId: string | null) => {
    const finalTargetId = normalizeFolderId(targetFolderId, userId);

    for (const id of ids) {
      const item = await db.files.get(id);
      if (!item) continue;

      if (item.isFolder) {
        if (id === finalTargetId) continue;
        // Cek agar tidak memindahkan folder ke dalam anak subfoldernya sendiri
        let isDescendant = false;
        let cur = finalTargetId ? await db.files.get(finalTargetId) : null;
        while (cur) {
          if (cur.id === id) { isDescendant = true; break; }
          cur = cur.parentId ? await db.files.get(cur.parentId) : null;
        }
        if (isDescendant) continue;

        await db.files.update(id, { parentId: finalTargetId, updatedAt: Date.now() });
        if (authService.getToken()) {
          try {
            await cloudFileService.moveFolder(id, finalTargetId);
          } catch (e) {
            console.warn('Gagal memindahkan folder di cloud:', e);
          }
        }
      } else {
        await db.files.update(id, { parentId: finalTargetId, updatedAt: Date.now() });
        if (authService.getToken()) {
          try {
            await cloudFileService.updateFile(id, { folderId: finalTargetId || undefined });
          } catch (e) {}
        }
      }
    }

    setSelectedIds([]);
    await refreshAll();
  };

  // Pindahkan folder spesifik
  const moveFolder = async (folderId: string, targetFolderId: string | null) => {
    return moveFiles([folderId], targetFolderId);
  };

  // State Clipboard untuk Copy, Cut, Paste
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  const copyItems = useCallback(async (ids?: string[]) => {
    const targetIds = ids && ids.length > 0 ? ids : selectedIds;
    if (targetIds.length === 0) return;

    const items: ClipboardItem[] = [];
    for (const id of targetIds) {
      const f = await db.files.get(id);
      if (f && !f.isDeleted) {
        items.push({ id: f.id, name: f.name, isFolder: !!f.isFolder });
      }
    }

    if (items.length > 0) {
      setClipboard({ items, action: 'copy' });
    }
  }, [selectedIds, db]);

  const cutItems = useCallback(async (ids?: string[]) => {
    const targetIds = ids && ids.length > 0 ? ids : selectedIds;
    if (targetIds.length === 0) return;

    const items: ClipboardItem[] = [];
    for (const id of targetIds) {
      const f = await db.files.get(id);
      if (f && !f.isDeleted && !isSystemRootFolder(f.id)) {
        items.push({ id: f.id, name: f.name, isFolder: !!f.isFolder });
      }
    }

    if (items.length > 0) {
      setClipboard({ items, action: 'cut' });
    }
  }, [selectedIds, db, isSystemRootFolder]);

  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  const pasteItems = useCallback(async (targetFolderId?: string | null) => {
    if (!clipboard || clipboard.items.length === 0) return;

    const rawTarget = targetFolderId !== undefined ? targetFolderId : currentFolderId;
    const finalDestId = normalizeFolderId(rawTarget, userId);

    if (clipboard.action === 'cut') {
      const idsToMove = clipboard.items.map(i => i.id);
      await moveFiles(idsToMove, finalDestId);
      setClipboard(null);
      return;
    }

    if (clipboard.action === 'copy') {
      const copyFileToDest = async (origFile: VirtualFile, destId: string | null) => {
        const now = Date.now();
        const ext = origFile.name.includes('.') ? '.' + origFile.name.split('.').pop() : '';
        const base = ext ? origFile.name.slice(0, -ext.length) : origFile.name;
        const newName = destId === origFile.parentId ? `${base} - Salinan${ext}` : origFile.name;

        let newFileId = 'file-' + now + '-' + Math.random().toString(36).substring(2, 6);
        let fileBlob = origFile.blob;
        if (!fileBlob && authService.getToken()) {
          fileBlob = (await cloudFileService.fetchFileBlob(origFile.id)) || undefined;
        }

        if (authService.getToken() && fileBlob) {
          try {
            const uploaded = await cloudFileService.uploadFile(fileBlob, {
              name: newName,
              folderId: destId || undefined,
              ocrText: origFile.ocrText,
              thumbnail: origFile.thumbnail
            });
            if (uploaded?.id) newFileId = uploaded.id;
          } catch (e) {
            console.warn('Gagal salin file ke cloud:', e);
          }
        }

        const newFile: VirtualFile = {
          ...origFile,
          id: newFileId,
          name: newName,
          parentId: destId,
          blob: fileBlob,
          createdAt: now,
          updatedAt: now
        };
        await db.files.put(newFile);
      };

      const copyFolderRecursive = async (srcFolderId: string, destParentId: string | null) => {
        const srcFolder = await db.files.get(srcFolderId);
        if (!srcFolder) return;

        // Cegah salin ke diri sendiri
        if (destParentId === srcFolderId) return;

        const folderName = destParentId === srcFolder.parentId ? `${srcFolder.name} - Salinan` : srcFolder.name;
        const newFolder = await createFolder(folderName, destParentId, srcFolder.colorTag);

        const children = await db.files.filter(f => f.parentId === srcFolderId && !f.isDeleted).toArray();
        for (const child of children) {
          if (child.isFolder) {
            await copyFolderRecursive(child.id, newFolder.id);
          } else {
            await copyFileToDest(child, newFolder.id);
          }
        }
      };

      for (const item of clipboard.items) {
        if (item.isFolder) {
          await copyFolderRecursive(item.id, finalDestId);
        } else {
          const orig = await db.files.get(item.id);
          if (orig) {
            await copyFileToDest(orig, finalDestId);
          }
        }
      }

      await refreshAll();
    }
  }, [clipboard, currentFolderId, userId, moveFiles, createFolder, refreshAll, db]);

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
    moveFolder,
    clipboard,
    copyItems,
    cutItems,
    pasteItems,
    clearClipboard,
    toggleFavorite,
    setColorTag,
    deleteFiles,
    restoreFiles,
    emptyRecycleBin,
    refreshAll,
    syncWithCloud
  };
}
