import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  ArrowRightLeft,
  Upload,
  Download,
  Check,
  FolderInput,
  Loader2,
  Trash2,
  MoveUp,
  MoveDown,
  Plus,
  CheckCircle2
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { convertPdfToJpg, convertJpgToPdf, JpgToPdfOptions } from '../../services/pdfService';
import { VirtualFile } from '../../types';

interface ConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToExplorer: (
    file: Omit<VirtualFile, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { skipRefresh?: boolean }
  ) => Promise<any>;
  onCreateFolder?: (name: string, parentId?: string | null, colorTag?: string) => Promise<VirtualFile>;
  onNavigateToFolder?: (folderId: string | null) => void;
}

export const ConverterModal: React.FC<ConverterModalProps> = ({
  isOpen,
  onClose,
  onSaveToExplorer,
  onCreateFolder,
  onNavigateToFolder
}) => {
  const [activeTab, setActiveTab] = useState<'pdf-to-jpg' | 'jpg-to-pdf'>('pdf-to-jpg');

  // State PDF to JPG
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDpi, setPdfDpi] = useState<number>(150);
  const [pdfResults, setPdfResults] = useState<{ pageNumber: number; blob: Blob; dataUrl: string }[]>([]);
  const [isConvertingPdf, setIsConvertingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<string>('');

  // State JPG to PDF
  const [jpgImages, setJpgImages] = useState<{ id: string; name: string; file: File; previewUrl: string }[]>([]);
  const [pdfOptions, setPdfOptions] = useState<JpgToPdfOptions>({
    pageSize: 'A4',
    orientation: 'auto',
    margin: 'none'
  });
  const [outputPdfName, setOutputPdfName] = useState<string>('Dokumen_Konversi.pdf');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // State indikator proses simpan ke File Explorer
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<{
    current: number;
    total: number;
    message: string;
    isDone?: boolean;
    folderName?: string;
  }>({ current: 0, total: 0, message: '', isDone: false });

  // Reset form saat modal dibuka kembali
  const resetForm = () => {
    setPdfFile(null);
    setPdfResults([]);
    setPdfProgress('');
    setIsConvertingPdf(false);
    setJpgImages([]);
    setOutputPdfName('Dokumen_Konversi.pdf');
    setIsGeneratingPdf(false);
    setIsSaving(false);
    setSaveProgress({ current: 0, total: 0, message: '', isDone: false });
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // Handler PDF to JPG
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
      setPdfResults([]);
    }
  };

  const handleStartPdfToJpg = async () => {
    if (!pdfFile) return;
    setIsConvertingPdf(true);
    try {
      const results = await convertPdfToJpg(pdfFile, pdfDpi, undefined, (curr, total, msg) => {
        setPdfProgress(msg);
      });
      setPdfResults(results);
    } catch (err) {
      alert('Gagal mengonversi PDF: ' + (err as Error).message);
    } finally {
      setIsConvertingPdf(false);
      setPdfProgress('');
    }
  };

  const handleDownloadAllZip = async () => {
    if (pdfResults.length === 0 || !pdfFile) return;
    const zip = new JSZip();
    const baseName = pdfFile.name.replace(/\.pdf$/i, '');

    pdfResults.forEach((item) => {
      zip.file(`${baseName}_Hal_${item.pageNumber}.jpg`, item.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `${baseName}.zip`);
  };

  const handleSaveJpgToExplorer = async () => {
    if (pdfResults.length === 0 || !pdfFile || isSaving) return;
    const baseName = pdfFile.name.replace(/\.pdf$/i, '');

    setIsSaving(true);
    setSaveProgress({
      current: 0,
      total: pdfResults.length,
      message: `Menyiapkan folder "${baseName}"...`,
      isDone: false,
      folderName: baseName
    });

    try {
      // 1. Buat 1 folder baru otomatis khusus untuk hasil konversi PDF ini
      let targetFolderId = 'folder-converted';
      if (onCreateFolder) {
        setSaveProgress({
          current: 0,
          total: pdfResults.length,
          message: `Membuat folder "${baseName}" di Hasil Konversi...`,
          isDone: false,
          folderName: baseName
        });
        const newFolder = await onCreateFolder(baseName, 'folder-converted', '#10b981');
        targetFolderId = newFolder.id;
      }

      // 2. Simpan setiap file JPG ke dalam folder baru tersebut secara berurutan
      for (let i = 0; i < pdfResults.length; i++) {
        const item = pdfResults[i];
        setSaveProgress({
          current: i + 1,
          total: pdfResults.length,
          message: `Menyimpan & mengunggah Halaman ${item.pageNumber} dari ${pdfResults.length}...`,
          isDone: false,
          folderName: baseName
        });

        await onSaveToExplorer(
          {
            name: `${baseName}_Hal_${item.pageNumber}.jpg`,
            parentId: targetFolderId,
            type: 'jpg',
            isFolder: false,
            size: item.blob.size,
            blob: item.blob,
            thumbnail: item.dataUrl,
            pageCount: 1,
            colorTag: '#10b981'
          },
          { skipRefresh: i < pdfResults.length - 1 }
        );
      }

      // Arahkan tampilan explorer langsung masuk ke folder yang baru dibuat
      if (onNavigateToFolder) {
        onNavigateToFolder(targetFolderId);
      }

      // 3. Tampilkan status selesai
      setSaveProgress({
        current: pdfResults.length,
        total: pdfResults.length,
        message: `Selesai! Seluruh berkas berhasil disimpan.`,
        isDone: true,
        folderName: baseName
      });

      setTimeout(() => {
        resetForm();
        onClose();
      }, 1200);
    } catch (err: any) {
      alert('Gagal menyimpan ke File Explorer: ' + (err?.message || 'Terjadi kesalahan'));
      setIsSaving(false);
    }
  };

  // Handler JPG to PDF
  const handleJpgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map((file) => ({
        id: 'img-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        name: file.name,
        file,
        previewUrl: URL.createObjectURL(file)
      }));
      setJpgImages((prev) => [...prev, ...newItems]);
    }
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= jpgImages.length) return;
    const updated = [...jpgImages];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setJpgImages(updated);
  };

  const removeImage = (id: string) => {
    setJpgImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleStartJpgToPdf = async (saveToFolder: boolean = true) => {
    if (jpgImages.length === 0 || isSaving) return;
    setIsGeneratingPdf(true);
    try {
      const blobs = jpgImages.map((item) => item.file);
      const pdfBlob = await convertJpgToPdf(blobs, pdfOptions);
      const finalName = outputPdfName.endsWith('.pdf') ? outputPdfName : outputPdfName + '.pdf';

      if (saveToFolder) {
        setIsSaving(true);
        setSaveProgress({
          current: 1,
          total: 1,
          message: `Menyimpan berkas "${finalName}" ke folder Hasil Konversi...`,
          isDone: false,
          folderName: 'Hasil Konversi'
        });

        await onSaveToExplorer({
          name: finalName,
          parentId: 'folder-converted',
          type: 'pdf',
          isFolder: false,
          size: pdfBlob.size,
          blob: pdfBlob,
          thumbnail: jpgImages[0].previewUrl,
          pageCount: jpgImages.length,
          colorTag: '#10b981'
        });

        setSaveProgress({
          current: 1,
          total: 1,
          message: `Selesai! Berkas PDF berhasil disimpan.`,
          isDone: true,
          folderName: 'Hasil Konversi'
        });

        if (onNavigateToFolder) {
          onNavigateToFolder('folder-converted');
        }

        setTimeout(() => {
          resetForm();
          onClose();
        }, 1200);
      } else {
        saveAs(pdfBlob, finalName);
      }
    } catch (err) {
      alert('Gagal membuat PDF: ' + (err as Error).message);
      setIsSaving(false);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Loading & Progress Overlay Saat Menyimpan ke File Explorer */}
        {isSaving && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 select-none">
            {!saveProgress.isDone ? (
              <div className="flex flex-col items-center max-w-sm">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border-2 border-emerald-100 shadow-inner mb-4">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>

                <h4 className="text-base font-bold text-gray-800 mb-1">
                  Menyimpan ke File Explorer
                </h4>
                <p className="text-xs text-gray-600 mb-4 font-medium px-2">
                  {saveProgress.message}
                </p>

                {/* Progress Bar & Percentage */}
                <div className="w-72 bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200 shadow-inner mb-2">
                  <div
                    className="bg-emerald-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${Math.round(((saveProgress.current) / (saveProgress.total || 1)) * 100)}%`
                    }}
                  />
                </div>

                <div className="flex justify-between w-72 text-xs text-gray-500 font-mono mb-4">
                  <span>Halaman {saveProgress.current} dari {saveProgress.total}</span>
                  <span className="font-semibold text-emerald-700">
                    {Math.round(((saveProgress.current) / (saveProgress.total || 1)) * 100)}%
                  </span>
                </div>

                <p className="text-[11px] text-gray-400">
                  Menyimpan ke IndexedDB dan menyinkronkan ke Cloud VPS...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-md">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-base font-bold text-gray-800 mb-1">
                  Berhasil Disimpan!
                </h4>
                <p className="text-xs text-gray-600 max-w-sm mb-2">
                  Folder <strong>"{saveProgress.folderName}"</strong> beserta <strong>{saveProgress.total} berkas</strong> telah tersimpan di File Explorer.
                </p>
                <span className="text-xs text-emerald-600 font-medium animate-pulse">
                  Membuka folder di File Explorer...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-[#fafafa]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">
              Universal Document Converter
            </h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 bg-gray-50/70 px-4 pt-2">
          <button
            onClick={() => setActiveTab('pdf-to-jpg')}
            className={`flex items-center space-x-2 py-2 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'pdf-to-jpg'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileText className="w-4 h-4 text-rose-500" />
            <span>PDF to JPG</span>
          </button>

          <button
            onClick={() => setActiveTab('jpg-to-pdf')}
            className={`flex items-center space-x-2 py-2 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'jpg-to-pdf'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-blue-500" />
            <span>JPG to PDF</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'pdf-to-jpg' ? (
            // Panel PDF to JPG
            <div className="space-y-4">
              {!pdfFile ? (
                <label className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-gray-50/50 hover:bg-emerald-50/20">
                  <FileText className="w-12 h-12 text-rose-500 mb-2 stroke-1" />
                  <span className="text-sm font-semibold text-gray-800">Pilih Berkas PDF</span>
                  <span className="text-xs text-gray-400 mt-1">Klik di sini atau tarik file PDF ke area ini</span>
                  <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-rose-600" />
                      <div>
                        <div className="font-semibold text-gray-800">{pdfFile.name}</div>
                        <div className="text-[11px] text-gray-500">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setPdfFile(null);
                        setPdfResults([]);
                      }}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Ganti Berkas
                    </button>
                  </div>

                  {/* Resolution / DPI */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-xs">
                    <span className="font-medium text-gray-700">Kualitas & Resolusi Ekspor:</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setPdfDpi(150)}
                        className={`px-3 py-1 rounded-md text-xs font-medium border ${
                          pdfDpi === 150 ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        Standar (150 DPI)
                      </button>
                      <button
                        onClick={() => setPdfDpi(300)}
                        className={`px-3 py-1 rounded-md text-xs font-medium border ${
                          pdfDpi === 300 ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        Cetak Tajam (300 DPI)
                      </button>
                    </div>
                  </div>

                  {/* Start Button */}
                  {pdfResults.length === 0 && (
                    <button
                      disabled={isConvertingPdf}
                      onClick={handleStartPdfToJpg}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition shadow"
                    >
                      {isConvertingPdf ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{pdfProgress || 'Mengonversi PDF ke JPG...'}</span>
                        </>
                      ) : (
                        <span>Mulai Konversi ke JPG</span>
                      )}
                    </button>
                  )}

                  {/* Results Gallery */}
                  {pdfResults.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">
                          Hasil Konversi ({pdfResults.length} Halaman)
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={resetForm}
                            className="flex items-center space-x-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-medium transition"
                            title="Konversi berkas PDF baru"
                          >
                            <Plus className="w-3.5 h-3.5 text-blue-600" />
                            <span>Berkas Baru</span>
                          </button>
                          <button
                            onClick={handleDownloadAllZip}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-medium transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download ZIP</span>
                          </button>
                          <button
                            onClick={handleSaveJpgToExplorer}
                            disabled={isSaving}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-md text-xs font-medium transition shadow cursor-pointer disabled:cursor-not-allowed"
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Menyimpan ({saveProgress.current}/{saveProgress.total})...</span>
                              </>
                            ) : (
                              <>
                                <FolderInput className="w-3.5 h-3.5" />
                                <span>Simpan ke File Explorer</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-60 overflow-y-auto p-1">
                        {pdfResults.map((r) => (
                          <div key={r.pageNumber} className="relative border border-gray-200 rounded-lg p-1 bg-white">
                            <img src={r.dataUrl} alt={`Page ${r.pageNumber}`} className="w-full h-28 object-contain rounded" />
                            <span className="block text-center text-[10px] text-gray-500 mt-1 font-mono">
                              Halaman {r.pageNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Panel JPG to PDF
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium cursor-pointer shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>+ Tambah Gambar</span>
                  <input type="file" multiple accept="image/*" onChange={handleJpgUpload} className="hidden" />
                </label>
                <span className="text-xs text-gray-500">
                  {jpgImages.length} gambar terpilih
                </span>
              </div>

              {jpgImages.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center text-gray-400">
                  <ImageIcon className="w-12 h-12 mb-2 stroke-1 text-gray-300" />
                  <span className="text-xs">Belum ada gambar yang dipilih</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Image list reorder */}
                  <div className="max-h-52 overflow-y-auto space-y-1.5 border border-gray-200 rounded-lg p-2 bg-gray-50">
                    {jpgImages.map((img, idx) => (
                      <div key={img.id} className="flex items-center justify-between p-1.5 bg-white rounded border border-gray-200 text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 text-center font-mono text-gray-400 font-semibold">{idx + 1}</span>
                          <img src={img.previewUrl} alt={img.name} className="w-8 h-8 object-cover rounded" />
                          <span className="truncate max-w-xs text-gray-700">{img.name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => moveImage(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 rounded"
                          >
                            <MoveUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveImage(idx, 'down')}
                            disabled={idx === jpgImages.length - 1}
                            className="p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 rounded"
                          >
                            <MoveDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removeImage(img.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg text-xs">
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Ukuran Kertas</label>
                      <select
                        value={pdfOptions.pageSize}
                        onChange={(e) => setPdfOptions({ ...pdfOptions, pageSize: e.target.value as any })}
                        className="w-full p-1.5 bg-white border border-gray-300 rounded focus:outline-none"
                      >
                        <option value="A4">A4 (Standar)</option>
                        <option value="Letter">Letter</option>
                        <option value="Fit">Sesuai Ukuran Gambar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Orientasi</label>
                      <select
                        value={pdfOptions.orientation}
                        onChange={(e) => setPdfOptions({ ...pdfOptions, orientation: e.target.value as any })}
                        className="w-full p-1.5 bg-white border border-gray-300 rounded focus:outline-none"
                      >
                        <option value="auto">Otomatis (Deteksi)</option>
                        <option value="portrait">Tegak (Portrait)</option>
                        <option value="landscape">Mendatar (Landscape)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">Margin Dokumen</label>
                      <select
                        value={pdfOptions.margin}
                        onChange={(e) => setPdfOptions({ ...pdfOptions, margin: e.target.value as any })}
                        className="w-full p-1.5 bg-white border border-gray-300 rounded focus:outline-none"
                      >
                        <option value="none">Tanpa Margin</option>
                        <option value="small">Margin Tipis</option>
                        <option value="standard">Margin Standar</option>
                      </select>
                    </div>
                  </div>

                  {/* Output Name & Actions */}
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nama Dokumen PDF</label>
                    <input
                      type="text"
                      value={outputPdfName}
                      onChange={(e) => setOutputPdfName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 mb-3"
                    />

                    <div className="flex space-x-2">
                      <button
                        disabled={isGeneratingPdf || isSaving}
                        onClick={() => handleStartJpgToPdf(true)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition shadow cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isGeneratingPdf || isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
                        <span>Simpan ke Explorer</span>
                      </button>

                      <button
                        disabled={isGeneratingPdf || isSaving}
                        onClick={() => handleStartJpgToPdf(false)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Unduh Langsung</span>
                      </button>
                    </div>
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
