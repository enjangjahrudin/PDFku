import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  Copy,
  Check,
  Eye,
  Loader2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
import { VirtualFile } from '../../types';
import { downloadBlob, formatFileSize, formatDate } from '../../utils/formatters';

interface PreviewModalProps {
  file: VirtualFile | null;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ file, onClose }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'ocr'>('preview');
  const [copied, setCopied] = useState<boolean>(false);

  // PDF Viewer State
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.2);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Image preview state
  const [imgUrl, setImgUrl] = useState<string>('');

  useEffect(() => {
    if (!file) return;

    if (file.type === 'pdf' && file.blob) {
      loadPdf(file.blob);
    } else if (file.blob) {
      const url = URL.createObjectURL(file.blob);
      setImgUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (file.thumbnail) {
      setImgUrl(file.thumbnail);
    }
  }, [file]);

  const loadPdf = async (blob: Blob) => {
    setIsLoadingPdf(true);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      renderPage(1, pdf, zoomScale);
    } catch (err) {
      console.error('Gagal memuat PDF:', err);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const renderPage = async (pageNumber: number, pdf: any, scale: number) => {
    if (!pdf) return;
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await page.render({
        canvasContext: ctx,
        viewport
      }).promise;
    } catch (e) {
      console.error(e);
    }
  };

  const changePage = (delta: number) => {
    const next = currentPage + delta;
    if (next >= 1 && next <= numPages) {
      setCurrentPage(next);
      if (pdfDocRef.current) {
        renderPage(next, pdfDocRef.current, zoomScale);
      }
    }
  };

  const changeZoom = (delta: number) => {
    const nextScale = Math.max(0.6, Math.min(3.0, zoomScale + delta));
    setZoomScale(nextScale);
    if (pdfDocRef.current) {
      renderPage(currentPage, pdfDocRef.current, nextScale);
    }
  };

  const handleCopyOcr = () => {
    if (!file?.ocrText) return;
    navigator.clipboard.writeText(file.ocrText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-[#fafafa]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-800 truncate max-w-md">
                {file.name}
              </h3>
              <p className="text-[10px] text-gray-400">
                {formatFileSize(file.size)} • {formatDate(file.updatedAt)}
              </p>
            </div>
          </div>

          {/* Action Tabs & Controls */}
          <div className="flex items-center space-x-2">
            {file.ocrText && (
              <div className="flex bg-gray-200/80 p-0.5 rounded-md text-xs font-medium">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 rounded transition ${
                    activeTab === 'preview' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  Pratinjau Dokumen
                </button>
                <button
                  onClick={() => setActiveTab('ocr')}
                  className={`px-2.5 py-1 rounded transition ${
                    activeTab === 'ocr' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  Teks OCR
                </button>
              </div>
            )}

            {file.blob && (
              <button
                onClick={() => downloadBlob(file.blob!, file.name)}
                className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-gray-900 overflow-auto flex flex-col items-center justify-center p-4 relative">
          {activeTab === 'preview' ? (
            file.type === 'pdf' ? (
              // PDF Preview
              <div className="flex flex-col items-center max-h-full">
                {isLoadingPdf ? (
                  <div className="flex items-center space-x-2 text-white text-xs">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    <span>Memuat dokumen PDF...</span>
                  </div>
                ) : (
                  <div className="shadow-2xl rounded overflow-auto max-h-[75vh]">
                    <canvas ref={canvasRef} className="rounded" />
                  </div>
                )}

                {/* PDF Floating Controller */}
                {numPages > 0 && !isLoadingPdf && (
                  <div className="fixed bottom-8 bg-gray-800/90 backdrop-blur-md border border-gray-700 text-white px-3 py-1.5 rounded-full flex items-center space-x-3 text-xs shadow-xl">
                    <button
                      onClick={() => changePage(-1)}
                      disabled={currentPage <= 1}
                      className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-[11px]">
                      {currentPage} / {numPages}
                    </span>
                    <button
                      onClick={() => changePage(1)}
                      disabled={currentPage >= numPages}
                      className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="h-3 w-px bg-gray-600 mx-1" />

                    <button
                      onClick={() => changeZoom(-0.2)}
                      className="p-1 hover:bg-gray-700 rounded"
                      title="Perkecil"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[11px]">{Math.round(zoomScale * 100)}%</span>
                    <button
                      onClick={() => changeZoom(0.2)}
                      className="p-1 hover:bg-gray-700 rounded"
                      title="Perbesar"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Image Preview
              <div className="flex items-center justify-center max-h-full max-w-full">
                <img
                  src={imgUrl}
                  alt={file.name}
                  className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-2xl"
                />
              </div>
            )
          ) : (
            // OCR Text View
            <div className="w-full max-w-3xl h-full bg-white rounded-lg p-5 flex flex-col justify-between shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                <span className="text-xs font-semibold text-gray-700">
                  Teks Terbaca Otomatis (Hasil Optical Character Recognition):
                </span>
                <button
                  onClick={handleCopyOcr}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-medium transition border border-blue-200"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
                </button>
              </div>

              <textarea
                readOnly
                value={file.ocrText || 'Tidak ada teks yang terdeteksi.'}
                className="flex-1 w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-800 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
