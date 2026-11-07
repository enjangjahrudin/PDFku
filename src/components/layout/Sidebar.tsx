import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Star,
  Trash2,
  HardDrive,
  FolderPlus,
  ShieldCheck,
  X
} from 'lucide-react';
import { FolderNode } from '../../types';

interface SidebarProps {
  currentFolderId: string | null;
  folderTree: FolderNode[];
  onNavigate: (folderId: string | null) => void;
  activeNav: 'folder' | 'recent' | 'favorites' | 'recycle_bin';
  setActiveNav: (nav: 'folder' | 'recent' | 'favorites' | 'recycle_bin') => void;
  onNewFolder: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentFolderId,
  folderTree,
  onNavigate,
  activeNav,
  setActiveNav,
  onNewFolder,
  isMobileOpen = false,
  onMobileClose
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'folder-scan': true,
    'folder-converted': true,
    'folder-my-docs': true
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFolderClick = (id: string | null) => {
    setActiveNav('folder');
    onNavigate(id);
    if (onMobileClose) onMobileClose();
  };

  const handleNavClick = (nav: 'recent' | 'favorites' | 'recycle_bin') => {
    setActiveNav(nav);
    onNavigate(null);
    if (onMobileClose) onMobileClose();
  };

  const renderFolderItem = (node: FolderNode, depth: number = 0) => {
    const isExpanded = !!expandedFolders[node.id];
    const isSelected = activeNav === 'folder' && currentFolderId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => handleFolderClick(node.id)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`flex items-center justify-between py-1 px-2 my-0.5 rounded-md text-xs cursor-pointer transition ${
            isSelected
              ? 'bg-[#e0f0fd] text-blue-700 font-medium'
              : 'text-gray-700 hover:bg-gray-200/60'
          }`}
        >
          <div className="flex items-center space-x-1.5 min-w-0">
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 hover:bg-gray-300/60 rounded text-gray-500"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {isSelected ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            )}

            <span className="truncate">{node.name}</span>
          </div>

          {node.colorTag && (
            <span
              className="w-2 h-2 rounded-full shrink-0 ml-1"
              style={{ backgroundColor: node.colorTag }}
            />
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const sidebarBody = (
    <>
      <div className="p-2 overflow-y-auto flex-1">
        {/* Quick Access Section */}
        <div className="mb-4">
          <div className="px-2.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Akses Cepat
          </div>

          <div
            onClick={() => handleNavClick('recent')}
            className={`flex items-center space-x-2 py-1.5 px-2.5 rounded-md text-xs cursor-pointer transition ${
              activeNav === 'recent'
                ? 'bg-[#e0f0fd] text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-200/60'
            }`}
          >
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Terkini (Recent)</span>
          </div>

          <div
            onClick={() => handleNavClick('favorites')}
            className={`flex items-center space-x-2 py-1.5 px-2.5 rounded-md text-xs cursor-pointer transition ${
              activeNav === 'favorites'
                ? 'bg-[#e0f0fd] text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-200/60'
            }`}
          >
            <Star className="w-4 h-4 text-amber-500" />
            <span>Favorit (Starred)</span>
          </div>

          <div
            onClick={() => handleNavClick('recycle_bin')}
            className={`flex items-center space-x-2 py-1.5 px-2.5 rounded-md text-xs cursor-pointer transition ${
              activeNav === 'recycle_bin'
                ? 'bg-[#e0f0fd] text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-200/60'
            }`}
          >
            <Trash2 className="w-4 h-4 text-gray-500" />
            <span>Tempat Sampah</span>
          </div>
        </div>

        {/* This PC / Document Folders */}
        <div>
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <button
              onClick={() => handleFolderClick(null)}
              className="flex items-center space-x-1 hover:text-blue-600 transition"
              title="Lihat Semua Folder (Home)"
            >
              <HardDrive className="w-3 h-3 text-gray-500" />
              <span>Penyimpanan Lokal</span>
            </button>
            <button
              onClick={() => {
                onNewFolder();
                if (onMobileClose) onMobileClose();
              }}
              className="p-0.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-800"
              title="Buat folder baru"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-1">
            {folderTree.map(node => renderFolderItem(node, 0))}
          </div>
        </div>
      </div>

      {/* Footer Security Badge */}
      <div className="p-2.5 border-t border-gray-200 bg-white/50 text-[11px] text-gray-500 flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="leading-tight">
          Penyimpanan offline lokal di perangkat ini.
        </span>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-60 bg-[#f9f9f9] border-r border-[#e5e5e5] h-full flex-col justify-between shrink-0 select-none">
        {sidebarBody}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            onClick={onMobileClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150"
          />
          <aside className="relative w-72 max-w-[80vw] bg-[#f9f9f9] h-full flex flex-col justify-between shadow-2xl z-10 select-none animate-in slide-in-from-left duration-200">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-white">
              <span className="font-semibold text-xs text-gray-800 flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                <span>Penyimpanan & Folder</span>
              </span>
              <button
                onClick={onMobileClose}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
};
