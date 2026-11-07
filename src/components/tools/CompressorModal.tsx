import React, { useState, useEffect } from 'react';
import {
  X,
  Minimize2,
  FileText,
  Loader2,
  Download,
  FolderInput,
  CheckCircle2
} from 'lucide-react';
import { compressPdf } from '../../services/pdfService';
import { formatFileSize } from '../../utils/formatters';
import { VirtualFile } from '../../types';

interface CompressorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToExplorer: (file: Omit<VirtualFile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any>;
}

export const CompressorModal: React.FC<CompressorModalProps> = ({
  isOpen,
  onClose,
  onSaveToExplorer
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetSizePreset, setTargetSizePreset] = useState<number>(300 * 1024); // 300 KB
  const [customKb, setCustomKb] = useState<number>(300);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setCompressedBlob(null);
      setIsCompressing(false);
      setProgressMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setCompressedBlob(null);
    }
  };

  const handleStartCompress = async () => {
    if (!selectedFile) return;
    setIsCompressing(true);
    try {
      const targetBytes = targetSizePreset === -1 ? customKb * 1024 : targetSizePreset;
      const res = await compressPdf(selectedFile, targetBytes, (curr, total, msg) => {
        setProgressMsg(msg);
      });
      setCompressedBlob(res);
    } catch (err) {
      alert('Gagal mengompresi PDF: ' + (err as Error).message);
    } finally {
      setIsCompressing(false);
      setProgressMsg('');
    }
  };

  const handleSaveToExplorer = async () => {
    if (!compressedBlob || !selectedFile) return;
    const baseName = selectedFile.name.replace(/\.pdf$/i, '');
    const newName = `${baseName}_Compressed.pdf`;

    await onSaveToExplorer({
      name: newName,
      parentId: 'folder-converted',
      type: 'pdf',
      isFolder: false,
      size: compressedBlob.size,
      blob: compressedBlob,
      colorTag: '#10b981'
    });
    alert('Dokumen terkompresi berhasil disimpan ke folder Hasil Konversi!');
    onClose();
  };

  const handleDownloadDirect = () => {
    if (!compressedBlob || !selectedFile) return;
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFile.name.replace(/\.pdf$/i, '')}_Compressed.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-[#fafafa]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Minimize2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">
              Smart PDF Compressor
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!selectedFile ? (
            <label className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-gray-50/50 hover:bg-indigo-50/20">
              <FileText className="w-12 h-12 text-indigo-500 mb-2 stroke-1" />
              <span className="text-sm font-semibold text-gray-800">Pilih Berkas PDF yang Ingin Dikecilkan</span>
              <span className="text-xs text-gray-400 mt-1">Format PDF, maksimal beberapa puluh MB</span>
              <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="font-semibold text-gray-800">{selectedFile.name}</div>
                    <div className="text-[11px] text-gray-500">Ukuran Asli: {formatFileSize(selectedFile.size)}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setCompressedBlob(null);
                  }}
                  className="text-red-600 hover:underline text-xs"
                >
                  Ganti
                </button>
              </div>

              {/* Target Size Presets */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">
                  Target Ukuran Maksimal:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { label: '< 300 KB (CPNS/Portal)', bytes: 300 * 1024 },
                    { label: '< 500 KB (Standar)', bytes: 500 * 1024 },
                    { label: '< 1 MB (Email)', bytes: 1024 * 1024 }
                  ].map((p) => (
                    <button
                      key={p.bytes}
                      onClick={() => setTargetSizePreset(p.bytes)}
                      className={`p-2 rounded-lg border text-center transition ${
                        targetSizePreset === p.bytes
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              {!compressedBlob && (
                <button
                  disabled={isCompressing}
                  onClick={handleStartCompress}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition shadow"
                >
                  {isCompressing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{progressMsg || 'Mengompres PDF...'}</span>
                    </>
                  ) : (
                    <span>Mulai Kompresi Dokumen</span>
                  )}
                </button>
              )}

              {/* Result Summary */}
              {compressedBlob && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Kompresi Berhasil Diselesaikan!</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-lg border border-emerald-100">
                    <div>
                      <div className="text-gray-400">Ukuran Awal:</div>
                      <div className="font-semibold text-gray-700">{formatFileSize(selectedFile.size)}</div>
                    </div>
                    <div>
                      <div className="text-emerald-600 font-medium">Ukuran Baru:</div>
                      <div className="font-bold text-emerald-700 font-mono">{formatFileSize(compressedBlob.size)}</div>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-1">
                    <button
                      onClick={handleSaveToExplorer}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow"
                    >
                      <FolderInput className="w-4 h-4" />
                      <span>Simpan ke Explorer</span>
                    </button>
                    <button
                      onClick={handleDownloadDirect}
                      className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-xs font-medium flex items-center justify-center space-x-1 transition"
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
