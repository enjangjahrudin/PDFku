import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Scissors,
  RotateCw,
  Plus,
  Trash2,
  FolderInput,
  Download,
  Loader2,
  FileText,
  LayoutGrid,
  List,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Sparkles,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { mergePdfFiles, splitPdf, rotatePdf, getPdfMetadataAndThumbnail } from '../../services/pdfService';
import { VirtualFile } from '../../types';
import { formatFileSize } from '../../utils/formatters';
import { cloudFileService } from '../../services/cloudFileService';
import { saveAs } from 'file-saver';

interface MergeItem {
  id: string;
  name: string;
  file: File | Blob;
  size: number;
  thumbnailUrl?: string;
  pageCount?: number;
  isLoadingThumb?: boolean;
}

interface PdfToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToExplorer: (file: Omit<VirtualFile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any>;
  currentFolderId?: string | null;
  currentFolderName?: string;
  initialPdfFiles?: VirtualFile[];
}

export const PdfToolsModal: React.FC<PdfToolsModalProps> = ({
  isOpen,
  onClose,
  onSaveToExplorer,
  currentFolderId,
  currentFolderName,
  initialPdfFiles
}) => {
  const [activeTab, setActiveTab] = useState<'merge' | 'split' | 'rotate'>('merge');

  // Merge state
  const [mergeFiles, setMergeFiles] = useState<MergeItem[]>([]);
  const [mergedPdfName, setMergedPdfName] = useState<string>('Dokumen_Gabungan.pdf');
  const [mergeViewMode, setMergeViewMode] = useState<'grid' | 'list'>('grid');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Split state
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [pageRangeStr, setPageRangeStr] = useState<string>('1-2');

  // Rotate state
  const [rotateFile, setRotateFile] = useState<File | null>(null);
  const [rotateDeg, setRotateDeg] = useState<number>(90);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Reset & inisialisasi state saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setSplitFile(null);
      setRotateFile(null);
      setIsLoading(false);

      const defaultName = currentFolderName
        ? `${currentFolderName}_Gabungan.pdf`
        : 'Dokumen_Gabungan.pdf';
      setMergedPdfName(defaultName);

      // Inisialisasi initial PDF files jika ada yang dipilih sebelumnya
      if (initialPdfFiles && initialPdfFiles.length > 0) {
        initInitialFiles(initialPdfFiles);
      } else {
        setMergeFiles([]);
      }
    }
  }, [isOpen, initialPdfFiles, currentFolderName]);

  const initInitialFiles = async (vFiles: VirtualFile[]) => {
    const items: MergeItem[] = [];
    for (const vf of vFiles) {
      const blob = vf.blob || (await cloudFileService.fetchFileBlob(vf.id));
      if (blob) {
        items.push({
          id: vf.id,
          name: vf.name,
          file: blob,
          size: vf.size || blob.size,
          isLoadingThumb: true
        });
      }
    }
    setMergeFiles(items);

    // Ambil metadata & thumbnail secara asynchronous
    for (const item of items) {
      try {
        const meta = await getPdfMetadataAndThumbnail(item.file);
        setMergeFiles((prev) =>
          prev.map((m) =>
            m.id === item.id
              ? { ...m, thumbnailUrl: meta.thumbnailUrl, pageCount: meta.pageCount, isLoadingThumb: false }
              : m
          )
        );
      } catch {
        setMergeFiles((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, isLoadingThumb: false } : m))
        );
      }
    }
  };

  if (!isOpen) return null;

  // Handle Penambahan Berkas PDF baru
  const handleAddMergeFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);

    const newItems: MergeItem[] = filesArray.map((f) => ({
      id: 'pdf-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      name: f.name,
      file: f,
      size: f.size,
      isLoadingThumb: true
    }));

    setMergeFiles((prev) => [...prev, ...newItems]);
    e.target.value = '';

    // Ambil metadata & thumbnail secara asynchronous
    for (const item of newItems) {
      try {
        const meta = await getPdfMetadataAndThumbnail(item.file);
        setMergeFiles((prev) =>
          prev.map((m) =>
            m.id === item.id
              ? { ...m, thumbnailUrl: meta.thumbnailUrl, pageCount: meta.pageCount, isLoadingThumb: false }
              : m
          )
        );
      } catch {
        setMergeFiles((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, isLoadingThumb: false } : m))
        );
      }
    }
  };

  // Reorder Functions (Organize PDF)
  const moveMergeItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= mergeFiles.length || fromIdx === toIdx) return;
    setMergeFiles((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return updated;
    });
  };

  const moveToExtreme = (fromIdx: number, position: 'start' | 'end') => {
    const toIdx = position === 'start' ? 0 : mergeFiles.length - 1;
    moveMergeItem(fromIdx, toIdx);
  };

  // HTML5 Drag & Drop Handlers yang Handal & Presisi
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', idx.toString());
    e.dataTransfer.setData('application/x-pdfku-index', idx.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== idx) {
      setDragOverIndex(idx);
    }
  };

  const handleDragEnter = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(idx);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    let sourceIdx: number | null = null;
    const customData = e.dataTransfer.getData('application/x-pdfku-index');
    const plainData = e.dataTransfer.getData('text/plain');

    if (customData) {
      sourceIdx = parseInt(customData, 10);
    } else if (plainData) {
      sourceIdx = parseInt(plainData, 10);
    } else if (draggedIndex !== null) {
      sourceIdx = draggedIndex;
    }

    if (sourceIdx !== null && !isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      moveMergeItem(sourceIdx, targetIdx);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Eksekusi Penggabungan PDF
  const handleStartMerge = async (saveToFolder: boolean = true) => {
    if (mergeFiles.length < 2) {
      alert('Pilih minimal 2 berkas PDF untuk digabungkan.');
      return;
    }
    setIsLoading(true);
    try {
      const blobs = mergeFiles.map((m) => m.file);
      const resBlob = await mergePdfFiles(blobs);
      const finalName = mergedPdfName.endsWith('.pdf') ? mergedPdfName : mergedPdfName + '.pdf';

      if (saveToFolder) {
        await onSaveToExplorer({
          name: finalName,
          parentId: currentFolderId || 'folder-my-docs',
          type: 'pdf',
          isFolder: false,
          size: resBlob.size,
          blob: resBlob,
          colorTag: '#3b82f6'
        });
        onClose();
        alert(`Berkas PDF "${finalName}" berhasil digabungkan dan disimpan!`);
      } else {
        saveAs(resBlob, finalName);
      }
    } catch (err) {
      alert('Gagal menggabungkan PDF: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Split
  const handleStartSplit = async (saveToFolder: boolean = true) => {
    if (!splitFile) return;
    setIsLoading(true);
    try {
      const indices: number[] = [];
      const parts = pageRangeStr.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map((n) => parseInt(n.trim()));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) indices.push(i - 1);
          }
        } else {
          const num = parseInt(trimmed);
          if (!isNaN(num)) indices.push(num - 1);
        }
      }

      const resBlob = await splitPdf(splitFile, indices);
      const outName = `${splitFile.name.replace(/\.pdf$/i, '')}_Halaman_${pageRangeStr.replace(/[\s,]+/g, '_')}.pdf`;

      if (saveToFolder) {
        await onSaveToExplorer({
          name: outName,
          parentId: currentFolderId || 'folder-my-docs',
          type: 'pdf',
          isFolder: false,
          size: resBlob.size,
          blob: resBlob,
          colorTag: '#3b82f6'
        });
        alert(`Berkas PDF "${outName}" berhasil dipisahkan dan disimpan!`);
        onClose();
      } else {
        saveAs(resBlob, outName);
      }
    } catch (err) {
      alert('Gagal memisahkan PDF: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Rotate
  const handleStartRotate = async (saveToFolder: boolean = true) => {
    if (!rotateFile) return;
    setIsLoading(true);
    try {
      const resBlob = await rotatePdf(rotateFile, rotateDeg);
      const outName = `${rotateFile.name.replace(/\.pdf$/i, '')}_Rotated.pdf`;

      if (saveToFolder) {
        await onSaveToExplorer({
          name: outName,
          parentId: currentFolderId || 'folder-my-docs',
          type: 'pdf',
          isFolder: false,
          size: resBlob.size,
          blob: resBlob,
          colorTag: '#3b82f6'
        });
        alert(`Berkas PDF "${outName}" berhasil diputar dan disimpan!`);
        onClose();
      } else {
        saveAs(resBlob, outName);
      }
    } catch (err) {
      alert('Gagal memutar PDF: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="h-13 border-b border-gray-200 px-5 flex items-center justify-between bg-[#fafafa]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">
                PDF Toolkit (Organize, Merge, Split & Rotate)
              </h3>
              <p className="text-[11px] text-gray-400">
                {currentFolderName ? `Lokasi saat ini: ${currentFolderName}` : 'Kelola dan gabungkan berkas dokumen PDF'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-gray-200 bg-gray-50/80 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('merge')}
            className={`flex items-center space-x-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'merge'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Gabung & Susun PDF (Organize & Merge)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('split')}
            className={`flex items-center space-x-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'split'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Scissors className="w-4 h-4 text-amber-600" />
            <span>Pisah PDF (Split)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rotate')}
            className={`flex items-center space-x-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'rotate'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <RotateCw className="w-4 h-4 text-indigo-600" />
            <span>Putar Halaman (Rotate)</span>
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'merge' ? (
            /* ========================================================
               TAB 1: GABUNG & SUSUN PDF (ORGANIZE & MERGE)
               ======================================================== */
            <div className="space-y-4">
              {/* Toolbar Aksi Atas */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition active:scale-95">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Berkas PDF</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleAddMergeFiles}
                      className="hidden"
                    />
                  </label>

                  <span className="text-xs text-gray-600 font-medium">
                    {mergeFiles.length} berkas dipilih
                  </span>
                </div>

                {/* Petunjuk & Toggle Tampilan Grid/List */}
                <div className="flex items-center space-x-2">
                  {mergeFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMergeFiles([])}
                      className="text-xs text-red-600 hover:text-red-700 hover:underline px-2 py-1 font-medium transition"
                    >
                      Hapus Semua
                    </button>
                  )}

                  <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setMergeViewMode('grid')}
                      className={`p-1.5 rounded-md transition ${
                        mergeViewMode === 'grid'
                          ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Tampilan Kartu Pratinjau (Thumbnail)"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeViewMode('list')}
                      className={`p-1.5 rounded-md transition ${
                        mergeViewMode === 'list'
                          ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Tampilan Rincian / List"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Banner Panduan Mengatur Posisi */}
              {mergeFiles.length > 1 && (
                <div className="flex items-center space-x-2 bg-blue-50/80 border border-blue-200/90 rounded-lg px-3 py-2 text-xs text-blue-800">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Atur Posisi Dokumen:</strong> Tarik & lepas (drag & drop) kartu dokumen atau gunakan tombol panah (◀ / ▶) untuk menentukan urutan penggabungan.
                  </span>
                </div>
              )}

              {/* Area Konten Berkas */}
              {mergeFiles.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center text-gray-400 bg-gray-50/50">
                  <FileText className="w-12 h-12 mx-auto mb-2.5 text-gray-300 stroke-1" />
                  <p className="text-sm font-semibold text-gray-700">Belum Ada Berkas PDF yang Dipilih</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Klik tombol <strong>"Tambah Berkas PDF"</strong> di atas untuk memilih berkas yang ingin digabungkan dan diatur urutannya.
                  </p>
                </div>
              ) : mergeViewMode === 'grid' ? (
                /* ========================================================
                   MODE 1: KARTU PRATINJAU VISUAL (ORGANIZE CARDS)
                   ======================================================== */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[46vh] overflow-y-auto p-1">
                  {mergeFiles.map((item, idx) => (
                    <div
                      key={item.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnter={(e) => handleDragEnter(e, idx)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`group relative bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col cursor-grab active:cursor-grabbing ${
                        draggedIndex === idx
                          ? 'opacity-30 border-dashed border-blue-500 scale-95'
                          : dragOverIndex === idx
                          ? 'border-blue-600 ring-4 ring-blue-300 scale-102 bg-blue-50/20'
                          : 'border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      {/* Header Kartu: Badge Nomor Urut & Tombol Hapus */}
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50/90 border-b border-gray-100">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shadow-2xs">
                            {idx + 1}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {item.pageCount ? `${item.pageCount} hal` : '1 hal'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMergeFiles((prev) => prev.filter((p) => p.id !== item.id))}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Hapus dari daftar gabung"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Area Preview Halaman 1 */}
                      <div className="relative p-2.5 flex items-center justify-center bg-gray-100/70 min-h-[145px] flex-1 pointer-events-none">
                        {item.isLoadingThumb ? (
                          <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-1.5" />
                            <span className="text-[10px]">Membuat pratinjau...</span>
                          </div>
                        ) : item.thumbnailUrl ? (
                          <div className="relative shadow-md rounded overflow-hidden border border-gray-300 bg-white group-hover:scale-102 transition-transform duration-200">
                            <img
                              src={item.thumbnailUrl}
                              alt={item.name}
                              draggable={false}
                              className="max-h-34 w-auto object-contain select-none pointer-events-none"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                            <FileText className="w-10 h-10 text-rose-400 mb-1" />
                            <span className="text-[10px]">Dokumen PDF</span>
                          </div>
                        )}
                      </div>

                      {/* Info Nama Berkas */}
                      <div className="px-2.5 py-2 bg-white border-t border-gray-100">
                        <div className="text-xs font-semibold text-gray-800 truncate" title={item.name}>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {formatFileSize(item.size)}
                        </div>
                      </div>

                      {/* Footer Kontrol Urutan (Maju / Mundur & Handle Drag) */}
                      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50/90 border-t border-gray-100 text-xs">
                        <div className="flex items-center space-x-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveToExtreme(idx, 'start')}
                            className={`p-1 rounded transition ${
                              idx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-700 hover:bg-blue-100'
                            }`}
                            title="Pindah ke posisi paling pertama (Urutan #1)"
                          >
                            <ChevronsLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveMergeItem(idx, idx - 1)}
                            className={`p-1 rounded transition ${
                              idx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-700 hover:bg-blue-100'
                            }`}
                            title="Geser ke urutan sebelumnya (Kiri)"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div
                          className="flex items-center text-gray-400 cursor-grab active:cursor-grabbing px-1"
                          title="Tarik / geser untuk mengatur urutan"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        <div className="flex items-center space-x-0.5">
                          <button
                            type="button"
                            disabled={idx === mergeFiles.length - 1}
                            onClick={() => moveMergeItem(idx, idx + 1)}
                            className={`p-1 rounded transition ${
                              idx === mergeFiles.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-700 hover:bg-blue-100'
                            }`}
                            title="Geser ke urutan berikutnya (Kanan)"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === mergeFiles.length - 1}
                            onClick={() => moveToExtreme(idx, 'end')}
                            className={`p-1 rounded transition ${
                              idx === mergeFiles.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-700 hover:bg-blue-100'
                            }`}
                            title="Pindah ke posisi paling terakhir"
                          >
                            <ChevronsRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ========================================================
                   MODE 2: RINCIAN / LIST BARIS
                   ======================================================== */
                <div className="space-y-1.5 max-h-[46vh] overflow-y-auto p-1">
                  {mergeFiles.map((item, idx) => (
                    <div
                      key={item.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnter={(e) => handleDragEnter(e, idx)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center justify-between p-2.5 bg-white rounded-xl border text-xs shadow-2xs transition cursor-grab active:cursor-grabbing ${
                        draggedIndex === idx
                          ? 'opacity-30 border-dashed border-blue-500 scale-95'
                          : dragOverIndex === idx
                          ? 'border-blue-600 ring-4 ring-blue-300 scale-101 bg-blue-50/30'
                          : 'border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center space-x-3 truncate pointer-events-none">
                        <div className="text-gray-400">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>

                        {/* Mini Thumbnail */}
                        <div className="w-9 h-11 bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" draggable={false} className="w-full h-full object-cover select-none" />
                          ) : (
                            <FileText className="w-4 h-4 text-rose-500" />
                          )}
                        </div>

                        <div className="truncate">
                          <div className="font-semibold text-gray-800 truncate" title={item.name}>
                            {item.name}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {formatFileSize(item.size)} {item.pageCount ? `• ${item.pageCount} halaman` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveMergeItem(idx, idx - 1)}
                          className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Geser ke atas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === mergeFiles.length - 1}
                          onClick={() => moveMergeItem(idx, idx + 1)}
                          className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Geser ke bawah"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <div className="h-4 w-px bg-gray-200 mx-1" />
                        <button
                          type="button"
                          onClick={() => setMergeFiles((prev) => prev.filter((p) => p.id !== item.id))}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition"
                          title="Hapus berkas ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form Input Nama Hasil & Tombol Eksekusi */}
              {mergeFiles.length > 0 && (
                <div className="pt-2 border-t border-gray-200 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nama Berkas Hasil Penggabungan
                    </label>
                    <input
                      type="text"
                      value={mergedPdfName}
                      onChange={(e) => setMergedPdfName(e.target.value)}
                      placeholder="Contoh: Dokumen_Gabungan.pdf"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition shadow-2xs"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-1">
                    <button
                      type="button"
                      disabled={isLoading || mergeFiles.length < 2}
                      onClick={() => handleStartMerge(true)}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sedang Menggabungkan PDF...</span>
                        </>
                      ) : (
                        <>
                          <FolderInput className="w-4 h-4" />
                          <span>Gabung & Simpan ke Explorer ({mergeFiles.length} File)</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isLoading || mergeFiles.length < 2}
                      onClick={() => handleStartMerge(false)}
                      className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh Langsung</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'split' ? (
            /* ========================================================
               TAB 2: PISAH PDF (SPLIT)
               ======================================================== */
            <div className="space-y-4">
              {!splitFile ? (
                <label className="border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition bg-gray-50/50 hover:bg-amber-50/20">
                  <Scissors className="w-12 h-12 text-amber-500 mb-2.5 stroke-1" />
                  <span className="text-sm font-semibold text-gray-800">Pilih Berkas PDF yang Ingin Dipisahkan</span>
                  <span className="text-xs text-gray-400 mt-1">Ekstrak halaman tertentu menjadi berkas PDF baru</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => e.target.files && setSplitFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <FileText className="w-5 h-5 text-rose-600" />
                      <div>
                        <div className="font-semibold text-gray-800">{splitFile.name}</div>
                        <div className="text-[10px] text-gray-400">{formatFileSize(splitFile.size)}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSplitFile(null)}
                      className="text-red-600 hover:underline text-xs font-medium"
                    >
                      Ganti Berkas
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Rentang Halaman yang Ingin Diekstrak (misal: 1-3, 5)
                    </label>
                    <input
                      type="text"
                      value={pageRangeStr}
                      onChange={(e) => setPageRangeStr(e.target.value)}
                      placeholder="Contoh: 1-2 atau 1, 3, 5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                    />
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleStartSplit(true)}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
                      <span>Pisah & Simpan ke Explorer</span>
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleStartSplit(false)}
                      className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================
               TAB 3: PUTAR HALAMAN (ROTATE)
               ======================================================== */
            <div className="space-y-4">
              {!rotateFile ? (
                <label className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition bg-gray-50/50 hover:bg-indigo-50/20">
                  <RotateCw className="w-12 h-12 text-indigo-500 mb-2.5 stroke-1" />
                  <span className="text-sm font-semibold text-gray-800">Pilih Berkas PDF yang Ingin Diputar</span>
                  <span className="text-xs text-gray-400 mt-1">Ubah orientasi seluruh halaman dokumen PDF</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => e.target.files && setRotateFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <FileText className="w-5 h-5 text-rose-600" />
                      <div>
                        <div className="font-semibold text-gray-800">{rotateFile.name}</div>
                        <div className="text-[10px] text-gray-400">{formatFileSize(rotateFile.size)}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRotateFile(null)}
                      className="text-red-600 hover:underline text-xs font-medium"
                    >
                      Ganti Berkas
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Sudut Putaran:</label>
                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      {[
                        { label: 'Putar 90° Kanan', deg: 90 },
                        { label: 'Putar 180° Balik', deg: 180 },
                        { label: 'Putar 270° Kiri', deg: 270 }
                      ].map((item) => (
                        <button
                          key={item.deg}
                          type="button"
                          onClick={() => setRotateDeg(item.deg)}
                          className={`p-3 rounded-xl border text-center font-medium transition ${
                            rotateDeg === item.deg
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold shadow-2xs'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleStartRotate(true)}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
                      <span>Putar & Simpan ke Explorer</span>
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleStartRotate(false)}
                      className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};