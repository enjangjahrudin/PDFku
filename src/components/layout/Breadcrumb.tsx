import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Search,
  X,
  Folder,
  ChevronRight,
  HardDrive,
  Menu,
  Edit2,
  Trash2
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
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string, name: string) => void;
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
  onRenameFolder,
  onDeleteFolder
}) => {
  const isSystemFolder = (id: string | null) => {
    if (!id) return true;
    return (
      id === 'folder-scan' ||
      id === 'folder-converted' ||
      id === 'folder-my-docs' ||
      id === 'folder-archive' ||
      id.startsWith('folder-scan-') ||
      id.startsWith('folder-conv-') ||
      id.startsWith('folder-doc-') ||
      id.startsWith('folder-arc-')
    );
  };

  // Bangun path breadcrumb dari hierarki folder
  const buildPath = (): { id: string | null; name: string }[] => {
    if (activeNav === 'recent') return [{ id: null, name: 'Berkas Terkini (Recent)' }];
    if (activeNav === 'favorites') return [{ id: null, name: 'Favorit (Starred)' }];
    if (activeNav === 'recycle_bin') return [{ id: null, name: 'Tempat Sampah (Recycle Bin)' }];

    if (!currentFolderId) return [{ id: null, name: 'Home' }];

    // Cari node di tree
    const findInTree = (nodes: FolderNode[], id: string, curPath: { id: string; name: string }[]): { id: string; name: string }[] | null => {
      for (const node of nodes) {
        const next = [...curPath, { id: node.id, name: node.name }];
        if (node.id === id) return next;
        if (node.children && node.children.length > 0) {
          const res = findInTree(node.children, id, next);
          if (res) return res;
        }
      }
      return null;
    };

    const path = findInTree(folderTree, currentFolderId, []);
    return path ? [{ id: null, name: 'Home' }, ...path] : [{ id: null, name: 'Home' }];
  };

  const pathSegments = buildPath();

  return (
    <div className="h-10 bg-white border-b border-[#e5e5e5] px-2.5 sm:px-3 flex items-center justify-between space-x-1.5 sm:space-x-2 select-none">
      {/* Navigation Buttons: Mobile Drawer Menu + Back, Forward, Up */}
      <div className="flex items-center space-x-1 shrink-0">
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition"
            title="Buka Menu Folder"
          >
            <Menu className="w-4 h-4 text-blue-600" />
          </button>
        )}

        <button
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

      {/* Breadcrumb Path Address Bar */}
      <div className="flex-1 flex items-center bg-[#f9f9f9] border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 overflow-hidden shadow-2xs">
        <HardDrive className="w-3.5 h-3.5 text-blue-600 mr-1.5 shrink-0" />
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none whitespace-nowrap">
          {pathSegments.map((seg, idx) => (
            <React.Fragment key={seg.id || idx}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}
              <button
                onClick={() => onNavigate(seg.id)}
                className="hover:bg-gray-200/80 px-1.5 py-0.5 rounded transition flex items-center space-x-1 font-normal hover:text-blue-600 text-gray-800"
              >
                {idx > 0 && <Folder className="w-3 h-3 text-amber-500 mr-1 inline shrink-0" />}
                <span>{seg.name}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Action: Ganti Nama & Hapus Folder Aktif (jika bukan folder sistem) */}
      {currentFolderId && !isSystemFolder(currentFolderId) && (
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => {
              const currentName = pathSegments[pathSegments.length - 1]?.name || 'Folder';
              if (onRenameFolder) onRenameFolder(currentFolderId, currentName);
            }}
            className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-gray-200 transition"
            title="Ganti nama folder ini"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden md:inline font-medium text-[11px]">Ganti Nama</span>
          </button>
          <button
            onClick={() => {
              const currentName = pathSegments[pathSegments.length - 1]?.name || 'Folder';
              if (onDeleteFolder) onDeleteFolder(currentFolderId, currentName);
            }}
            className="flex items-center space-x-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md border border-red-200 transition"
            title="Hapus folder ini beserta seluruh isinya"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            <span className="hidden md:inline font-medium text-[11px]">Hapus Folder</span>
          </button>
        </div>
      )}

      {/* Search Input Box */}
      <div className="relative w-28 sm:w-48 md:w-64 shrink-0">
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
