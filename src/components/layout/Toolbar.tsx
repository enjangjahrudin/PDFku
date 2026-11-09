import React, { useState, useRef, useEffect } from 'react';
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
  Square,
  Layers,
  Scissors,
  Copy,
  ClipboardPaste,
  Image as ImageIcon,
  FileText,
  ChevronDown,
  X,
  MoreHorizontal,
  Archive,
  FileDown
} from 'lucide-react';

interface ToolbarProps {
  onNewFolder: () => void;
  onOpenScanner: () => void;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedCount: number;
  totalFilesCount?: number;
  isAllSelected?: boolean;
  onToggleSelectAll?: () => void;
  onClearSelection?: () => void;
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
  onDownloadPerFile?: () => void;
  isSingleFileSelected?: boolean;
  onBulkMergePdf?: () => void;
  hasSelectedPdf?: boolean;
  hasSelectedImages?: boolean;
  onDirectConvertPdfToJpg?: () => void;
  onDirectConvertJpgToPdf?: () => void;
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
  onClearSelection,
  onDeleteSelected,
  onRenameSelected,
  onMoveSelected,
  onCutSelected,
  onCopySelected,
  onPaste,
  canPaste = false,
  clipboardCount = 0,
  clipboardAction: _clipboardAction,
  onBulkDownloadZip,
  onDownloadPerFile,
  isSingleFileSelected = false,
  onBulkMergePdf,
  hasSelectedPdf = false,
  hasSelectedImages = false,
  onDirectConvertPdfToJpg,
  onDirectConvertJpgToPdf,
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
  const [activeDropdown, setActiveDropdown] = useState<'download' | 'convert' | 'more' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeDropdown]);

  // Handle cancel selection
  const handleCancelSelection = () => {
    if (onClearSelection) {
      onClearSelection();
    } else if (onToggleSelectAll && isAllSelected) {
      onToggleSelectAll();
    }
  };

  const isSelectionMode = !isRecycleBin && selectedCount > 0;

  return (
    <div
      className={`h-11 sm:h-12 border-b px-2.5 sm:px-3 flex items-center justify-between select-none shrink-0 transition-colors ${
        isRecycleBin
          ? 'bg-rose-50/60 border-rose-200'
          : isSelectionMode
          ? 'bg-blue-50/85 border-blue-200'
          : 'bg-[#fafafa] border-[#e5e5e5]'
      }`}
    >
      {/* ========================================================
          BAGIAN KIRI TOOLBAR
          ======================================================== */}
      <div ref={dropdownRef} className="flex items-center space-x-1.5 shrink-0 relative">
        {/* KONDISI 1: TEMPAT SAMPAH */}
        {isRecycleBin ? (
          <>
            {selectedCount > 0 ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 bg-rose-100 text-rose-800 px-2 py-1 rounded-md text-xs font-semibold">
                  <button
                    type="button"
                    onClick={handleCancelSelection}
                    className="p-0.5 hover:bg-rose-200 rounded transition text-rose-700"
                    title="Batalkan pilihan"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span>{selectedCount} item dipilih</span>
                </div>

                <button
                  type="button"
                  onClick={onRestoreSelected}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-emerald-700 bg-white hover:bg-emerald-50 rounded-md transition font-medium border border-emerald-300 shadow-2xs"
                  title="Pulihkan berkas / folder terpilih"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pulihkan ({selectedCount})</span>
                </button>

                <button
                  type="button"
                  onClick={onDeleteSelected}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-red-700 bg-white hover:bg-red-50 rounded-md transition font-medium border border-red-300 shadow-2xs"
                  title="Hapus berkas / folder terpilih secara permanen"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Hapus Permanen</span>
                </button>
              </div>
            ) : (
              <span className="text-xs font-semibold text-rose-900 flex items-center space-x-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Tempat Sampah (Recycle Bin)</span>
              </span>
            )}

            {onEmptyRecycleBin && (
              <button
                type="button"
                onClick={onEmptyRecycleBin}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-red-700 bg-white hover:bg-red-50 rounded-md transition font-medium border border-red-300 shadow-2xs ml-1"
                title="Kosongkan seluruh tempat sampah secara permanen"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span className="hidden sm:inline">Kosongkan Tempat Sampah</span>
              </button>
            )}
          </>
        ) : isSelectionMode ? (
          /* KONDISI 2: CONTEXTUAL SELECTION BAR (ADA BERKAS TERPILIH) */
          <>
            {/* Indikator Pilihan & Batal */}
            <div className="flex items-center space-x-1.5 bg-blue-100/90 text-blue-900 px-2 py-1 rounded-md text-xs font-semibold">
              <button
                type="button"
                onClick={handleCancelSelection}
                className="p-0.5 hover:bg-blue-200 rounded transition text-blue-700 hover:text-blue-900"
                title="Batalkan pilihan (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <span>{selectedCount} dipilih</span>
            </div>

            {/* Tombol Pilih Semua Cepat jika belum semua terpilih */}
            {onToggleSelectAll && totalFilesCount > 0 && !isAllSelected && (
              <button
                type="button"
                onClick={onToggleSelectAll}
                className="text-xs text-blue-700 hover:text-blue-900 hover:underline px-1.5 py-1 font-medium transition hidden md:inline-block"
                title="Pilih seluruh berkas di folder ini"
              >
                Pilih Semua ({totalFilesCount})
              </button>
            )}

            <div className="h-4 w-px bg-blue-200 mx-0.5" />

            {/* 1. DROPDOWN DOWNLOAD (Pusat Unduhan Satu Pintu) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'download' ? null : 'download')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs rounded-md font-semibold transition border shadow-2xs ${
                  activeDropdown === 'download'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'text-emerald-800 bg-emerald-50/90 hover:bg-emerald-100 border-emerald-300'
                }`}
                title="Pilihan unduh berkas"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
                <ChevronDown className="w-3 h-3 opacity-75" />
              </button>

              {activeDropdown === 'download' && (
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* Unduh Berkas Asli Langsung (Jika 1 file) */}
                  {selectedCount === 1 && isSingleFileSelected && onDownloadPerFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        onDownloadPerFile();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-gray-800 flex items-center space-x-2.5 transition"
                    >
                      <FileDown className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-gray-900">Download Berkas Asli</div>
                        <div className="text-[10px] text-gray-500">Unduh langsung tanpa melalui ZIP</div>
                      </div>
                    </button>
                  )}

                  {/* Unduh Sebagai ZIP */}
                  {onBulkDownloadZip && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        onBulkDownloadZip();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-gray-800 flex items-center space-x-2.5 transition"
                    >
                      <Archive className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-gray-900">
                          {selectedCount === 1 ? 'Download Sebagai ZIP' : `Download ZIP (${selectedCount} berkas)`}
                        </div>
                        <div className="text-[10px] text-gray-500">Kemas berkas terpilih dalam 1 arsip ZIP</div>
                      </div>
                    </button>
                  )}

                  {/* Unduh Per Berkas (Banyak Berkas Sekaligus Tanpa ZIP) */}
                  {selectedCount > 1 && onDownloadPerFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        onDownloadPerFile();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-teal-50 text-gray-800 flex items-center space-x-2.5 transition border-t border-gray-100"
                    >
                      <FileDown className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-gray-900">Download Per Berkas ({selectedCount})</div>
                        <div className="text-[10px] text-gray-500">Unduh berkas satu per satu secara langsung</div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 2. DROPDOWN KONVERSI (Muncul jika ada PDF atau Gambar) */}
            {(hasSelectedPdf || hasSelectedImages) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'convert' ? null : 'convert')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs rounded-md font-semibold transition border shadow-2xs ${
                    activeDropdown === 'convert'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'text-indigo-800 bg-indigo-50/90 hover:bg-indigo-100 border-indigo-300'
                  }`}
                  title="Pilihan konversi instan"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Konversi</span>
                  <ChevronDown className="w-3 h-3 opacity-75" />
                </button>

                {activeDropdown === 'convert' && (
                  <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Gabung ke 1 PDF jika > 1 gambar */}
                    {onBulkMergePdf && selectedCount > 1 && hasSelectedImages && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDropdown(null);
                          onBulkMergePdf();
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-indigo-50 text-gray-800 flex items-center space-x-2.5 transition"
                      >
                        <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <div className="font-semibold text-gray-900">Gabungkan ke 1 PDF</div>
                          <div className="text-[10px] text-gray-500">Gabungkan gambar terpilih jadi 1 dokumen</div>
                        </div>
                      </button>
                    )}

                    {/* Gambar ke PDF */}
                    {onDirectConvertJpgToPdf && hasSelectedImages && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDropdown(null);
                          onDirectConvertJpgToPdf();
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 text-gray-800 flex items-center space-x-2.5 transition"
                      >
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <div className="font-semibold text-gray-900">Gambar ke PDF</div>
                          <div className="text-[10px] text-gray-500">Konversi gambar menjadi berkas PDF terpisah</div>
                        </div>
                      </button>
                    )}

                    {/* PDF ke JPG */}
                    {onDirectConvertPdfToJpg && hasSelectedPdf && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDropdown(null);
                          onDirectConvertPdfToJpg();
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-gray-800 flex items-center space-x-2.5 transition border-t border-gray-100"
                      >
                        <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-semibold text-gray-900">PDF ke JPG</div>
                          <div className="text-[10px] text-gray-500">Ekstrak setiap halaman PDF menjadi gambar</div>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. TOMBOL PINDAHKAN */}
            {onMoveSelected && (
              <button
                type="button"
                onClick={onMoveSelected}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-blue-700 bg-white hover:bg-blue-50 rounded-md transition font-medium border border-blue-200 shadow-2xs"
                title="Pindahkan berkas terpilih ke folder lain"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Pindahkan</span>
              </button>
            )}

            {/* 4. TOMBOL HAPUS */}
            <button
              type="button"
              onClick={onDeleteSelected}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-red-600 bg-white hover:bg-red-50 rounded-md transition font-medium border border-red-200 shadow-2xs"
              title="Pindahkan ke Tempat Sampah (Delete)"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span className="hidden sm:inline">Hapus</span>
            </button>

            {/* 5. MENU LAINNYA (...) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
                className={`p-1.5 text-xs rounded-md transition border shadow-2xs ${
                  activeDropdown === 'more'
                    ? 'bg-gray-200 text-gray-900 border-gray-300'
                    : 'text-gray-700 bg-white hover:bg-gray-100 border-gray-200'
                }`}
                title="Menu aksi lainnya (Ganti Nama, Potong, Salin, Tempel)"
              >
                <MoreHorizontal className="w-4 h-4 text-gray-600" />
              </button>

              {activeDropdown === 'more' && (
                <div className="absolute left-0 top-full mt-1.5 w-52 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                  {selectedCount === 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        onRenameSelected();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 text-gray-700 flex items-center space-x-2.5 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                      <span>Ganti Nama (F2)</span>
                    </button>
                  )}

                  {onCutSelected && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        onCutSelected();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 text-gray-700 flex items-center space-x-2.5 transition"
                    >
                      <Scissors className="w-3.5 h-3.5 text-orange-600" />
                      <span>Potong (Ctrl + X)</span>
                    </button>
                  )}

                  {onCopySelected && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        onCopySelected();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 text-gray-700 flex items-center space-x-2.5 transition"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Salin (Ctrl + C)</span>
                    </button>
                  )}

                  {onPaste && canPaste && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        onPaste();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-emerald-800 flex items-center space-x-2.5 transition border-t border-gray-100 font-medium"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tempel ({clipboardCount})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* KONDISI 3: MODE DEFAULT (TIDAK ADA BERKAS DIPILIH) */
          <>
            <button
              type="button"
              onClick={onNewFolder}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-200/70 rounded-md transition font-medium"
              title="Buat folder baru"
            >
              <FolderPlus className="w-4 h-4 text-amber-600" />
              <span>Folder Baru</span>
            </button>

            <button
              type="button"
              onClick={onOpenScanner}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition font-medium border border-blue-200"
              title="Pindai dokumen fisik dengan magic enhancer"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Scan Dokumen</span>
            </button>

            <label className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-200/70 rounded-md transition cursor-pointer font-medium">
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

            {onPaste && canPaste && (
              <button
                type="button"
                onClick={onPaste}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition font-semibold border border-emerald-300"
                title="Tempel berkas dari clipboard (Ctrl + V)"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tempel ({clipboardCount})</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* ========================================================
          BAGIAN KANAN TOOLBAR (KONTROL TAMPILAN, URUTAN & REFRESH)
          ======================================================== */}
      <div className="flex items-center space-x-1.5 shrink-0 ml-auto pl-2">
        {/* Tombol Pilih Semua (Hanya ditampilkan saat mode default biasa) */}
        {!isSelectionMode && !isRecycleBin && onToggleSelectAll && totalFilesCount > 0 && (
          <>
            <button
              type="button"
              onClick={onToggleSelectAll}
              className="flex items-center space-x-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-200/70 rounded-md transition font-medium"
              title="Pilih semua berkas (Ctrl + A)"
            >
              <Square className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Pilih Semua</span>
            </button>
            <div className="h-4 w-px bg-gray-300 mx-0.5" />
          </>
        )}

        {/* Sort Selector */}
        <div className="flex items-center space-x-1 bg-white border border-gray-200 rounded-md px-1.5 py-1 text-xs shadow-2xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
          <select
            value={sortBy}
            onChange={(e) => onChangeSort(e.target.value as any)}
            className="bg-transparent text-gray-700 focus:outline-none cursor-pointer pr-0.5 text-xs"
          >
            <option value="name">Nama {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</option>
            <option value="updatedAt">Tanggal {sortBy === 'updatedAt' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</option>
            <option value="size">Ukuran {sortBy === 'size' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</option>
            <option value="type">Tipe {sortBy === 'type' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</option>
          </select>
        </div>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* View Mode Toggle */}
        <div className="flex items-center bg-gray-200/70 p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => onToggleViewMode('grid')}
            className={`p-1 rounded transition ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
            title="Tampilan Grid Thumbnail Besar"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onToggleViewMode('details')}
            className={`p-1 rounded transition ${viewMode === 'details' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
            title="Tampilan Rincian / List"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Refresh */}
        <button
          type="button"
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