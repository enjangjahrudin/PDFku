import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  Copy,
  Check,
  Eye,
  Loader2,
  FileText,
  RotateCcw
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
import { VirtualFile } from '../../types';
import { downloadBlob, formatFileSize, formatDate } from '../../utils/formatters';
import { authService } from '../../services/authService';

interface PreviewModalProps {
  file: VirtualFile | null;
  onClose: () => void;
}

// Komponen Halaman Tunggal PDF dengan rasio aspek terkunci sempurna
interface PdfPageCanvasProps {
  pdf: any;
  pageNumber: number;
  scale: number;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({ pdf, pageNumber, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    const render = async () => {
      if (!pdf) return;
      setIsPageLoading(true);

      try {
        const page = await pdf.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const width = Math.floor(viewport.width);
        const height = Math.floor(viewport.height);

        setDimensions({ width, height });

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Kunci ukuran internal buffer canvas
        canvas.width = width;
        canvas.height = height;

        // Kunci ukuran CSS canvas secara eksplisit dalam pixel agar tidak pernah terdistorsi / gepeng
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Batalkan render sebelumnya jika masih berjalan pada canvas ini
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Abaikan error pembatalan
          }
        }

        const renderTask = page.render({
          canvasContext: ctx,
          viewport
        });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isCancelled) {
          setIsPageLoading(false);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Gagal render halaman ${pageNumber}:`, err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Abaikan
        }
      }
    };
  }, [pdf, pageNumber, scale]);

  return (
    <div
      style={{
        width: dimensions ? `${dimensions.width}px` : 'auto',
        minHeight: dimensions ? `${dimensions.height}px` : '350px'
      }}
      className="relative shadow-2xl rounded-xs overflow-hidden bg-white mx-auto border border-gray-300 shrink-0"
    >
      <canvas ref={canvasRef} className="block" />

      {/* Badge Nomor Halaman di pojok kanan atas */}
      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white rounded text-[10px] font-mono font-semibold pointer-events-none select-none shadow-xs z-10">
        Halaman {pageNumber}
      </div>

      {isPageLoading && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center pointer-events-none z-10">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
};

export const PreviewModal: React.FC<PreviewModalProps> = ({ file, onClose }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'ocr'>('preview');
  const [copied, setCopied] = useState<boolean>(false);

  // PDF Viewer State (Continuous Vertical Scroll)
  const [numPages, setNumPages] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1.15);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const pdfDocRef = useRef<any>(null);

  // Image preview state
  const [imgUrl, setImgUrl] = useState<string>('');

  useEffect(() => {
    if (!file) return;

    let active = true;
    const initPreview = async () => {
      let blob = file.blob;
      if (!blob && file.id && !file.isFolder) {
        try {
          const res = await fetch(`/api/files/preview/${file.id}`, {
            headers: authService.getAuthHeader()
          });
          if (res.ok) {
            blob = await res.blob();
          }
        } catch (e) {
          console.warn('Gagal fetch preview blob:', e);
        }
      }

      if (!active) return;

      if (file.type === 'pdf' && blob) {
        loadPdf(blob);
      } else if (blob) {
        const url = URL.createObjectURL(blob);
        setImgUrl(url);
      } else if (file.thumbnail) {
        setImgUrl(file.thumbnail);
      }
    };

    initPreview();

    return () => {
      active = false;
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          // Abaikan
        }
        pdfDocRef.current = null;
      }
    };
  }, [file]);

  const loadPdf = async (blob: Blob) => {
    setIsLoadingPdf(true);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
    } catch (err) {
      console.error('Gagal memuat PDF:', err);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const changeZoom = (delta: number) => {
    setZoomScale((prev) => Math.max(0.5, Math.min(2.5, +(prev + delta).toFixed(2))));
  };

  const resetZoom = () => {
    setZoomScale(1.15);
  };

  const handleCopyOcr = () => {
    if (!file?.ocrText) return;
    navigator.clipboard.writeText(file.ocrText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 border-b border-gray-200 px-4 sm:px-5 flex items-center justify-between bg-[#fafafa] shrink-0">
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Eye className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="text-xs sm:text-sm font-bold text-gray-800 truncate max-w-sm sm:max-w-md">
                {file.name}
              </h3>
              <p className="text-[10px] text-gray-400">
                {formatFileSize(file.size)} • {formatDate(file.updatedAt)} {numPages > 0 ? `• ${numPages} Halaman` : ''}
              </p>
            </div>
          </div>

          {/* Action Tabs & Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            {file.ocrText && (
              <div className="flex bg-gray-200/80 p-0.5 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    activeTab === 'preview' ? 'bg-white text-blue-600 shadow-2xs font-semibold' : 'text-gray-600'
                  }`}
                >
                  Pratinjau
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ocr')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    activeTab === 'ocr' ? 'bg-white text-blue-600 shadow-2xs font-semibold' : 'text-gray-600'
                  }`}
                >
                  Teks OCR
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (file.blob) {
                  downloadBlob(file.blob, file.name);
                } else if (file.id) {
                  window.open(`/api/files/download/${file.id}`, '_blank');
                }
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unduh</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-gray-900/95 overflow-hidden flex flex-col items-center justify-center relative">
          {activeTab === 'preview' ? (
            file.type === 'pdf' ? (
              /* ========================================================
                 PDF PREVIEW: CONTINUOUS VERTICAL SCROLL (Nyambung ke Bawah)
                 ======================================================== */
              <div className="w-full h-full flex flex-col items-center relative overflow-hidden">
                {isLoadingPdf ? (
                  <div className="flex flex-col items-center justify-center h-full text-white space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    <span className="text-xs font-medium">Memuat seluruh halaman dokumen PDF...</span>
                  </div>
                ) : (
                  /* Container Scroll Vertikal dari Halaman 1 sampai Halaman Terakhir */
                  <div className="w-full h-full overflow-y-auto overflow-x-auto p-4 sm:p-6 flex flex-col items-center space-y-6 scrollbar-thin scrollbar-thumb-gray-700">
                    {pdfDocRef.current &&
                      Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                        <PdfPageCanvas
                          key={pageNum}
                          pdf={pdfDocRef.current}
                          pageNumber={pageNum}
                          scale={zoomScale}
                        />
                      ))}
                    <div className="h-16 shrink-0" /> {/* Spasi ekstra di bawah */}
                  </div>
                )}

                {/* Floating Bottom Controller (Zoom & Info Halaman) */}
                {numPages > 0 && !isLoadingPdf && (
                  <div className="absolute bottom-5 bg-gray-800/90 backdrop-blur-md border border-gray-700 text-white px-3.5 py-1.5 rounded-full flex items-center space-x-2.5 text-xs shadow-2xl z-20 select-none animate-in fade-in slide-from-bottom-2 duration-150">
                    <div className="flex items-center space-x-1.5 font-medium text-gray-200 pr-1">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>{numPages} Halaman</span>
                    </div>

                    <div className="h-3.5 w-px bg-gray-600" />

                    <button
                      type="button"
                      onClick={() => changeZoom(-0.15)}
                      className="p-1 hover:bg-gray-700 rounded transition text-gray-300 hover:text-white"
                      title="Perkecil (-)"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={resetZoom}
                      className="font-mono text-[11px] min-w-10 text-center hover:bg-gray-700 py-0.5 px-1 rounded transition text-blue-300"
                      title="Klik untuk reset zoom"
                    >
                      {Math.round(zoomScale * 100)}%
                    </button>

                    <button
                      type="button"
                      onClick={() => changeZoom(0.15)}
                      className="p-1 hover:bg-gray-700 rounded transition text-gray-300 hover:text-white"
                      title="Perbesar (+)"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={resetZoom}
                      className="p-1 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Image Preview
              <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                <img
                  src={imgUrl}
                  alt={file.name}
                  className="max-h-[82vh] max-w-full object-contain rounded-xl shadow-2xl select-none"
                />
              </div>
            )
          ) : (
            // OCR Text View
            <div className="w-full max-w-3xl h-[80vh] bg-white rounded-xl p-5 flex flex-col justify-between shadow-2xl m-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2.5 mb-3">
                <span className="text-xs font-bold text-gray-800">
                  Teks Terbaca Otomatis (Hasil Optical Character Recognition):
                </span>
                <button
                  type="button"
                  onClick={handleCopyOcr}
                  className="flex items-center space-x-1.5 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition border border-blue-200"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
                </button>
              </div>

              <textarea
                readOnly
                value={file.ocrText || 'Tidak ada teks yang terdeteksi.'}
                className="flex-1 w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs font-mono text-gray-800 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};