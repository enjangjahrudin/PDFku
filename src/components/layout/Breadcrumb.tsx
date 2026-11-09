import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Search,
  X,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Menu,
  Edit2,
  Trash2,
  CornerDownRight,
  Scissors,
  Copy,
  Download
} from 'lucide-react';
import { FolderNode } from '../../types';

interface BreadcrumbProps {
  currentFolderId: string | null;
  folderTree: FolderNode[];
  onNavigate: (folderId: string | null) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeNav: string;
  onOpenMobileSidebar?: () => void;
  onNewFolder?: (parentId?: string | null, parentName?: string) => void;
  onDownloadFolderZip?: (id: string, name: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string, name: string) => void;
  onMoveFolder?: (id: string, name: string) => void;
  onCopyFolder?: (id: string, name: string) => void;
  onCutFolder?: (id: string, name: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  currentFolderId,
  folderTree,
  onNavigate,
  canGoBack,
  canGoForward,
  canGoUp,
  onGoBack,
  onGoForward,
  onGoUp,
  searchQuery,
  onSearchChange,
  activeNav,
  onOpenMobileSidebar,
  onNewFolder,
  onDownloadFolderZip,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onCopyFolder,
  onCutFolder
}) => {
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  // Close folder menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setIsFolderMenuOpen(false);
      }
    };
    if (isFolderMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isFolderMenuOpen]);

  // Cek apakah suatu folder adalah folder sistem bawaan yang tidak boleh dihapus/rename
  const isSystemFolder = (id: string | null): boolean => {
    if (!id) return true;
    const systemIds = [
      'system-root-scan',
      'system-root-convert',
      'system-root-documents',
      'system-root-archive'
    ];
    return systemIds.includes(id);
  };

  // Build the breadcrumb path from root to current folder
  const buildPath = (): { id: string | null; name: string }[] => {
    if (activeNav === 'recycle_bin') {
      return [{ id: null, name: 'Tempat Sampah (Recycle Bin)' }];
    }
    if (activeNav === 'favorites') {
      return [{ id: null, name: 'Favorit (Starred)' }];
    }
    if (activeNav === 'recent') {
      return [{ id: null, name: 'Terkini (Recent)' }];
    }

    if (!currentFolderId) {
      return [{ id: null, name: 'Home' }];
    }

    const findInTree = (
      nodes: FolderNode[],
      targetId: string,
      currentPath: { id: string | null; name: string }[]
    ): { id: string | null; name: string }[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return [...currentPath, { id: node.id, name: node.name }];
        }
        if (node.children && node.children.length > 0) {
          const found = findInTree(node.children, targetId, [
            ...currentPath,
            { id: node.id, name: node.name }
          ]);
          if (found) return found;
        }
      }
      return null;
    };

    const path = findInTree(folderTree, currentFolderId, []);
    return path ? [{ id: null, name: 'Home' }, ...path] : [{ id: null, name: 'Home' }];
  };

  const pathSegments = buildPath();

  return (
    <div className="h-10 bg-white border-b border-[#e5e5e5] px-2.5 sm:px-3 flex items-center justify-between space-x-2 select-none">
      {/* 1. Navigation Buttons: Mobile Drawer Menu + Back, Forward, Up */}
      <div className="flex items-center space-x-1 shrink-0">
        {onOpenMobileSidebar && (
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="md:hidden p-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition"
            title="Buka Menu Folder"
          >
            <Menu className="w-4 h-4 text-blue-600" />
          </button>
        )}

        <button
          type="button"
          disabled={!canGoBack}
          onClick={onGoBack}
          className={`p-1 rounded transition ${
            canGoBack ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Kembali (Alt + Panah Kiri)"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={!canGoForward}
          onClick={onGoForward}
          className={`p-1 rounded transition hidden sm:block ${
            canGoForward ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Maju (Alt + Panah Kanan)"
        >
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={!canGoUp}
          onClick={onGoUp}
          className={`p-1 rounded transition ${
            canGoUp ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Naik ke Folder Induk (Alt + Panah Atas)"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Breadcrumb Path Address Bar (Murni Jalur Folder Navigasi) */}
      <div className="flex-1 flex items-center bg-[#f9f9f9] border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 shadow-2xs min-w-0">
        <HardDrive className="w-3.5 h-3.5 text-blue-600 mr-1.5 shrink-0" />
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none whitespace-nowrap">
          {pathSegments.map((seg, idx) => {
            const isLastActiveFolder =
              idx === pathSegments.length - 1 && currentFolderId && activeNav === 'folder';

            return (
              <React.Fragment key={seg.id || idx}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}

                {isLastActiveFolder ? (
                  /* Segmen Folder Aktif Terakhir dengan Dropdown Menu Opsi Folder */
                  <div ref={folderMenuRef} className="relative inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => setIsFolderMenuOpen(!isFolderMenuOpen)}
                      className="hover:bg-blue-100/80 bg-blue-50/90 text-blue-900 border border-blue-200/90 px-2 py-0.5 rounded transition flex items-center space-x-1 font-medium shadow-2xs"
                      title="Klik untuk melihat opsi folder ini"
                    >
                      <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-semibold text-gray-900">{seg.name}</span>
                      <ChevronDown className="w-3 h-3 text-blue-700 ml-0.5" />
                    </button>

                    {/* Popover Menu Folder Aktif */}
                    {isFolderMenuOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-60 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1 truncate">
                          Folder: {seg.name}
                        </div>

                        {onNewFolder && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsFolderMenuOpen(false);
                              onNewFolder(currentFolderId, seg.name);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-gray-800 flex items-center space-x-2.5 transition"
                          >
                            <FolderPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-gray-900">+ Sub-folder Baru</div>
                              <div className="text-[10px] text-gray-500">Buat folder baru di dalam "{seg.name}"</div>
                            </div>
                          </button>
                        )}

                        {onDownloadFolderZip && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsFolderMenuOpen(false);
                              onDownloadFolderZip(currentFolderId, seg.name);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-gray-800 flex items-center space-x-2.5 transition"
                          >
                            <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-gray-900">Unduh Folder (.ZIP)</div>
                              <div className="text-[10px] text-gray-500">Unduh seluruh berkas folder ini</div>
                            </div>
                          </button>
                        )}

                        {!isSystemFolder(currentFolderId) && (
                          <>
                            <div className="border-t border-gray-100 my-1" />

                            {onMoveFolder && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsFolderMenuOpen(false);
                                  onMoveFolder(currentFolderId, seg.name);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-gray-700 flex items-center space-x-2.5 transition"
                              >
                                <CornerDownRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>Pindahkan Folder</span>
                              </button>
                            )}

                            {onCutFolder && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsFolderMenuOpen(false);
                                  onCutFolder(currentFolderId, seg.name);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-gray-700 flex items-center space-x-2.5 transition"
                              >
                                <Scissors className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                <span>Potong Folder (Cut)</span>
                              </button>
                            )}

                            {onCopyFolder && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsFolderMenuOpen(false);
                                  onCopyFolder(currentFolderId, seg.name);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-gray-700 flex items-center space-x-2.5 transition"
                              >
                                <Copy className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>Salin Folder (Copy)</span>
                              </button>
                            )}

                            {onRenameFolder && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsFolderMenuOpen(false);
                                  onRenameFolder(currentFolderId, seg.name);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-gray-700 flex items-center space-x-2.5 transition"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>Ganti Nama Folder</span>
                              </button>
                            )}

                            {onDeleteFolder && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsFolderMenuOpen(false);
                                  onDeleteFolder(currentFolderId, seg.name);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center space-x-2.5 transition border-t border-gray-100 font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span>Hapus Folder Ini</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Segmen Folder Induk Biasa */
                  <button
                    type="button"
                    onClick={() => onNavigate(seg.id)}
                    className="hover:bg-gray-200/80 px-1.5 py-0.5 rounded transition flex items-center space-x-1 font-normal hover:text-blue-600 text-gray-800"
                  >
                    {idx > 0 && <Folder className="w-3 h-3 text-amber-500 mr-1 inline shrink-0" />}
                    <span>{seg.name}</span>
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. Search Input Box */}
      <div className="relative w-36 sm:w-48 md:w-60 shrink-0">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari..."
          className="w-full bg-[#f9f9f9] border border-gray-200 rounded-md pl-7 pr-6 py-1 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};