import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Scissors,
  RotateCw,
  Upload,
  Plus,
  Trash2,
  FolderInput,
  Download,
  Loader2,
  FileText
} from 'lucide-react';
import { mergePdfFiles, splitPdf, rotatePdf } from '../../services/pdfService';
import { VirtualFile } from '../../types';
import { saveAs } from 'file-saver';

interface PdfToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToExplorer: (file: Omit<VirtualFile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any>;
}

export const PdfToolsModal: React.FC<PdfToolsModalProps> = ({
  isOpen,
  onClose,
  onSaveToExplorer
}) => {
  const [activeTab, setActiveTab] = useState<'merge' | 'split' | 'rotate'>('merge');

  // Merge state
  const [mergeFiles, setMergeFiles] = useState<{ id: string; name: string; file: File }[]>([]);
  const [mergedPdfName, setMergedPdfName] = useState<string>('Dokumen_Gabungan.pdf');

  // Split state
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [pageRangeStr, setPageRangeStr] = useState<string>('1-2');

  // Rotate state
  const [rotateFile, setRotateFile] = useState<File | null>(null);
  const [rotateDeg, setRotateDeg] = useState<number>(90);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setMergeFiles([]);
      setSplitFile(null);
      setRotateFile(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Merge
  const handleAddMergeFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map((f) => ({
        id: 'pdf-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        name: f.name,
        file: f
      }));
      setMergeFiles((prev) => [...prev, ...newItems]);
    }
  };

  const handleStartMerge = async (saveToFolder: boolean = true) => {
    if (mergeFiles.length < 2) {
      alert('Pilih minimal 2 file PDF untuk digabungkan.');
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
          parentId: 'folder-my-docs',
          type: 'pdf',
          isFolder: false,
          size: resBlob.size,
          blob: resBlob,
          colorTag: '#3b82f6'
        });
        alert('File PDF berhasil digabungkan dan disimpan!');
        onClose();
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
      // Parse range string (misal: "1-3, 5") ke array 0-indexed
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
          parentId: 'folder-my-docs',
          type: 'pdf',
          isFolder: false,
          size: resBlob.size,
          blob: resBlob,
          colorTag: '#3b82f6'
        });
        alert('File PDF berhasil dipisahkan dan disimpan!');
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
          parentId: 'folder-my-docs',
          type: 'pdf',
          isFolder: false,
          size: resBlob.size,
          blob: resBlob,
          colorTag: '#3b82f6'
        });
        alert('File PDF berhasil diputar dan disimpan!');
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-[#fafafa]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">
              PDF Toolkit (Merge, Split & Rotate)
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/70 px-4 pt-2">
          <button
            onClick={() => setActiveTab('merge')}
            className={`flex items-center space-x-1.5 py-2 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'merge'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Gabung PDF (Merge)</span>
          </button>

          <button
            onClick={() => setActiveTab('split')}
            className={`flex items-center space-x-1.5 py-2 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'split'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Scissors className="w-4 h-4 text-amber-600" />
            <span>Pisah PDF (Split)</span>
          </button>

          <button
            onClick={() => setActiveTab('rotate')}
            className={`flex items-center space-x-1.5 py-2 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'rotate'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <RotateCw className="w-4 h-4 text-indigo-600" />
            <span>Putar Halaman (Rotate)</span>
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'merge' ? (
            // Merge Panel
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium cursor-pointer shadow-xs">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Berkas PDF</span>
                  <input type="file" multiple accept=".pdf" onChange={handleAddMergeFiles} className="hidden" />
                </label>
                <span className="text-xs text-gray-500">{mergeFiles.length} file dipilih</span>
              </div>

              {mergeFiles.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <span className="text-xs">Pilih minimal 2 file PDF untuk digabungkan</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-52 overflow-y-auto space-y-1.5 border border-gray-200 rounded-lg p-2 bg-gray-50">
                    {mergeFiles.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-xs">
                        <div className="flex items-center space-x-2 truncate">
                          <span className="w-5 text-center font-mono text-gray-400 font-semibold">{idx + 1}</span>
                          <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="truncate text-gray-700">{item.name}</span>
                        </div>
                        <button
                          onClick={() => setMergeFiles((prev) => prev.filter((p) => p.id !== item.id))}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nama File Hasil</label>
                    <input
                      type="text"
                      value={mergedPdfName}
                      onChange={(e) => setMergedPdfName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 mb-3"
                    />

                    <div className="flex space-x-2">
                      <button
                        disabled={isLoading || mergeFiles.length < 2}
                        onClick={() => handleStartMerge(true)}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
                        <span>Gabung & Simpan ke Explorer</span>
                      </button>
                      <button
                        disabled={isLoading || mergeFiles.length < 2}
                        onClick={() => handleStartMerge(false)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Unduh</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'split' ? (
            // Split Panel
            <div className="space-y-4">
              {!splitFile ? (
                <label className="border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-gray-50/50 hover:bg-amber-50/20">
                  <Scissors className="w-10 h-10 text-amber-500 mb-2 stroke-1" />
                  <span className="text-sm font-semibold text-gray-800">Pilih Berkas PDF yang Ingin Dipisah</span>
                  <input type="file" accept=".pdf" onChange={(e) => e.target.files && setSplitFile(e.target.files[0])} className="hidden" />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-rose-600" />
                      <div className="font-semibold text-gray-800">{splitFile.name}</div>
                    </div>
                    <button onClick={() => setSplitFile(null)} className="text-red-600 hover:underline text-xs">Ganti</button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Rentang Halaman yang Ingin Diekstrak (misal: 1-3, 5)
                    </label>
                    <input
                      type="text"
                      value={pageRangeStr}
                      onChange={(e) => setPageRangeStr(e.target.value)}
                      placeholder="Contoh: 1-2 atau 1, 3, 5"
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      disabled={isLoading}
                      onClick={() => handleStartSplit(true)}
                      className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
                      <span>Pisah & Simpan ke Explorer</span>
                    </button>
                    <button
                      disabled={isLoading}
                      onClick={() => handleStartSplit(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Rotate Panel
            <div className="space-y-4">
              {!rotateFile ? (
                <label className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-gray-50/50 hover:bg-indigo-50/20">
                  <RotateCw className="w-10 h-10 text-indigo-500 mb-2 stroke-1" />
                  <span className="text-sm font-semibold text-gray-800">Pilih Berkas PDF yang Ingin Diputar</span>
                  <input type="file" accept=".pdf" onChange={(e) => e.target.files && setRotateFile(e.target.files[0])} className="hidden" />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-rose-600" />
                      <div className="font-semibold text-gray-800">{rotateFile.name}</div>
                    </div>
                    <button onClick={() => setRotateFile(null)} className="text-red-600 hover:underline text-xs">Ganti</button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Sudut Putaran:</label>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        { label: 'Putar 90° Kanan', deg: 90 },
                        { label: 'Putar 180° Balik', deg: 180 },
                        { label: 'Putar 270° Kiri', deg: 270 }
                      ].map((item) => (
                        <button
                          key={item.deg}
                          onClick={() => setRotateDeg(item.deg)}
                          className={`p-2.5 rounded-lg border text-center font-medium transition ${
                            rotateDeg === item.deg
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
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
                      disabled={isLoading}
                      onClick={() => handleStartRotate(true)}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
                      <span>Putar & Simpan ke Explorer</span>
                    </button>
                    <button
                      disabled={isLoading}
                      onClick={() => handleStartRotate(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition"
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
