import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Crop,
  RotateCcw,
  RotateCw,
  Plus,
  Trash2,
  Check,
  FileText,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Columns,
  PenTool,
  Edit3,
  Share2,
  Download,
  Copy,
  Zap,
  Sliders
} from 'lucide-react';
import { CropEditor } from './CropEditor';
import { FilterSettings, FilterType, ScannedPage, VirtualFile } from '../../types';
import {
  loadImage,
  detectDocumentCorners,
  warpPerspective,
  applyDocumentFilters,
  rotateImage
} from '../../services/imageProcessing';
import { convertJpgToPdf } from '../../services/pdfService';
import { extractTextFromImage } from '../../services/ocrService';
import { downloadBlob } from '../../utils/formatters';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDocument: (file: Omit<VirtualFile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any>;
  onCreateFolder?: (name: string, parentId?: string | null, colorTag?: string) => Promise<VirtualFile>;
  onNavigateToFolder?: (folderId: string | null) => void;
}

const CAMSCANNER_FILTERS: { id: FilterType; name: string; badge?: string }[] = [
  { id: 'original', name: 'Original' },
  { id: 'lighten', name: 'Cerahkan' },
  { id: 'sharpen', name: 'Mempertajam' },
  { id: 'magic_color', name: 'Ajaib Pro', badge: 'Pro' },
  { id: 'no_shadow', name: 'Tanpa Bayangan' },
  { id: 'bw', name: 'B&W' },
  { id: 'grayscale', name: 'Abu-abu' }
];

