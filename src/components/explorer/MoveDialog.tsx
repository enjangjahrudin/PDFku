import React, { useState } from 'react';
import { X, Folder, CornerDownRight } from 'lucide-react';
import { FolderNode, VirtualFile } from '../../types';

interface MoveDialogProps {
  isOpen: boolean;
  filesToMove: VirtualFile[];
  folderTree: FolderNode[];
  onClose: () => void;
  onConfirmMove: (targetFolderId: string | null) => void;
}

export const MoveDialog: React.FC<MoveDialogProps> = ({
  isOpen,
  filesToMove,
  folderTree,
  onClose,
  onConfirmMove
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  if (!isOpen || filesToMove.length === 0) return null;

  const renderFolderItem = (node: FolderNode, depth: number = 0) => {
    return (
      <div key={node.id}>
        <div
          onClick={() => setSelectedFolderId(node.id)}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          className={`flex items-center space-x-2 py-1.5 px-2 rounded-md text-xs cursor-pointer transition ${
            selectedFolderId === node.id
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">{node.name}</span>
        </div>
        {node.children && node.children.map((c) => renderFolderItem(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="h-10 border-b border-gray-200 px-4 flex items-center justify-between bg-gray-50">
          <div className="flex items-center space-x-2">
            <CornerDownRight className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-semibold text-gray-800">
              Pindahkan {filesToMove.length} Berkas ke Folder
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
            <span>Root / Home (Tanpa Folder)</span>
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
