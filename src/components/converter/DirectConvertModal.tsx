import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Folder,
  ArrowRight,
  Settings,
  Layers,
  Sparkles
} from 'lucide-react';
import { VirtualFile } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { convertPdfToJpg, convertJpgToPdf, generatePdfThumbnail, JpgToPdfOptions } from '../../services/pdfService';
import { cloudFileService } from '../../services/cloudFileService';

export interface DirectConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'pdf-to-jpg' | 'jpg-to-pdf';
  targetFiles: VirtualFile[];
  destinationFolderId: string | null;
  destinationFolderName: string;
  addFile: (
    file: Omit<VirtualFile, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { skipRefresh?: boolean; onProgress?: (percent: number) => void }
  ) => Promise<VirtualFile>;
  refreshAll: () => Promise<void>;
}

export const DirectConvertModal: React.FC<DirectConvertModalProps> = ({
  isOpen,
  onClose,
  type,
  targetFiles,
  destinationFolderId,
  destinationFolderName,
  addFile,
  refreshAll
}) => {
  // Conversion state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [createdFilesCount, setCreatedFilesCount] = useState(0);

  // PDF -> JPG settings
  const [dpi, setDpi] = useState<number>(150);

  // JPG -> PDF settings
  const [outputPdfName, setOutputPdfName] = useState('');
  const [pageSize, setPageSize] = useState<'A4' | 'Fit' | 'Letter'>('A4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [margin, setMargin] = useState<'none' | 'small' | 'standard'>('none');

  // Reset or initialize when modal opens or files change
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      setProgressPercent(0);
      setStatusMessage('');
      setErrorMessage(null);
      setIsDone(false);
      setCreatedFilesCount(0);

      // Default output name for JPG -> PDF
      if (type === 'jpg-to-pdf' && targetFiles.length > 0) {
        if (targetFiles.length === 1) {
          const base = targetFiles[0].name.replace(/\.[^/.]+$/, '');
          setOutputPdfName(`${base}.pdf`);
        } else {
          const base = targetFiles[0].name.replace(/\.[^/.]+$/, '');
          setOutputPdfName(`${base}_Gabungan_${targetFiles.length}_Gambar.pdf`);
        }
      }
    }
  }, [isOpen, type, targetFiles]);

  if (!isOpen) return null;

  const isPdfToJpg = type === 'pdf-to-jpg';

  const handleStartConversion = async () => {
    if (targetFiles.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(5);
    setStatusMessage('Mempersiapkan berkas untuk konversi...');

    try {
      if (isPdfToJpg) {
        // --- 1. KONVERSI PDF KE JPG ---
        let totalCreated = 0;
        const totalPdfs = targetFiles.length;

        for (let fileIdx = 0; fileIdx < totalPdfs; fileIdx++) {
          const vFile = targetFiles[fileIdx];
          setStatusMessage(`Mengambil data: ${vFile.name}...`);
          setProgressPercent(Math.round(((fileIdx) / totalPdfs) * 40) + 10);

          // Ambil Blob (dari memory atau VPS jika file cloud)
          let blob = vFile.blob;
          if (!blob) {
            const fetched = await cloudFileService.fetchFileBlob(vFile.id);
            if (!fetched) {
              throw new Error(`Gagal memuat berkas ${vFile.name} dari server.`);
            }
            blob = fetched;
          }

          setStatusMessage(`Mengekstrak halaman gambar dari: ${vFile.name}...`);
          const pages = await convertPdfToJpg(blob, dpi, undefined, (curr, total, msg) => {
            const subPercent = Math.round((curr / total) * 40);
            const basePercent = Math.round((fileIdx / totalPdfs) * 50) + 10;
            setProgressPercent(basePercent + subPercent);
            setStatusMessage(`${vFile.name}: Halaman ${curr} dari ${total}...`);
          });

          const baseName = vFile.name.replace(/\.[^/.]+$/, '');

          // Simpan setiap halaman JPG ke folder saat ini (destinationFolderId)
          for (let pIdx = 0; pIdx < pages.length; pIdx++) {
            const page = pages[pIdx];
            const pageName = `${baseName}_Hal_${page.pageNumber}.jpg`;
            setStatusMessage(`Menyimpan: ${pageName} ke folder...`);

            await addFile(
              {
                name: pageName,
                parentId: destinationFolderId,
                type: 'jpg',
                isFolder: false,
                size: page.blob.size,
                blob: page.blob,
                thumbnail: page.dataUrl,
                colorTag: '#10b981'
              },
              { skipRefresh: true }
            );

            totalCreated++;
          }
        }

        setStatusMessage('Menyinkronkan daftar berkas...');
        setProgressPercent(95);
        await refreshAll();

        setCreatedFilesCount(totalCreated);
        setProgressPercent(100);
        setIsDone(true);
        setIsProcessing(false);
      } else {
        // --- 2. KONVERSI JPG/PNG KE PDF ---
        let finalPdfName = outputPdfName.trim();
        if (!finalPdfName) {
          finalPdfName = 'Hasil_Konversi.pdf';
        }
        if (!finalPdfName.toLowerCase().endsWith('.pdf')) {
          finalPdfName += '.pdf';
        }

        const imageBlobs: Blob[] = [];
        const totalImages = targetFiles.length;

        for (let i = 0; i < totalImages; i++) {
          const vFile = targetFiles[i];
          setStatusMessage(`Membaca gambar (${i + 1}/${totalImages}): ${vFile.name}...`);
          setProgressPercent(Math.round(((i + 1) / totalImages) * 40));

          let blob = vFile.blob;
          if (!blob) {
            const fetched = await cloudFileService.fetchFileBlob(vFile.id);
            if (!fetched) {
              throw new Error(`Gagal memuat gambar ${vFile.name} dari server.`);
            }
            blob = fetched;
          }
          imageBlobs.push(blob);
        }

        setStatusMessage('Menyatukan gambar menjadi dokumen PDF...');
        setProgressPercent(50);

        const pdfOptions: JpgToPdfOptions = {
          pageSize,
          orientation,
          margin
        };

        const pdfBlob = await convertJpgToPdf(imageBlobs, pdfOptions);

        setStatusMessage('Membuat thumbnail pratinjau dokumen PDF...');
        setProgressPercent(75);
        let thumbnail: string | undefined = undefined;
        try {
          thumbnail = await generatePdfThumbnail(pdfBlob);
        } catch (e) {
          console.warn('Gagal generate thumbnail:', e);
        }

        setStatusMessage(`Menyimpan ${finalPdfName} ke folder...`);
        setProgressPercent(85);

        await addFile(
          {
            name: finalPdfName,
            parentId: destinationFolderId,
            type: 'pdf',
            isFolder: false,
            size: pdfBlob.size,
            blob: pdfBlob,
            thumbnail,
            colorTag: '#3b82f6'
          },
          { skipRefresh: false }
        );

        setCreatedFilesCount(1);
        setProgressPercent(100);
        setStatusMessage('Konversi berhasil diselesaikan!');
        setIsDone(true);
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('Konversi langsung gagal:', err);
      setErrorMessage(err?.message || 'Terjadi kesalahan saat mengonversi berkas.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 via-white to-gray-50">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                isPdfToJpg ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
              }`}
            >
              {isPdfToJpg ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-gray-800 text-base">
                  {isPdfToJpg ? 'Konversi PDF ke Gambar JPG' : 'Konversi Gambar ke PDF'}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isPdfToJpg
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  Langsung di Folder
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isPdfToJpg
                  ? 'Ubah halaman PDF menjadi gambar JPG resolusi jernih'
                  : 'Gabungkan gambar menjadi dokumen PDF terstruktur'}
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Destination Folder Banner */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Folder className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-emerald-700 block">
                Lokasi Penyimpanan Hasil:
              </span>
              <p className="text-xs font-semibold text-emerald-950 truncate">
                📁 {destinationFolderName || 'Beranda Dokumen'}
              </p>
            </div>
          </div>

          {/* Target Files List */}
          <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/60">
            <div className="text-[11px] font-semibold text-gray-600 mb-2 flex items-center justify-between">
              <span>Berkas yang Dipilih ({targetFiles.length}):</span>
              <span className="text-gray-400 font-normal">
                {formatBytes(targetFiles.reduce((acc, f) => acc + (f.size || 0), 0))}
              </span>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
              {targetFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs shadow-xs"
                >
                  <div className="flex items-center space-x-2 truncate">
                    {f.type === 'pdf' || f.name.toLowerCase().endsWith('.pdf') ? (
                      <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                    <span className="font-medium text-gray-700 truncate">{f.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                    {formatBytes(f.size || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Options / Settings */}
          {!isDone && (
            <div className="space-y-3 pt-1">
              {isPdfToJpg ? (
                // Opsi PDF -> JPG
                <div>
                  <label className="text-xs font-semibold text-gray-700 flex items-center space-x-1.5 mb-2">
                    <Settings className="w-3.5 h-3.5 text-gray-500" />
                    <span>Resolusi Gambar (DPI):</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setDpi(150)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        dpi === 150
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-1 ring-emerald-500'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="font-semibold text-xs">150 DPI (Standar)</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Ukuran pas & proses sangat cepat
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setDpi(300)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        dpi === 300
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-1 ring-emerald-500'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="font-semibold text-xs">300 DPI (HD Tinggi)</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Teks tajam sempurna untuk cetak
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                // Opsi JPG -> PDF
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                      Nama Berkas PDF Baru:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={isProcessing}
                        value={outputPdfName}
                        onChange={(e) => setOutputPdfName(e.target.value)}
                        placeholder="Masukkan nama berkas..."
                        className="w-full text-xs font-medium px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                        .pdf
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                        Ukuran Kertas:
                      </label>
                      <select
                        disabled={isProcessing}
                        value={pageSize}
                        onChange={(e) => setPageSize(e.target.value as any)}
                        className="w-full text-xs p-1.5 border border-gray-200 rounded-lg bg-white"
                      >
                        <option value="A4">A4 (Standar)</option>
                        <option value="Fit">Fit (Ukuran Asli)</option>
                        <option value="Letter">Letter</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                        Orientasi:
                      </label>
                      <select
                        disabled={isProcessing}
                        value={orientation}
                        onChange={(e) => setOrientation(e.target.value as any)}
                        className="w-full text-xs p-1.5 border border-gray-200 rounded-lg bg-white"
                      >
                        <option value="auto">Auto (Otomatis)</option>
                        <option value="portrait">Tegak (Portrait)</option>
                        <option value="landscape">Mendatar</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                        Margin:
                      </label>
                      <select
                        disabled={isProcessing}
                        value={margin}
                        onChange={(e) => setMargin(e.target.value as any)}
                        className="w-full text-xs p-1.5 border border-gray-200 rounded-lg bg-white"
                      >
                        <option value="none">Tanpa Margin</option>
                        <option value="small">Sedang (0.25")</option>
                        <option value="standard">Standar (0.5")</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing / Progress State */}
          {isProcessing && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 font-medium text-blue-800">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="truncate max-w-[260px]">{statusMessage}</span>
                </div>
                <span className="font-bold text-blue-700">{progressPercent}%</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Gagal Melakukan Konversi</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Success State */}
          {isDone && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-2 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-emerald-900 text-sm">Konversi Selesai!</h4>
                <p className="text-xs text-emerald-700 mt-1">
                  {isPdfToJpg
                    ? `Berhasil membuat ${createdFilesCount} berkas gambar JPG di folder ini.`
                    : `Berhasil membuat berkas PDF baru di folder ini.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200/70 rounded-xl transition"
          >
            {isDone ? 'Tutup' : 'Batal'}
          </button>

          {!isDone ? (
            <button
              type="button"
              disabled={isProcessing || targetFiles.length === 0}
              onClick={handleStartConversion}
              className={`flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-md transition ${
                isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : isPdfToJpg
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 active:scale-98'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 active:scale-98'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Mulai Konversi {isPdfToJpg ? 'ke JPG' : 'ke PDF'}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Selesai & Lihat Berkas</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