// Helper mengubah Data URL ke Blob biner asli
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onSaveDocument,
  onCreateFolder,
  onNavigateToFolder
}) => {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  // Alur CamScanner: 'crop' (Memotong) -> 'filter' (Ajaib Pro) -> 'review' (Halaman Dokumen 1/1)
  const [activeStep, setActiveStep] = useState<'crop' | 'filter' | 'review'>('crop');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLaserScanning, setIsLaserScanning] = useState<boolean>(false);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [isFullCropMode, setIsFullCropMode] = useState<boolean>(false);
  const [showAdjustSliders, setShowAdjustSliders] = useState<boolean>(false);

  // Mode kamera awal ala CamScanner
  const [flashMode, setFlashMode] = useState<'active' | 'off' | 'auto' | 'torch'>('torch');
  const [captureBatchMode, setCaptureBatchMode] = useState<'single' | 'batch' | 'ocr' | 'sign'>('single');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

  // Nama dokumen default bergaya CamScanner
  const formatCamScannerDefaultName = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `CamScanner ${d}-${m}-${y} ${hh}.${mm}`;
  };

  const [docName, setDocName] = useState<string>(formatCamScannerDefaultName);

  // Modal fitur tambahan: Ekstrak Teks (OCR), Tanda Tangani, Tandai, dan Sheet Bagikan/Simpan
  const [showOcrModal, setShowOcrModal] = useState<boolean>(false);
  const [ocrTextResult, setOcrTextResult] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isRunningOcr, setIsRunningOcr] = useState<boolean>(false);

  const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false);
  const [showHighlightModal, setShowHighlightModal] = useState<boolean>(false);
  const [showSaveSheet, setShowSaveSheet] = useState<boolean>(false);

  // Live Camera Viewfinder & Flashlight Torch
  const [isCameraLive, setIsCameraLive] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Canvas untuk tanda tangan & stabilo
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false);
  const markCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingMark, setIsDrawingMark] = useState<boolean>(false);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraLive(false);
  };

  const startLiveCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsCameraLive(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraLive(true);

      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities?.() || {};
        const supportsTorch = !!capabilities.torch;
        setHasTorchSupport(supportsTorch);
        if (supportsTorch && (flashMode === 'torch' || flashMode === 'active')) {
          (track as any).applyConstraints({ advanced: [{ torch: true }] }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Live camera stream not available (fallback to native file upload):', err);
      setIsCameraLive(false);
    }
  };

  const setFlashlightMode = async (mode: 'active' | 'off' | 'auto' | 'torch') => {
    setFlashMode(mode);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        const turnOn = mode === 'torch';
        await (track as any).applyConstraints({
          advanced: [{ torch: turnOn }]
        });
      } catch (e) {
        console.warn('Flashlight torch error:', e);
      }
    }
  };

  const captureLivePhoto = async () => {
    if (videoRef.current && isCameraLive) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d')!;

      const track = streamRef.current?.getVideoTracks()[0];
      if (track && flashMode === 'active') {
        try {
          await (track as any).applyConstraints({ advanced: [{ torch: true }] });
          await new Promise((r) => setTimeout(r, 150));
        } catch (e) {}
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (track && flashMode === 'active') {
        try {
          await (track as any).applyConstraints({ advanced: [{ torch: false }] });
        } catch (e) {}
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      stopCamera();
      addNewPageFromDataUrl(dataUrl);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPages([]);
      setCurrentPageIndex(0);
      setActiveStep('crop');
      setIsProcessing(false);
      setIsLaserScanning(false);
      setIsComparing(false);
      setIsFullCropMode(false);
      setShowSaveSheet(false);
      setShowOcrModal(false);
      setShowSignatureModal(false);
      setShowHighlightModal(false);
      setDocName(formatCamScannerDefaultName());
      startLiveCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          addNewPageFromDataUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const addNewPageFromDataUrl = async (dataUrl: string) => {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const corners = detectDocumentCorners(canvas, canvas.width, canvas.height);

    const newPage: ScannedPage = {
      id: 'page-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      originalImage: dataUrl,
      warpedImage: dataUrl,
      processedImage: dataUrl,
      cropPoints: corners,
      filters: {
        filter: 'magic_color', // Default ke "Ajaib Pro" CamScanner
        brightness: 0,
        contrast: 10,
        sharpness: 20,
        rotation: 0
      },
      width: canvas.width,
      height: canvas.height
    };

    setPages((prev) => {
      const updated = [...prev, newPage];
      setCurrentPageIndex(updated.length - 1);
      return updated;
    });
    setIsFullCropMode(false);
    setActiveStep('crop');
  };

  const currentPage = pages[currentPageIndex];

  // Putar foto di langkah Memotong (Kiri -90° atau Kanan +90°)
  const handleRotateCropPage = async (degrees: 90 | -90) => {
    if (!currentPage) return;
    setIsProcessing(true);
    try {
      const rotated = await rotateImage(currentPage.originalImage, degrees);
      const img = await loadImage(rotated.dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = rotated.width;
      canvas.height = rotated.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const detected = detectDocumentCorners(canvas, canvas.width, canvas.height);

      setPages((prev) => {
        const copy = [...prev];
        copy[currentPageIndex] = {
          ...copy[currentPageIndex],
          originalImage: rotated.dataUrl,
          warpedImage: rotated.dataUrl,
          processedImage: rotated.dataUrl,
          width: rotated.width,
          height: rotated.height,
          cropPoints: detected
        };
        return copy;
      });
      setIsFullCropMode(false);
    } catch (err) {
      console.error('Gagal memutar foto:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle "Semua" <-> "Otomatis" di langkah Memotong persis seperti CamScanner
  const handleToggleAllOrAutoCrop = async () => {
    if (!currentPage) return;
    if (!isFullCropMode) {
      // Pilih Semua (Full Image)
      const w = currentPage.width;
      const h = currentPage.height;
      setPages((prev) => {
        const copy = [...prev];
        copy[currentPageIndex] = {
          ...copy[currentPageIndex],
          cropPoints: {
            topLeft: { x: 0, y: 0 },
            topRight: { x: w, y: 0 },
            bottomRight: { x: w, y: h },
            bottomLeft: { x: 0, y: h }
          }
        };
        return copy;
      });
      setIsFullCropMode(true);
    } else {
      // Deteksi Kertas Otomatis
      const img = await loadImage(currentPage.originalImage);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const detected = detectDocumentCorners(canvas, canvas.width, canvas.height);
      setPages((prev) => {
        const copy = [...prev];
        copy[currentPageIndex] = {
          ...copy[currentPageIndex],
          cropPoints: detected
        };
        return copy;
      });
      setIsFullCropMode(false);
    }
  };

  // Klik "Berikutnya" dari Memotong -> Animasi Laser Scan CamScanner -> Filter Ajaib Pro
  const handleApplyCropToFilter = async () => {
    if (!currentPage || !currentPage.cropPoints) return;
    setIsProcessing(true);
    try {
      const img = await loadImage(currentPage.originalImage);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // 1. Perataan perspektif 4 sudut
      const warpedCanvas = warpPerspective(canvas, currentPage.cropPoints);
      const warpedUrl = warpedCanvas.toDataURL('image/jpeg', 0.92);

      // Tampilkan animasi Laser Scan khas CamScanner di atas dokumen yang baru diratakan
      setPages((prev) => {
        const copy = [...prev];
        copy[currentPageIndex] = {
          ...copy[currentPageIndex],
          warpedImage: warpedUrl,
          processedImage: warpedUrl
        };
        return copy;
      });

      setIsLaserScanning(true);
      await new Promise((r) => setTimeout(r, 650));

      // 2. Terapkan filter aktif (Default: Ajaib Pro)
      const filteredCanvas = applyDocumentFilters(warpedCanvas, currentPage.filters);
      const processedUrl = filteredCanvas.toDataURL('image/jpeg', 0.92);

      setPages((prev) => {
        const copy = [...prev];
        copy[currentPageIndex] = {
          ...copy[currentPageIndex],
          warpedImage: warpedUrl,
          processedImage: processedUrl
        };
        return copy;
      });

      setIsLaserScanning(false);
      setActiveStep('filter');

      // Jika di awal user memilih mode OCR atau Tanda tangan, langsung buka fiturnya
      if (captureBatchMode === 'ocr') {
        setTimeout(() => handleRunOcr(processedUrl), 200);
      } else if (captureBatchMode === 'sign') {
        setTimeout(() => setShowSignatureModal(true), 200);
      }
    } catch (err) {
      console.error(err);
      setIsLaserScanning(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // Ubah jenis filter atau pengaturan di layar Filter
  const updateFilterSetting = async (newSettings: Partial<FilterSettings>) => {
    if (!currentPage) return;
    const updatedFilters: FilterSettings = { ...currentPage.filters, ...newSettings };

    setIsProcessing(true);
    try {
      const sourceUrl = currentPage.warpedImage || currentPage.originalImage;
      const img = await loadImage(sourceUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const filteredCanvas = applyDocumentFilters(canvas, updatedFilters);
      const processedUrl = filteredCanvas.toDataURL('image/jpeg', 0.92);

      setPages((prev) => {
        const copy = [...prev];
        copy[currentPageIndex] = {
          ...copy[currentPageIndex],
          filters: updatedFilters,
          processedImage: processedUrl
        };
        return copy;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Jalankan Ekstrak Teks (OCR) pada halaman saat ini
  const handleRunOcr = async (overrideImgUrl?: string) => {
    const targetUrl = overrideImgUrl || currentPage?.processedImage;
    if (!targetUrl) return;
    setShowOcrModal(true);
    setIsRunningOcr(true);
    setOcrProgress(0);
    try {
      const text = await extractTextFromImage(targetUrl, 'ind+eng', (p: number) => setOcrProgress(p));
      setOcrTextResult(text || 'Tidak ada teks yang terdeteksi pada halaman ini.');
    } catch (err) {
      setOcrTextResult('Gagal mengekstrak teks.');
    } finally {
      setIsRunningOcr(false);
    }
  };

  // Terapkan tanda tangan digital di atas halaman dokumen
  const handleApplySignature = async () => {
    if (!sigCanvasRef.current || !currentPage) return;
    const img = await loadImage(currentPage.processedImage);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    // Tempatkan tanda tangan di area kanan bawah dokumen (area tanda tangan)
    const sigW = Math.round(canvas.width * 0.35);
    const sigH = Math.round((sigCanvasRef.current.height / sigCanvasRef.current.width) * sigW);
    const sigX = Math.round(canvas.width * 0.55);
    const sigY = Math.round(canvas.height * 0.72);
    ctx.drawImage(sigCanvasRef.current, sigX, sigY, sigW, sigH);

    const signedUrl = canvas.toDataURL('image/jpeg', 0.93);
    setPages((prev) => {
      const copy = [...prev];
      copy[currentPageIndex] = {
        ...copy[currentPageIndex],
        processedImage: signedUrl
      };
      return copy;
    });
    setShowSignatureModal(false);
  };

  // Terapkan coretan / stabilo ("Tandai") di atas halaman dokumen
  const handleApplyHighlight = async () => {
    if (!markCanvasRef.current || !currentPage) return;
    const img = await loadImage(currentPage.processedImage);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    ctx.drawImage(markCanvasRef.current, 0, 0, canvas.width, canvas.height);

    const markedUrl = canvas.toDataURL('image/jpeg', 0.93);
    setPages((prev) => {
      const copy = [...prev];
      copy[currentPageIndex] = {
        ...copy[currentPageIndex],
        processedImage: markedUrl
      };
      return copy;
    });
    setShowHighlightModal(false);
  };

  // Ekspor ke Word (.doc) dari hasil scan + OCR
  const handleExportToWord = async () => {
    if (!currentPage) return;
    setIsProcessing(true);
    try {
      const text =
        ocrTextResult ||
        (await extractTextFromImage(currentPage.processedImage, 'ind+eng')) ||
        '';
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${docName}</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>${docName}</h2>
          <pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${text}</pre>
          <hr/>
          <img src="${currentPage.processedImage}" style="max-width: 100%; height: auto;" />
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      downloadBlob(blob, `${docName}.doc`);
    } catch (err) {
      alert('Gagal mengekspor ke Word.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Simpan ke File Explorer (dan opsional unduh ke perangkat)
  const handleSaveToExplorer = async (format: 'pdf' | 'jpg', alsoDownload = false) => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    try {
      const cleanName = docName.trim() || formatCamScannerDefaultName();
      const processedImages = pages.map((p) => p.processedImage);

      if (format === 'pdf') {
        const imageBlobs = processedImages.map(dataUrlToBlob);
        const pdfBlob = await convertJpgToPdf(imageBlobs);
        await onSaveDocument({
          name: `${cleanName}.pdf`,
          parentId: 'folder-scan',
          type: 'pdf',
          isFolder: false,
          size: pdfBlob.size,
          blob: pdfBlob,
          thumbnail: processedImages[0],
          pageCount: pages.length,
          ocrText: ocrTextResult || undefined,
          colorTag: '#14b8a6'
        });
        if (alsoDownload) {
          downloadBlob(pdfBlob, `${cleanName}.pdf`);
        }
        if (onNavigateToFolder) onNavigateToFolder('folder-scan');
      } else {
        let targetFolderId = 'folder-scan';
        if (pages.length > 1 && onCreateFolder) {
          const newFolder = await onCreateFolder(cleanName, 'folder-scan', '#14b8a6');
          targetFolderId = newFolder.id;
        }
        for (let i = 0; i < processedImages.length; i++) {
          const blob = dataUrlToBlob(processedImages[i]);
          const suffix = pages.length > 1 ? `_Hal_${i + 1}` : '';
          await onSaveDocument({
            name: `${cleanName}${suffix}.jpg`,
            parentId: targetFolderId,
            type: 'jpg',
            isFolder: false,
            size: blob.size,
            blob: blob,
            thumbnail: processedImages[i],
            pageCount: 1,
            ocrText: i === 0 ? ocrTextResult || undefined : undefined,
            colorTag: '#14b8a6'
          });
          if (alsoDownload) {
            downloadBlob(blob, `${cleanName}${suffix}.jpg`);
          }
        }
        if (onNavigateToFolder) onNavigateToFolder(targetFolderId);
      }

      setShowSaveSheet(false);
      onClose();
    } catch (err) {
      alert('Gagal menyimpan dokumen: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none overflow-hidden">
      {/* =====================================================================
          LAYAR 1: TAMPILAN KAMERA AWAL CAMSCANNER (Saat belum ada foto)
         ===================================================================== */}
      {pages.length === 0 ? (
        <div className="flex-1 flex flex-col justify-between bg-black text-white">
          {/* Top Camera Bar ala CamScanner */}
          <div className="pt-3 pb-2 px-4 bg-black border-b border-gray-900">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={onClose}
                className="p-1.5 text-white hover:bg-gray-800 rounded-full transition"
              >
                <X className="w-6 h-6" />
              </button>

              <span className="text-sm font-semibold text-white tracking-wide">
                Magic Scanner
              </span>

              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-[#14b8a6] text-white text-[10px] font-extrabold rounded">
                  HD
                </span>
              </div>
            </div>

            {/* Tampilkan kontrol Flash fisik hanya jika kamera langsung mendukung torch */}
            {isCameraLive && hasTorchSupport && (
              <div className="grid grid-cols-4 gap-1 text-center text-xs pt-1">
                {[
                  { id: 'active', label: 'Aktif' },
                  { id: 'off', label: 'Nonaktif' },
                  { id: 'auto', label: 'Otomatis' },
                  { id: 'torch', label: 'Tetap Aktif' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setFlashlightMode(m.id as any)}
                    className={`py-1.5 rounded-md font-medium transition ${
                      flashMode === m.id
                        ? 'bg-[#263238] text-[#14b8a6]'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Area Bidik Dokumen Tengah */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black px-4">
            {isCameraLive ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Overlay Panduan Kertas CamScanner di atas video */}
                <div className="absolute inset-6 sm:inset-12 border-2 border-dashed border-[#14b8a6]/70 rounded-2xl pointer-events-none flex flex-col items-center justify-between p-4">
                  <div className="bg-black/50 backdrop-blur-xs text-white text-[11px] px-3.5 py-1 rounded-full font-medium shadow-md">
                    Sejajarkan dokumen di dalam bingkai
                  </div>
                  <div className="text-[10px] text-teal-300 bg-black/50 px-2.5 py-0.5 rounded-full font-medium">
                    {hasTorchSupport ? 'Lampu Flash Siap' : 'Auto Focus HD'}
                  </div>
                </div>
              </div>
            ) : (
              /* Tampilan Bersih & Elegan Pembuka Kamera */
              <div className="w-full max-w-xs border border-teal-500/30 rounded-2xl flex flex-col items-center justify-center p-6 text-center bg-gray-950/80 relative shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-teal-500/15 border border-teal-500/40 flex items-center justify-center mb-3 text-[#14b8a6]">
                  <Camera className="w-8 h-8" />
                </div>
                <h4 className="text-base font-semibold text-white mb-1">
                  Ambil Foto Dokumen
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  Tepi kertas akan dideteksi dan diratakan otomatis dengan filter <span className="text-[#14b8a6] font-medium">Ajaib Pro</span>.
                </p>

                <label className="w-full py-3 bg-[#14b8a6] hover:bg-[#0d9488] text-white text-xs font-semibold rounded-xl shadow-lg cursor-pointer transition active:scale-95 flex items-center justify-center space-x-2">
                  <Camera className="w-4 h-4" />
                  <span>Buka Kamera Sekarang</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="mt-3 p-2 bg-gray-900/90 border border-gray-800 rounded-lg text-[11px] text-gray-400 text-left flex items-start space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong>Tip Lampu Flash:</strong> Nyalakan ikon petir (⚡) di pojok kiri atas aplikasi kamera HP jika ruangan agak redup.</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar Mode & Shutter ala CamScanner */}
          <div className="bg-black pt-2 pb-6 px-4 border-t border-gray-900">
            {/* Tab Mode: Ekstrak Teks | Tanda tangani | Satu Halaman | Banyak Halaman */}
            <div className="flex items-center justify-center space-x-5 text-xs mb-5 overflow-x-auto scrollbar-none">
              {[
                { id: 'ocr', label: 'OCR Teks' },
                { id: 'sign', label: 'Tanda tangani' },
                { id: 'single', label: 'Satu Halaman' },
                { id: 'batch', label: 'Banyak Halaman' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCaptureBatchMode(tab.id as any)}
                  className={`relative py-1 whitespace-nowrap font-medium transition ${
                    captureBatchMode === tab.id ? 'text-[#14b8a6]' : 'text-gray-400'
                  }`}
                >
                  {captureBatchMode === tab.id && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-[#14b8a6]" />
                  )}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tombol Shutter Bulat Teal + Impor Gambar + Impor File */}
            <div className="flex items-center justify-around max-w-md mx-auto">
              {/* Semua Fitur / Galeri */}
              <label className="flex flex-col items-center space-y-1 text-gray-300 hover:text-white cursor-pointer">
                <div className="p-2.5 rounded-xl bg-gray-900 border border-gray-800">
                  <Sparkles className="w-5 h-5 text-[#14b8a6]" />
                </div>
                <span className="text-[11px]">Auto Scan</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Tombol Shutter Utama CamScanner (Lingkaran Putih Berbingkai Teal) */}
              {isCameraLive ? (
                <button
                  onClick={captureLivePhoto}
                  className="w-18 h-18 p-1 rounded-full border-4 border-[#14b8a6] flex items-center justify-center cursor-pointer active:scale-90 transition shadow-[0_0_25px_rgba(20,184,166,0.5)]"
                  title="Ambil Foto Dokumen"
                >
                  <div className="w-14 h-14 rounded-full bg-white active:bg-gray-200 transition" />
                </button>
              ) : (
                <label className="w-18 h-18 p-1 rounded-full border-4 border-[#14b8a6] flex items-center justify-center cursor-pointer active:scale-90 transition shadow-[0_0_25px_rgba(20,184,166,0.5)]">
                  <div className="w-14 h-14 rounded-full bg-white" />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {/* Impor Gambar & File */}
              <div className="flex items-center space-x-4">
                <label className="flex flex-col items-center space-y-1 text-gray-300 hover:text-white cursor-pointer">
                  <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px]">Impor Gambar</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <label className="flex flex-col items-center space-y-1 text-gray-300 hover:text-white cursor-pointer">
                  <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-[10px]">Impor File</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : activeStep === 'crop' ? (
        /* =====================================================================
           LAYAR 2: "MEMOTONG" (CAMSCANNER CROP SCREEN)
           ===================================================================== */
        <div className="flex-1 flex flex-col justify-between bg-black text-white overflow-hidden">
          {/* Header "Memotong" ala CamScanner */}
          <div className="h-13 px-4 bg-[#1b1b1b] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (pages.length === 1) {
                    setPages([]);
                  } else {
                    setActiveStep('review');
                  }
                }}
                className="p-1.5 text-white hover:bg-gray-800 rounded-full transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-base font-medium tracking-wide">Memotong</span>
            </div>

            {pages.length > 1 && (
              <span className="text-xs px-2.5 py-1 bg-gray-800 text-teal-400 rounded-full font-medium">
                Halaman {currentPageIndex + 1}/{pages.length}
              </span>
            )}
          </div>

          {/* Kanvas Tengah: CropEditor dengan 8 Handle Teal & Kaca Pembesar */}
          <div className="flex-1 relative flex items-center justify-center p-3 overflow-hidden">
            {(isProcessing || isLaserScanning) && (
              <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center">
                {isLaserScanning && currentPage ? (
                  /* LAYAR 3: ANIMASI LASER SCAN CAMSCANNER */
                  <div className="relative flex flex-col items-center justify-center max-w-full max-h-full">
                    <div className="relative overflow-hidden rounded-lg shadow-2xl">
                      <img
                        src={currentPage.warpedImage || currentPage.originalImage}
                        alt="Scanning"
                        className="max-h-[68vh] max-w-full object-contain brightness-90"
                      />
                      {/* Garis Sapuan Laser Hijau/Teal CamScanner */}
                      <div
                        className="absolute inset-x-0 h-1.5 bg-white shadow-[0_0_24px_8px_rgba(20,184,166,0.9)] animate-bounce"
                        style={{ top: '65%' }}
                      />
                    </div>
                    <div className="mt-4 w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#14b8a6] w-full animate-pulse" />
                    </div>
                    <p className="text-xs text-gray-300 mt-2">Memotong & Memperjelas Gambar...</p>
                  </div>
                ) : (
                  <>
                    <Loader2 className="w-8 h-8 text-[#14b8a6] animate-spin mb-2" />
                    <span className="text-xs text-gray-300">Memproses gambar...</span>
                  </>
                )}
              </div>
            )}

            {currentPage && currentPage.cropPoints && (
              <CropEditor
                imageSrc={currentPage.originalImage}
                cropPoints={currentPage.cropPoints}
                onChangePoints={(pts) => {
                  setPages((prev) => {
                    const copy = [...prev];
                    copy[currentPageIndex].cropPoints = pts;
                    return copy;
                  });
                }}
              />
            )}
          </div>

          {/* Bottom Bar "Memotong" Persis CamScanner: Kiri | Kanan | Semua/Otomatis | Berikutnya */}
          <div className="h-16 bg-[#1b1b1b] border-t border-gray-800 px-6 flex items-center justify-between shrink-0">
            <button
              onClick={() => handleRotateCropPage(-90)}
              className="flex flex-col items-center justify-center space-y-1 text-gray-200 hover:text-white active:scale-95 transition"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="text-[11px]">Kiri</span>
            </button>

            <button
              onClick={() => handleRotateCropPage(90)}
              className="flex flex-col items-center justify-center space-y-1 text-gray-200 hover:text-white active:scale-95 transition"
            >
              <RotateCw className="w-5 h-5" />
              <span className="text-[11px]">Kanan</span>
            </button>

            <button
              onClick={handleToggleAllOrAutoCrop}
              className="flex flex-col items-center justify-center space-y-1 text-gray-200 hover:text-[#14b8a6] active:scale-95 transition"
            >
              {isFullCropMode ? (
                <>
                  <Sparkles className="w-5 h-5 text-[#14b8a6]" />
                  <span className="text-[11px] text-[#14b8a6] font-medium">Otomatis</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-5 h-5" />
                  <span className="text-[11px]">Semua</span>
                </>
              )}
            </button>

            <button
              onClick={handleApplyCropToFilter}
              className="flex flex-col items-center justify-center space-y-1 text-white hover:text-[#14b8a6] active:scale-95 transition"
            >
              <ArrowRight className="w-6 h-6" />
              <span className="text-[11px] font-medium">Berikutnya</span>
            </button>
          </div>
        </div>
      ) : activeStep === 'filter' ? (
        /* =====================================================================
           LAYAR 4: FILTER & PENINGKATAN DOKUMEN ("AJAIB PRO" CAMSCANNER)
           ===================================================================== */
        <div className="flex-1 flex flex-col justify-between bg-black text-white overflow-hidden">
          {/* Header dengan Judul Dokumen Bergaris Putus-Putus yang Bisa Diedit Langsung */}
          <div className="h-13 px-4 bg-[#1b1b1b] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <button
                onClick={() => setActiveStep('crop')}
                className="p-1.5 text-white hover:bg-gray-800 rounded-full transition shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {isEditingTitle ? (
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                  autoFocus
                  className="bg-gray-800 text-white text-sm px-2 py-1 rounded border border-[#14b8a6] focus:outline-none w-full max-w-xs"
                />
              ) : (
                <div
                  onClick={() => setIsEditingTitle(true)}
                  className="text-sm font-medium text-white truncate border-b border-dashed border-gray-400 pb-0.5 cursor-pointer"
                  title="Ketuk untuk mengubah nama dokumen"
                >
                  {docName}
                </div>
              )}
            </div>
          </div>

          {/* Kanvas Pratinjau Hasil Filter + Tombol "Bandingkan" di Kanan Atas */}
          <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden bg-black">
            {/* Tombol Pill "Bandingkan" ala CamScanner */}
            <button
              onMouseDown={() => setIsComparing(true)}
              onMouseUp={() => setIsComparing(false)}
              onMouseLeave={() => setIsComparing(false)}
              onTouchStart={() => setIsComparing(true)}
              onTouchEnd={() => setIsComparing(false)}
              onClick={() => setIsComparing((v) => !v)}
              className={`absolute top-3 right-4 z-20 flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition shadow-md ${
                isComparing
                  ? 'bg-[#14b8a6] text-white'
                  : 'bg-[#2a2a2a]/90 text-gray-200 hover:bg-[#333333]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{isComparing ? 'Asli' : 'Bandingkan'}</span>
            </button>

            {isProcessing && (
              <div className="absolute inset-0 z-30 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#14b8a6] animate-spin" />
              </div>
            )}

            {currentPage && (
              <img
                src={
                  isComparing
                    ? currentPage.warpedImage || currentPage.originalImage
                    : currentPage.processedImage
                }
                alt="Pratinjau Dokumen"
                className="max-h-[55vh] md:max-h-[480px] max-w-full object-contain shadow-2xl rounded-xs"
              />
            )}

            {/* Popup Slider Kecerahan & Kontras jika pengguna mengetuk ikon slider pada Ajaib Pro */}
            {showAdjustSliders && currentPage && (
              <div className="absolute bottom-2 inset-x-4 max-w-sm mx-auto bg-[#222222]/95 backdrop-blur-md border border-gray-700 rounded-xl p-3 z-20 space-y-2 shadow-xl">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">Sesuaikan Intensitas Filter</span>
                  <button
                    onClick={() => setShowAdjustSliders(false)}
                    className="text-[#14b8a6] font-semibold"
                  >
                    Selesai
                  </button>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="w-20 text-gray-400">Kecerahan</span>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={currentPage.filters.brightness}
                    onChange={(e) => updateFilterSetting({ brightness: Number(e.target.value) })}
                    className="flex-1 accent-[#14b8a6]"
                  />
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="w-20 text-gray-400">Kontras</span>
                  <input
                    type="range"
                    min="-30"
                    max="50"
                    value={currentPage.filters.contrast}
                    onChange={(e) => updateFilterSetting({ contrast: Number(e.target.value) })}
                    className="flex-1 accent-[#14b8a6]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Panel Bawah: Deretan Kartu Thumbnail Filter + Toolbar Aksi CamScanner */}
          <div className="bg-[#161616] border-t border-gray-800 shrink-0">
            {/* Strip Kartu Thumbnail Filter */}
            <div className="flex items-center space-x-2.5 overflow-x-auto px-3 py-2.5 scrollbar-none">
              {CAMSCANNER_FILTERS.map((f) => {
                const isSelected = currentPage?.filters.filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      if (isSelected) {
                        setShowAdjustSliders((v) => !v);
                      } else {
                        updateFilterSetting({ filter: f.id });
                      }
                    }}
                    className={`relative shrink-0 w-18 h-22 rounded-md overflow-hidden border-2 transition flex flex-col justify-between ${
                      isSelected ? 'border-[#14b8a6] ring-1 ring-[#14b8a6]' : 'border-transparent'
                    }`}
                  >
                    {f.badge && (
                      <span className="absolute top-0 right-0 z-10 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl">
                        {f.badge}
                      </span>
                    )}

                    {/* Mini Thumbnail Preview */}
                    <div className="w-full h-16 bg-white overflow-hidden relative">
                      {currentPage && (
                        <img
                          src={currentPage.warpedImage || currentPage.processedImage}
                          alt={f.name}
                          className={`w-full h-full object-cover ${
                            f.id === 'bw'
                              ? 'grayscale contrast-200 brightness-110'
                              : f.id === 'grayscale'
                              ? 'grayscale'
                              : f.id === 'magic_color' || f.id === 'sharpen'
                              ? 'contrast-150 brightness-110'
                              : f.id === 'lighten'
                              ? 'brightness-110'
                              : ''
                          }`}
                        />
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#14b8a6]/30 flex items-center justify-center">
                          <Sliders className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      )}
                    </div>

                    {/* Label Nama Filter */}
                    <div
                      className={`w-full py-1 text-[10px] font-medium text-center truncate px-1 ${
                        isSelected ? 'bg-[#14b8a6] text-white' : 'bg-[#2a2a2a] text-gray-200'
                      }`}
                    >
                      {f.name}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Action Bar: Kiri | Tandai | Ekstrak Teks | Tanda tangani | [ ✓ ] */}
            <div className="h-15 px-3 bg-[#1b1b1b] border-t border-gray-800 flex items-center justify-between">
              <div className="flex items-center justify-around flex-1 mr-2">
                <button
                  onClick={() =>
                    updateFilterSetting({
                      rotation: ((currentPage?.filters.rotation || 0) + 270) % 360
                    })
                  }
                  className="flex flex-col items-center space-y-1 text-gray-200 hover:text-white transition"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-[10px]">Kiri</span>
                </button>

                <button
                  onClick={() => setShowHighlightModal(true)}
                  className="flex flex-col items-center space-y-1 text-gray-200 hover:text-white transition"
                >
                  <Edit3 className="w-5 h-5" />
                  <span className="text-[10px]">Tandai</span>
                </button>

                <button
                  onClick={() => handleRunOcr()}
                  className="relative flex flex-col items-center space-y-1 text-gray-200 hover:text-white transition"
                >
                  <FileText className="w-5 h-5" />
                  <span className="text-[10px]">Ekstrak Teks</span>
                </button>

                <button
                  onClick={() => setShowSignatureModal(true)}
                  className="flex flex-col items-center space-y-1 text-gray-200 hover:text-white transition"
                >
                  <PenTool className="w-5 h-5" />
                  <span className="text-[10px]">Tanda tangani</span>
                </button>
              </div>

              {/* Tombol Hijau/Teal Centang [ ✓ ] khas CamScanner */}
              <button
                onClick={() => setActiveStep('review')}
                className="w-14 h-10 bg-[#14b8a6] hover:bg-[#0d9488] text-white rounded-md flex items-center justify-center shadow-lg active:scale-95 transition shrink-0"
                title="Selesai Edit Halaman"
              >
                <Check className="w-6 h-6 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =====================================================================
           LAYAR 5: HALAMAN DOKUMEN FINAL CAMSCANNER ("1/1" + "+ Tambahkan")
           ===================================================================== */
        <div className="flex-1 flex flex-col justify-between bg-[#f4f5f7] text-gray-800 overflow-hidden">
          {/* Header Putih ala CamScanner */}
          <div className="h-14 px-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <button
                onClick={() => setActiveStep('filter')}
                className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-full transition shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {isEditingTitle ? (
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                  autoFocus
                  className="bg-gray-50 text-gray-900 text-sm font-semibold px-2 py-1 rounded border border-[#14b8a6] focus:outline-none w-full max-w-xs"
                />
              ) : (
                <div
                  onClick={() => setIsEditingTitle(true)}
                  className="flex items-center space-x-1.5 min-w-0 cursor-pointer"
                >
                  <span className="text-base font-semibold text-gray-900 truncate">
                    {docName}
                  </span>
                  <Edit3 className="w-4 h-4 text-gray-500 shrink-0" />
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 shrink-0 ml-2">
              <span className="px-2 py-0.5 text-xs border border-gray-300 text-gray-600 rounded">
                Tag +
              </span>
              <button
                onClick={() => handleSaveToExplorer('pdf', false)}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-[#14b8a6] hover:bg-[#0d9488] text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                Simpan PDF
              </button>
            </div>
          </div>

          {/* Daftar Kartu Halaman Dokumen ("1/1") + Tombol Dashed "+ Tambahkan" */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 max-w-2xl w-full mx-auto">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => setCurrentPageIndex(idx)}
                className={`relative bg-white rounded-md shadow-sm border transition p-2 ${
                  idx === currentPageIndex ? 'border-[#14b8a6] ring-1 ring-[#14b8a6]/30' : 'border-gray-200'
                }`}
              >
                {/* Badge Nomor Halaman "1/1" di Pojok Kiri Atas */}
                <div className="absolute top-3 left-0 bg-black/65 text-white text-xs font-medium px-2.5 py-0.5 rounded-r">
                  {idx + 1}/{pages.length}
                </div>

                {/* Tombol Hapus Halaman jika lebih dari 1 halaman */}
                {pages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = pages.filter((_, i) => i !== idx);
                      setPages(next);
                      setCurrentPageIndex(Math.max(0, idx - 1));
                    }}
                    className="absolute top-3 right-3 p-1.5 bg-white/90 hover:bg-red-50 text-red-500 rounded-full shadow border border-gray-200"
                    title="Hapus Halaman"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <img
                  src={p.processedImage}
                  alt={`Halaman ${idx + 1}`}
                  className="w-full max-h-[60vh] object-contain mx-auto"
                />
              </div>
            ))}

            {/* Kartu Dashed "+ Tambahkan" persis seperti di CamScanner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="w-full py-5 border-2 border-dashed border-gray-300 hover:border-[#14b8a6] bg-white/60 hover:bg-white rounded-lg flex items-center justify-center space-x-2 text-gray-500 hover:text-[#14b8a6] cursor-pointer transition">
                <Camera className="w-5 h-5" />
                <span className="text-sm font-medium">+ Tambahkan (Kamera)</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <label className="w-full py-5 border-2 border-dashed border-gray-300 hover:border-[#14b8a6] bg-white/60 hover:bg-white rounded-lg flex items-center justify-center space-x-2 text-gray-500 hover:text-[#14b8a6] cursor-pointer transition">
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">+ Tambahkan (Galeri)</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Bottom Bar Putih Persis CamScanner: Tambah | Edit | Bagikan/Simpan | Ke Word | Tanda tangani */}
          <div className="h-16 bg-white border-t border-gray-200 px-3 flex items-center justify-around shrink-0">
            <label className="flex flex-col items-center space-y-1 text-gray-700 hover:text-[#14b8a6] cursor-pointer transition">
              <Camera className="w-5 h-5" />
              <span className="text-[11px]">Tambah</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={() => setActiveStep('filter')}
              className="flex flex-col items-center space-y-1 text-gray-700 hover:text-[#14b8a6] transition"
            >
              <Edit3 className="w-5 h-5" />
              <span className="text-[11px]">Edit</span>
            </button>

            <button
              onClick={() => setShowSaveSheet(true)}
              className="flex flex-col items-center space-y-1 text-[#14b8a6] font-semibold transition"
            >
              <Share2 className="w-5 h-5" />
              <span className="text-[11px]">Bagikan / Simpan</span>
            </button>

            <button
              onClick={handleExportToWord}
              className="flex flex-col items-center space-y-1 text-gray-700 hover:text-[#14b8a6] transition"
            >
              <FileText className="w-5 h-5" />
              <span className="text-[11px]">Ke Word</span>
            </button>

            <button
              onClick={() => setShowSignatureModal(true)}
              className="flex flex-col items-center space-y-1 text-gray-700 hover:text-[#14b8a6] transition"
            >
              <PenTool className="w-5 h-5" />
              <span className="text-[11px]">Tanda tangani</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL / BOTTOM SHEET: BAGIKAN & SIMPAN KE FILE EXPLORER / HP
         ===================================================================== */}
      {showSaveSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowSaveSheet(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Simpan & Bagikan Dokumen</h4>
                <p className="text-xs text-gray-500 truncate max-w-xs">
                  {docName} ({pages.length} Halaman)
                </p>
              </div>
              <button
                onClick={() => setShowSaveSheet(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => handleSaveToExplorer('pdf', false)}
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-[#14b8a6] hover:bg-[#0d9488] text-white rounded-xl text-xs font-semibold flex items-center justify-between transition shadow"
              >
                <div className="flex items-center space-x-2.5">
                  <FileText className="w-5 h-5" />
                  <span>Simpan sebagai PDF ke File Explorer</span>
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleSaveToExplorer('jpg', false)}
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-between transition shadow"
              >
                <div className="flex items-center space-x-2.5">
                  <ImageIcon className="w-5 h-5" />
                  <span>Simpan sebagai Gambar JPG ke File Explorer</span>
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => handleSaveToExplorer('pdf', true)}
                  disabled={isProcessing}
                  className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 transition"
                >
                  <Download className="w-4 h-4 text-teal-600" />
                  <span>Unduh PDF ke HP</span>
                </button>

                <button
                  onClick={() => handleSaveToExplorer('jpg', true)}
                  disabled={isProcessing}
                  className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 transition"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Unduh JPG ke HP</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: EKSTRAK TEKS (OCR)
         ===================================================================== */}
      {showOcrModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-bold text-gray-900">Ekstrak Teks Dokumen (OCR)</h4>
              <button
                onClick={() => setShowOcrModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isRunningOcr ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-[#14b8a6] animate-spin" />
                <p className="text-xs text-gray-600 font-medium">
                  Membaca teks dari dokumen... {ocrProgress}%
                </p>
              </div>
            ) : (
              <>
                <textarea
                  value={ocrTextResult}
                  onChange={(e) => setOcrTextResult(e.target.value)}
                  rows={8}
                  className="w-full p-3 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-[#14b8a6] font-mono text-gray-800"
                />
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(ocrTextResult);
                      alert('Teks berhasil disalin ke clipboard!');
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-medium flex items-center space-x-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Salin Teks</span>
                  </button>
                  <button
                    onClick={() => setShowOcrModal(false)}
                    className="px-4 py-2 bg-[#14b8a6] text-white rounded-lg text-xs font-semibold"
                  >
                    Selesai
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: TANDA TANGANI DOKUMEN
         ===================================================================== */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-bold text-gray-900">Bubuhkan Tanda Tangan</h4>
              <button
                onClick={() => setShowSignatureModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Goreskan tanda tangan Anda di kotak bawah ini:
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden">
              <canvas
                ref={sigCanvasRef}
                width={380}
                height={180}
                className="w-full h-44 touch-none cursor-crosshair"
                onMouseDown={(e) => {
                  const canvas = sigCanvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext('2d')!;
                  ctx.strokeStyle = '#0f172a';
                  ctx.lineWidth = 2.8;
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.moveTo(
                    ((e.clientX - rect.left) / rect.width) * canvas.width,
                    ((e.clientY - rect.top) / rect.height) * canvas.height
                  );
                  setIsDrawingSig(true);
                }}
                onMouseMove={(e) => {
                  if (!isDrawingSig || !sigCanvasRef.current) return;
                  const canvas = sigCanvasRef.current;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext('2d')!;
                  ctx.lineTo(
                    ((e.clientX - rect.left) / rect.width) * canvas.width,
                    ((e.clientY - rect.top) / rect.height) * canvas.height
                  );
                  ctx.stroke();
                }}
                onMouseUp={() => setIsDrawingSig(false)}
                onTouchStart={(e) => {
                  const canvas = sigCanvasRef.current;
                  if (!canvas || e.touches.length === 0) return;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext('2d')!;
                  ctx.strokeStyle = '#0f172a';
                  ctx.lineWidth = 2.8;
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.moveTo(
                    ((e.touches[0].clientX - rect.left) / rect.width) * canvas.width,
                    ((e.touches[0].clientY - rect.top) / rect.height) * canvas.height
                  );
                  setIsDrawingSig(true);
                }}
                onTouchMove={(e) => {
                  if (!isDrawingSig || !sigCanvasRef.current || e.touches.length === 0) return;
                  const canvas = sigCanvasRef.current;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext('2d')!;
                  ctx.lineTo(
                    ((e.touches[0].clientX - rect.left) / rect.width) * canvas.width,
                    ((e.touches[0].clientY - rect.top) / rect.height) * canvas.height
                  );
                  ctx.stroke();
                }}
                onTouchEnd={() => setIsDrawingSig(false)}
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  const canvas = sigCanvasRef.current;
                  if (canvas) {
                    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
                  }
                }}
                className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium"
              >
                Bersihkan
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleApplySignature}
                  className="px-4 py-2 bg-[#14b8a6] text-white rounded-lg text-xs font-semibold"
                >
                  Tempel ke Dokumen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: TANDAI (STABILO / ANOTASI DOKUMEN)
         ===================================================================== */}
      {showHighlightModal && currentPage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-sm font-bold text-gray-900">Tandai Dokumen (Stabilo Kuning)</h4>
              <button
                onClick={() => setShowHighlightModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex items-center justify-center bg-gray-900 rounded-xl overflow-hidden max-h-[55vh]">
              <img
                src={currentPage.processedImage}
                alt="Tandai"
                className="max-h-[55vh] w-auto object-contain"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (markCanvasRef.current) {
                    markCanvasRef.current.width = img.clientWidth;
                    markCanvasRef.current.height = img.clientHeight;
                  }
                }}
              />
              <canvas
                ref={markCanvasRef}
                className="absolute inset-0 m-auto touch-none cursor-crosshair"
                onMouseDown={(e) => {
                  const canvas = markCanvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext('2d')!;
                  ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
                  ctx.lineWidth = 14;
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                  setIsDrawingMark(true);
                }}
                onMouseMove={(e) => {
                  if (!isDrawingMark || !markCanvasRef.current) return;
                  const canvas = markCanvasRef.current;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext('2d')!;
                  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                  ctx.stroke();
                }}
                onMouseUp={() => setIsDrawingMark(false)}
                onTouchStart={(e) => {
                  const canvas = markCanvasRef.current;
                  if (!canvas || e.touches.length === 0) return;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext('2d')!;
                  ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
                  ctx.lineWidth = 14;
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.moveTo(
                    e.touches[0].clientX - rect.left,
                    e.touches[0].clientY - rect.top
                  );
                  setIsDrawingMark(true);
                }}
                onTouchMove={(e) => {
                  if (!isDrawingMark || !markCanvasRef.current || e.touches.length === 0) return;
                  const canvas = markCanvasRef.current;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext('2d')!;
                  ctx.lineTo(
                    e.touches[0].clientX - rect.left,
                    e.touches[0].clientY - rect.top
                  );
                  ctx.stroke();
                }}
                onTouchEnd={() => setIsDrawingMark(false)}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowHighlightModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleApplyHighlight}
                className="px-4 py-2 bg-[#14b8a6] text-white rounded-lg text-xs font-semibold"
              >
                Terapkan Tandai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
