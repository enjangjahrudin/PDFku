import React, { useState, useMemo } from 'react';
import { X, Folder, CornerDownRight, AlertCircle } from 'lucide-react';
import { FolderNode, VirtualFile } from '../../types';

export interface MoveItem {
  id: string;
  name: string;
  isFolder?: boolean;
}

interface MoveDialogProps {
  isOpen: boolean;
  itemsToMove?: MoveItem[];
  filesToMove?: VirtualFile[];
  folderTree: FolderNode[];
  onClose: () => void;
  onConfirmMove: (targetFolderId: string | null) => void;
}

export const MoveDialog: React.FC<MoveDialogProps> = ({
  isOpen,
  itemsToMove,
  filesToMove,
  folderTree,
  onClose,
  onConfirmMove
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const targets: MoveItem[] = useMemo(() => {
    if (itemsToMove && itemsToMove.length > 0) return itemsToMove;
    if (filesToMove && filesToMove.length > 0) {
      return filesToMove.map(f => ({ id: f.id, name: f.name, isFolder: f.isFolder }));
    }
    return [];
  }, [itemsToMove, filesToMove]);

  // Kumpulkan ID folder yang dilarang (tidak boleh memindahkan folder ke dirinya sendiri atau anak subfoldernya)
  const forbiddenIds = useMemo(() => {
    const forbidden = new Set<string>();
    targets.forEach(item => {
      if (item.isFolder) {
        forbidden.add(item.id);

        const collectChildren = (nodes: FolderNode[]) => {
          for (const node of nodes) {
            if (node.id === item.id) {
              const addAll = (children?: FolderNode[]) => {
                if (!children) return;
                for (const c of children) {
                  forbidden.add(c.id);
                  addAll(c.children);
                }
              };
              addAll(node.children);
            } else if (node.children) {
              collectChildren(node.children);
            }
          }
        };
        collectChildren(folderTree);
      }
    });
    return forbidden;
  }, [targets, folderTree]);

  if (!isOpen || targets.length === 0) return null;

  const titleText =
    targets.length === 1
      ? `Pindahkan ${targets[0].isFolder ? 'Folder' : 'Berkas'} "${targets[0].name}"`
      : `Pindahkan ${targets.length} Item ke Folder`;

  const renderFolderItem = (node: FolderNode, depth: number = 0) => {
    const isForbidden = forbiddenIds.has(node.id);
    const isSelected = selectedFolderId === node.id;

    return (
      <div key={node.id}>
        <div
          onClick={() => {
            if (!isForbidden) setSelectedFolderId(node.id);
          }}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          className={`flex items-center justify-between py-1.5 px-2 rounded-md text-xs transition ${
            isForbidden
              ? 'opacity-40 cursor-not-allowed text-gray-400 bg-gray-50'
              : isSelected
              ? 'bg-blue-100 text-blue-700 font-medium cursor-pointer'
              : 'text-gray-700 hover:bg-gray-100 cursor-pointer'
          }`}
          title={isForbidden ? 'Tidak dapat memindahkan folder ke dalam dirinya sendiri' : node.name}
        >
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <Folder
              className={`w-4 h-4 shrink-0 ${
                isForbidden ? 'text-gray-400' : isSelected ? 'text-blue-600' : 'text-amber-500'
              }`}
            />
            <span className="truncate">{node.name}</span>
          </div>

          {isForbidden && (
            <span className="text-[10px] text-gray-400 shrink-0 italic">Folder asal</span>
          )}
        </div>
        {node.children && node.children.map((c) => renderFolderItem(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="h-10 border-b border-gray-200 px-4 flex items-center justify-between bg-gray-50">
          <div className="flex items-center space-x-2 min-w-0">
            <CornerDownRight className="w-4 h-4 text-blue-600 shrink-0" />
            <h4 className="text-xs font-semibold text-gray-800 truncate">
              {titleText}
            </h4>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 max-h-64 overflow-y-auto space-y-1">
          <div
            onClick={() => setSelectedFolderId(null)}
            className={`flex items-center space-x-2 py-1.5 px-2 rounded-md text-xs cursor-pointer transition ${
              selectedFolderId === null
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Folder className="w-4 h-4 text-gray-400" />
            <span>Root / Home (Folder Utama)</span>
          </div>

          {folderTree.map((node) => renderFolderItem(node, 0))}
        </div>

        <div className="p-3 border-t border-gray-100 flex space-x-2 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 transition"
          >
            Batal
          </button>
          <button
            onClick={() => {
              if (selectedFolderId && forbiddenIds.has(selectedFolderId)) return;
              onConfirmMove(selectedFolderId);
              onClose();
            }}
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
          >
            Pindahkan Sekarang
          </button>
        </div>
      </div>
    </div>
  );
};
