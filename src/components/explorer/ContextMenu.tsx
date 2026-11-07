import React, { useEffect, useRef } from 'react';
import {
  Eye,
  Download,
  Edit2,
  Trash2,
  Star,
  Palette,
  RotateCcw,
  CornerDownRight,
  Scissors,
  Copy,
  ClipboardPaste,
  FolderPlus
} from 'lucide-react';
import { VirtualFile } from '../../types';
import { downloadBlob } from '../../utils/formatters';

interface ContextMenuProps {
  x: number;
  y: number;
  file: VirtualFile | null;
  onClose: () => void;
  onOpen: (file: VirtualFile) => void;
  onRename: (file: VirtualFile) => void;
  onDelete: (file: VirtualFile) => void;
  onToggleFavorite: (id: string) => void;
  onSetColorTag: (id: string, color: string | undefined) => void;
  onNewFolder?: (parentId?: string | null, parentName?: string) => void;
  onMove?: (file: VirtualFile) => void;
  onCut?: (file: VirtualFile) => void;
  onCopy?: (file: VirtualFile) => void;
  onPaste?: () => void;
  canPaste?: boolean;
  clipboardCount?: number;
  isRecycleBin?: boolean;
  onRestore?: (file: VirtualFile) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  file,
  onClose,
  onOpen,
  onRename,
  onDelete,
  onToggleFavorite,
  onSetColorTag,
  onNewFolder,
  onMove,
  onCut,
  onCopy,
  onPaste,
  canPaste,
  clipboardCount,
  isRecycleBin,
  onRestore
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!file) return null;

  // Pastikan menu tidak keluar dari batas layar
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 260);

  const colors = [
    { name: 'Merah', hex: '#ef4444' },
    { name: 'Hijau', hex: '#10b981' },
    { name: 'Biru', hex: '#3b82f6' },
    { name: 'Kuning', hex: '#f59e0b' },
    { name: 'Ungu', hex: '#8b5cf6' }
  ];

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-52 bg-white/95 backdrop-blur-md rounded-lg border border-gray-200/90 shadow-xl py-1 text-xs text-gray-700 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {!isRecycleBin ? (
        <>
          <button
            onClick={() => {
              onClose();
              onOpen(file);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-gray-100 transition text-left"
          >
            <Eye className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Buka / Pratinjau</span>
          </button>

          {file.isFolder && onNewFolder && (
            <button
              onClick={() => {
                onClose();
                onNewFolder(file.id, file.name);
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-emerald-50 text-emerald-700 transition text-left font-medium"
            >
              <FolderPlus className="w-4 h-4 text-emerald-600" />
              <span>+ Buat Sub-folder di Sini</span>
            </button>
          )}

          {!file.isFolder && file.blob && (
            <button
              onClick={() => {
                onClose();
                downloadBlob(file.blob!, file.name);
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-gray-100 transition text-left"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Unduh Berkas</span>
            </button>
          )}

          {onCut && (
            <button
              onClick={() => {
                onClose();
                onCut(file);
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-orange-50 hover:text-orange-700 transition text-left"
            >
              <Scissors className="w-4 h-4 text-orange-600" />
              <span>Potong (Cut)</span>
            </button>
          )}

          {onCopy && (
            <button
              onClick={() => {
                onClose();
                onCopy(file);
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-indigo-50 hover:text-indigo-700 transition text-left"
            >
              <Copy className="w-4 h-4 text-indigo-600" />
              <span>Salin (Copy)</span>
            </button>
          )}

          {canPaste && onPaste && (
            <button
              onClick={() => {
                onClose();
                onPaste();
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-emerald-50 text-emerald-700 font-medium transition text-left"
            >
              <ClipboardPaste className="w-4 h-4 text-emerald-600" />
              <span>Tempel (Paste) {clipboardCount && clipboardCount > 0 ? `(${clipboardCount})` : ''}</span>
            </button>
          )}

          <div className="h-px bg-gray-100 my-0.5" />

          <button
            onClick={() => {
              onClose();
              onRename(file);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-gray-100 transition text-left"
          >
            <Edit2 className="w-4 h-4 text-gray-500" />
            <span>Ganti Nama (Rename)</span>
          </button>

          {onMove && (
            <button
              onClick={() => {
                onClose();
                onMove(file);
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-gray-100 transition text-left"
            >
              <CornerDownRight className="w-4 h-4 text-blue-500" />
              <span>Pindahkan ke Folder...</span>
            </button>
          )}

          {!file.isFolder && (
            <button
              onClick={() => {
                onClose();
                onToggleFavorite(file.id);
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-gray-100 transition text-left"
            >
              <Star className={`w-4 h-4 ${file.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
              <span>{file.isFavorite ? 'Hapus dari Favorit' : 'Tandai Favorit'}</span>
            </button>
          )}

          {/* Color tag picker */}
          <div className="px-3 py-1.5 border-t border-gray-100 mt-1">
            <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1 flex items-center space-x-1">
              <Palette className="w-3 h-3" />
              <span>Warna Label</span>
            </div>
            <div className="flex items-center space-x-1.5 pt-0.5">
              {colors.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => {
                    onClose();
                    onSetColorTag(file.id, c.hex);
                  }}
                  title={c.name}
                  className={`w-4 h-4 rounded-full transition transform hover:scale-125 ${
                    file.colorTag === c.hex ? 'ring-2 ring-gray-600 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {file.colorTag && (
                <button
                  onClick={() => {
                    onClose();
                    onSetColorTag(file.id, undefined);
                  }}
                  className="text-[10px] text-gray-400 hover:text-gray-600 ml-1 underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-gray-100 my-1" />

          <button
            onClick={() => {
              onClose();
              onDelete(file);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-red-50 text-red-600 transition text-left"
          >
            <Trash2 className="w-4 h-4" />
            <span>Pindahkan ke Tempat Sampah</span>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => {
              onClose();
              if (onRestore) onRestore(file);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-emerald-50 text-emerald-700 transition text-left"
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <span>Pulihkan Berkas</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onDelete(file);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-red-50 text-red-600 transition text-left"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Permanen</span>
          </button>
        </>
      )}
    </div>
  );
};
