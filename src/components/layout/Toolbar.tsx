import React from 'react';
import {
  FolderPlus,
  Trash2,
  Edit2,
  LayoutGrid,
  List,
  ArrowUpDown,
  RefreshCw,
  Sparkles,
  Upload,
  RotateCcw,
  CornerDownRight,
  Download,
  CheckSquare,
  Square,
  Layers,
  Scissors,
  Copy,
  ClipboardPaste
} from 'lucide-react';

interface ToolbarProps {
  onNewFolder: () => void;
  onOpenScanner: () => void;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedCount: number;
  totalFilesCount?: number;
  isAllSelected?: boolean;
  onToggleSelectAll?: () => void;
  onDeleteSelected: () => void;
  onRenameSelected: () => void;
  onMoveSelected?: () => void;
  onCutSelected?: () => void;
  onCopySelected?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  clipboardCount?: number;
  clipboardAction?: 'copy' | 'cut' | null;
  onBulkDownloadZip?: () => void;
  onBulkMergePdf?: () => void;
  viewMode: 'grid' | 'details';
  onToggleViewMode: (mode: 'grid' | 'details') => void;
  sortBy: 'name' | 'updatedAt' | 'size' | 'type';
  sortOrder: 'asc' | 'desc';
  onChangeSort: (field: 'name' | 'updatedAt' | 'size' | 'type') => void;
  onRefresh: () => void;
  isRecycleBin?: boolean;
  onEmptyRecycleBin?: () => void;
  onRestoreSelected?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onNewFolder,
  onOpenScanner,
  onUploadFile,
  selectedCount,
  totalFilesCount = 0,
  isAllSelected = false,
  onToggleSelectAll,
  onDeleteSelected,
  onRenameSelected,
  onMoveSelected,
  onCutSelected,
  onCopySelected,
  onPaste,
  canPaste = false,
  clipboardCount = 0,
  clipboardAction,
  onBulkDownloadZip,
  onBulkMergePdf,
  viewMode,
  onToggleViewMode,
  sortBy,
  sortOrder,
  onChangeSort,
  onRefresh,
  isRecycleBin,
  onEmptyRecycleBin,
  onRestoreSelected
}) => {
  return (
    <div className="h-11 sm:h-12 bg-[#fafafa] border-b border-[#e5e5e5] px-2.5 sm:px-3 flex items-center justify-between select-none overflow-x-auto scrollbar-none shrink-0">
      {/* Left Action Buttons */}
      <div className="flex items-center space-x-1 shrink-0">
        {!isRecycleBin ? (
          <>
            <button
              onClick={onNewFolder}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-200/70 rounded-md transition"
              title="Buat folder baru"
            >
              <FolderPlus className="w-4 h-4 text-amber-600" />
              <span>Folder Baru</span>
            </button>

            <button
              onClick={onOpenScanner}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition font-medium border border-blue-200"
              title="Pindai dokumen fisik dengan magic enhancer"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Scan Dokumen</span>
            </button>

            <label className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-200/70 rounded-md transition cursor-pointer">
              <Upload className="w-4 h-4 text-gray-600" />
              <span>Upload Berkas</span>
              <input
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={onUploadFile}
                className="hidden"
              />
            </label>

            <div className="h-4 w-px bg-gray-300 mx-1" />

            {/* Select All Toggle Button */}
            {onToggleSelectAll && totalFilesCount > 0 && (
              <button
                onClick={onToggleSelectAll}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs rounded-md transition ${
                  isAllSelected
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-200/70'
                }`}
                title={isAllSelected ? 'Batalkan semua pilihan (Ctrl + D)' : 'Pilih semua berkas (Ctrl + A)'}
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-gray-500" />
                )}
                <span>{isAllSelected ? 'Batal Pilih' : 'Pilih Semua'}</span>
              </button>
            )}

            {/* Selection based actions */}
            <button
              disabled={selectedCount !== 1}
              onClick={onRenameSelected}
              className={`flex items-center space-x-1 px-2 py-1.5 text-xs rounded-md transition ${
                selectedCount === 1
                  ? 'text-gray-700 hover:bg-gray-200/70'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
              title="Ganti nama berkas (F2)"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Rename</span>
            </button>

            {onCutSelected && (
              <button
                disabled={selectedCount === 0}
                onClick={onCutSelected}
                className={`flex items-center space-x-1 px-2 py-1.5 text-xs rounded-md transition ${
                  selectedCount > 0
                    ? 'text-gray-700 hover:bg-gray-200/70 font-medium'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
                title="Potong item terpilih (Ctrl + X)"
              >
                <Scissors className="w-3.5 h-3.5 text-orange-600" />
                <span>Cut</span>
              </button>
            )}

            {onCopySelected && (
              <button
                disabled={selectedCount === 0}
                onClick={onCopySelected}
                className={`flex items-center space-x-1 px-2 py-1.5 text-xs rounded-md transition ${
                  selectedCount > 0
                    ? 'text-gray-700 hover:bg-gray-200/70 font-medium'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
                title="Salin item terpilih (Ctrl + C)"
              >
                <Copy className="w-3.5 h-3.5 text-indigo-600" />
                <span>Copy</span>
              </button>
            )}

            {onPaste && (
              <button
                disabled={!canPaste}
                onClick={onPaste}
                className={`flex items-center space-x-1 px-2 py-1.5 text-xs rounded-md transition ${
                  canPaste
                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold border border-emerald-300'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
                title="Tempel item dari papan klip (Ctrl + V)"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Paste
                  {clipboardCount > 0 && (
                    <span className="ml-1 px-1 py-0.2 rounded-full bg-emerald-200 text-emerald-800 text-[10px]">
                      {clipboardCount}
                    </span>
                  )}
                </span>
              </button>
            )}

            {onMoveSelected && (
              <button
                disabled={selectedCount === 0}
                onClick={onMoveSelected}
                className={`flex items-center space-x-1 px-2 py-1.5 text-xs rounded-md transition ${
                  selectedCount > 0
                    ? 'text-blue-700 bg-blue-50/70 hover:bg-blue-100 font-medium'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
                title="Pindahkan berkas terpilih ke folder lain"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-blue-600" />
                <span>Pindahkan {selectedCount > 0 && `(${selectedCount})`}</span>
              </button>
            )}

            {onBulkDownloadZip && selectedCount > 0 && (
              <button
                onClick={onBulkDownloadZip}
                className="flex items-center space-x-1 px-2 py-1.5 text-xs text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 rounded-md transition font-medium"
                title="Unduh semua berkas terpilih dalam bentuk 1 file ZIP"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download ZIP ({selectedCount})</span>
              </button>
            )}

            {onBulkMergePdf && selectedCount > 1 && (
              <button
                onClick={onBulkMergePdf}
                className="flex items-center space-x-1 px-2 py-1.5 text-xs text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 rounded-md transition font-medium"
                title="Gabungkan berkas-berkas terpilih menjadi 1 dokumen PDF"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Gabung ke PDF</span>
              </button>
            )}

            <button
              disabled={selectedCount === 0}
              onClick={onDeleteSelected}
              className={`flex items-center space-x-1 px-2 py-1.5 text-xs rounded-md transition ${
                selectedCount > 0
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
              title="Pindahkan ke Tempat Sampah (Delete)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus {selectedCount > 0 && `(${selectedCount})`}</span>
            </button>
          </>
        ) : (
          <>
            <button
              disabled={selectedCount === 0}
              onClick={onRestoreSelected}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 rounded-md transition font-medium border border-emerald-200"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              <span>Pulihkan Berkas ({selectedCount})</span>
            </button>

            <button
              onClick={onEmptyRecycleBin}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50 rounded-md transition font-medium border border-red-200"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Kosongkan Tempat Sampah</span>
            </button>
          </>
        )}
      </div>

      {/* Right Controls: Sort, View Toggle, Refresh */}
      <div className="flex items-center space-x-1">
        {/* Sort Selector */}
        <div className="flex items-center space-x-1 bg-white border border-gray-200 rounded-md px-1.5 py-1 text-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
          <select
            value={sortBy}
            onChange={(e) => onChangeSort(e.target.value as any)}
            className="bg-transparent text-gray-700 focus:outline-none cursor-pointer pr-1"
          >
            <option value="name">Nama {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</option>
            <option value="updatedAt">Tanggal {sortBy === 'updatedAt' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</option>
            <option value="size">Ukuran {sortBy === 'size' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</option>
            <option value="type">Tipe {sortBy === 'type' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</option>
          </select>
        </div>

        <div className="h-4 w-px bg-gray-300 mx-1" />

        {/* View Mode Toggle */}
        <div className="flex items-center bg-gray-200/70 p-0.5 rounded-md">
          <button
            onClick={() => onToggleViewMode('grid')}
            className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            title="Tampilan Grid Thumbnail Besar"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleViewMode('details')}
            className={`p-1 rounded ${viewMode === 'details' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            title="Tampilan Rincian / List"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="p-1.5 text-gray-600 hover:bg-gray-200/70 rounded-md transition"
          title="Segarkan Tampilan (F5)"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
