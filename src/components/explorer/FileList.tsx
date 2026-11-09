import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Folder,
  Star,
  Eye,
  Download,
  Trash2,
  Check,
  Clock
} from 'lucide-react';
import { VirtualFile } from '../../types';
import { formatFileSize, formatDate } from '../../utils/formatters';

interface FileListProps {
  files: VirtualFile[];
  selectedIds: string[];
  cutItemIds?: string[];
  onSelect: (id: string, multi: boolean) => void;
  onOpen: (file: VirtualFile) => void;
  onContextMenu: (e: React.MouseEvent, file: VirtualFile) => void;
  onToggleFavorite: (id: string) => void;
  onSelectAll?: (selectAll: boolean) => void;
  onDownloadFile?: (file: VirtualFile) => void;
  isRecycleBin?: boolean;
  activeNav?: string;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  selectedIds,
  cutItemIds,
  onSelect,
  onOpen,
  onContextMenu,
  onToggleFavorite,
  onSelectAll,
  onDownloadFile,
  isRecycleBin,
  activeNav
}) => {
  if (files.length === 0) {
    if (activeNav === 'recycle_bin' || isRecycleBin) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 select-none">
          <Trash2 className="w-12 h-12 text-gray-300 mb-2 stroke-1" />
          <p className="text-sm font-medium text-gray-500">Tempat Sampah Kosong</p>
          <p className="text-xs text-gray-400 mt-0.5">Tidak ada berkas atau folder di dalam tempat sampah.</p>
        </div>
      );
    }

    if (activeNav === 'favorites') {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 select-none">
          <Star className="w-12 h-12 text-amber-500 fill-amber-500 mb-2 stroke-1" />
          <p className="text-sm font-medium text-gray-500">Belum Ada Berkas Favorit</p>
          <p className="text-xs text-gray-400 mt-0.5">Tandai berkas penting dengan bintang untuk menemukannya di sini.</p>
        </div>
      );
    }

    if (activeNav === 'recent') {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 select-none">
          <Clock className="w-12 h-12 text-blue-500 mb-2 stroke-1" />
          <p className="text-sm font-medium text-gray-500">Belum Ada Berkas Terkini</p>
          <p className="text-xs text-gray-400 mt-0.5">Berkas yang baru dibuka atau diubah akan otomatis muncul di sini.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 select-none">
        <Folder className="w-12 h-12 text-gray-300 mb-2 stroke-1" />
        <p className="text-sm font-medium text-gray-500">Folder ini kosong</p>
      </div>
    );
  }

  const getTypeName = (file: VirtualFile) => {
    if (file.isFolder) return 'File folder';
    if (file.type === 'pdf') return 'Adobe Acrobat Document';
    if (file.type === 'jpg') return 'JPEG Image';
    if (file.type === 'png') return 'PNG Image';
    return 'Document';
  };

  return (
    <div className="p-3 select-none">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-400 font-medium">
            <th className="py-2 px-3 w-8">
              <button
                type="button"
                onClick={() => onSelectAll && onSelectAll(selectedIds.length !== files.length)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                  selectedIds.length === files.length && files.length > 0
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 bg-white hover:border-blue-500'
                }`}
                title={selectedIds.length === files.length ? 'Batalkan semua' : 'Pilih semua'}
              >
                {selectedIds.length === files.length && files.length > 0 && <Check className="w-3 h-3 stroke-[3]" />}
              </button>
            </th>
            <th className="py-2 px-3 font-normal">Nama</th>
            <th className="py-2 px-3 font-normal w-40">Tanggal Dimodifikasi</th>
            <th className="py-2 px-3 font-normal w-44">Tipe Berkas</th>
            <th className="py-2 px-3 font-normal w-28 text-right">Ukuran</th>
            <th className="py-2 px-3 font-normal w-24 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const isSelected = selectedIds.includes(file.id);
            const isCut = cutItemIds?.includes(file.id);

            return (
              <tr
                key={file.id}
                id={`file-item-${file.id}`}
                data-file-id={file.id}
                onClick={(e) => onSelect(file.id, e.ctrlKey || e.metaKey)}
                onDoubleClick={() => onOpen(file)}
                onContextMenu={(e) => onContextMenu(e, file)}
                className={`border-b border-gray-100 cursor-pointer transition ${
                  isCut ? 'opacity-40 italic' : ''
                } ${
                  isSelected
                    ? 'bg-blue-50/95 text-blue-900 font-medium ring-1 ring-inset ring-blue-400 shadow-2xs'
                    : 'hover:bg-gray-100/70 text-gray-700'
                }`}
              >
                {/* Checkbox column */}
                <td className="py-2 px-3 w-8" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onSelect(file.id, true)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 bg-white hover:border-blue-500'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                </td>

                {/* Name column */}
                <td className="py-2 px-3 flex items-center space-x-2">
                  {!file.isFolder ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(file.id);
                      }}
                      className={`p-0.5 rounded transition ${
                        file.isFavorite ? 'text-amber-500' : 'text-gray-300 hover:text-gray-400'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-500' : ''}`} />
                    </button>
                  ) : (
                    <span className="w-3.5" />
                  )}

                  {file.isFolder ? (
                    <Folder className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                  ) : file.type === 'pdf' ? (
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                  )}

                  <span className="truncate max-w-md">{file.name}</span>

                  {file.colorTag && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: file.colorTag }}
                    />
                  )}
                </td>

                {/* Date Modified */}
                <td className="py-2 px-3 text-gray-500">
                  {formatDate(file.updatedAt)}
                </td>

                {/* Type */}
                <td className="py-2 px-3 text-gray-500">
                  {getTypeName(file)}
                </td>

                {/* Size */}
                <td className="py-2 px-3 text-right text-gray-500 font-mono">
                  {file.isFolder ? '' : formatFileSize(file.size)}
                </td>

                {/* Actions */}
                <td className="py-2 px-3 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDownloadFile) {
                          onDownloadFile(file);
                        }
                      }}
                      className="p-1 hover:bg-emerald-50 rounded text-gray-500 hover:text-emerald-600 transition"
                      title={file.isFolder ? "Unduh Folder (ZIP)" : "Unduh Berkas Ini Langsung"}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(file);
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-blue-600 transition"
                      title="Lihat Pratinjau"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
