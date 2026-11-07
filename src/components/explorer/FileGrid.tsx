import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Folder,
  Star,
  Download,
  Trash2,
  Eye,
  Check
} from 'lucide-react';
import { VirtualFile } from '../../types';
import { formatFileSize, formatDate } from '../../utils/formatters';

interface FileGridProps {
  files: VirtualFile[];
  selectedIds: string[];
  cutItemIds?: string[];
  onSelect: (id: string, multi: boolean) => void;
  onOpen: (file: VirtualFile) => void;
  onContextMenu: (e: React.MouseEvent, file: VirtualFile) => void;
  onToggleFavorite: (id: string) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  files,
  selectedIds,
  cutItemIds,
  onSelect,
  onOpen,
  onContextMenu,
  onToggleFavorite
}) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 select-none">
        <Folder className="w-12 h-12 text-gray-300 mb-2 stroke-1" />
        <p className="text-sm font-medium text-gray-500">Folder ini kosong</p>
        <p className="text-xs text-gray-400 mt-1">
          Gunakan tombol "Scan Dokumen" atau "Upload Berkas" di menu atas
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 p-2.5 sm:p-4 select-none">
      {files.map((file) => {
        const isSelected = selectedIds.includes(file.id);
        const isCut = cutItemIds?.includes(file.id);

        return (
          <div
            key={file.id}
            onClick={(e) => onSelect(file.id, e.ctrlKey || e.metaKey)}
            onDoubleClick={() => onOpen(file)}
            onContextMenu={(e) => onContextMenu(e, file)}
            className={`group relative flex flex-col items-center p-2 rounded-lg border transition-all cursor-pointer ${
              isCut ? 'opacity-40 border-dashed border-orange-400' : ''
            } ${
              isSelected
                ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-400 shadow-xs'
                : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Top Indicator Tags (Checkbox, Color & Star) */}
            <div className="w-full flex items-center justify-between mb-1.5 px-0.5">
              <div className="flex items-center space-x-1.5">
                {/* Windows 11 Item Check Box */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(file.id, true);
                  }}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition shadow-2xs ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white opacity-100'
                      : 'border-gray-300 bg-white/90 hover:border-blue-500 opacity-0 group-hover:opacity-100 max-sm:opacity-70'
                  }`}
                  title={isSelected ? 'Batalkan pilihan' : 'Pilih berkas ini'}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                {file.colorTag && (
                  <span
                    className="w-2.5 h-2.5 rounded-full ring-1 ring-white"
                    style={{ backgroundColor: file.colorTag }}
                  />
                )}
              </div>

              {!file.isFolder && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(file.id);
                  }}
                  className={`p-0.5 rounded hover:bg-gray-200 transition ${
                    file.isFavorite
                      ? 'text-amber-500'
                      : 'text-gray-300 group-hover:text-gray-400'
                  }`}
                  title="Tandai favorit"
                >
                  <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-500' : ''}`} />
                </button>
              )}
            </div>

            {/* Thumbnail or File Icon */}
            <div className="w-full h-28 bg-[#f8f9fa] rounded-md flex items-center justify-center overflow-hidden border border-gray-100 relative group-hover:shadow-2xs">
              {file.isFolder ? (
                <Folder className="w-16 h-16 text-amber-500 fill-amber-400 drop-shadow-xs" />
              ) : file.thumbnail ? (
                <img
                  src={file.thumbnail}
                  alt={file.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : file.type === 'pdf' ? (
                <div className="flex flex-col items-center">
                  <FileText className="w-12 h-12 text-rose-500" />
                  <span className="text-[10px] font-bold text-rose-600 mt-1 uppercase">PDF</span>
                </div>
              ) : (
                <ImageIcon className="w-12 h-12 text-blue-500" />
              )}

              {/* Hover Quick Action Buttons */}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5 backdrop-blur-[1px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(file);
                  }}
                  className="p-1.5 bg-white text-gray-800 rounded-md hover:bg-gray-100 transition shadow"
                  title="Lihat Pratinjau (Preview)"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                </button>
              </div>
            </div>

            {/* File Info */}
            <div className="w-full mt-2 text-center">
              <p
                className="text-xs font-medium text-gray-800 truncate px-1"
                title={file.name}
              >
                {file.name}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {file.isFolder ? 'Folder' : formatFileSize(file.size)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
