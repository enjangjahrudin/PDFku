import { PDFDocument, rgb, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// Import worker langsung dari lokal paket via Vite URL loader (100% offline & handal)
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface JpgToPdfOptions {
  pageSize: 'A4' | 'Letter' | 'Fit';
  orientation: 'auto' | 'portrait' | 'landscape';
  margin: 'none' | 'small' | 'standard';
}

export interface ConvertProgressCallback {
  (current: number, total: number, message: string): void;
}

/**
 * Konversi Kumpulan JPG/PNG (Blob atau Data URL) menjadi 1 file PDF gabungan
 */
export async function convertJpgToPdf(
  imageBlobs: (Blob | string)[],
  options: JpgToPdfOptions = { pageSize: 'A4', orientation: 'auto', margin: 'none' }
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  // Dimensi standar dalam point (72 points per inch)
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const LETTER_WIDTH = 612.0;
  const LETTER_HEIGHT = 792.0;

  for (const item of imageBlobs) {
    let arrayBuffer: ArrayBuffer;
    let isPng = false;

    if (typeof item === 'string') {
      if (item.startsWith('data:')) {
        const commaIdx = item.indexOf(',');
        const mime = item.substring(5, commaIdx).split(';')[0];
        const base64Data = item.substring(commaIdx + 1);
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
        isPng = mime.includes('png');
      } else {
        const res = await fetch(item);
        const b = await res.blob();
        arrayBuffer = await b.arrayBuffer();
        isPng = b.type === 'image/png';
      }
    } else {
      arrayBuffer = await item.arrayBuffer();
      isPng = item.type === 'image/png';
    }

    const image = isPng
      ? await pdfDoc.embedPng(arrayBuffer)
      : await pdfDoc.embedJpg(arrayBuffer);

    const imgWidth = image.width;
    const imgHeight = image.height;
    const isImageLandscape = imgWidth > imgHeight;

    let targetWidth = A4_WIDTH;
    let targetHeight = A4_HEIGHT;

    if (options.pageSize === 'Letter') {
      targetWidth = LETTER_WIDTH;
      targetHeight = LETTER_HEIGHT;
    } else if (options.pageSize === 'Fit') {
      targetWidth = imgWidth;
      targetHeight = imgHeight;
    }

    if (options.pageSize !== 'Fit') {
      if (
        (options.orientation === 'auto' && isImageLandscape) ||
        options.orientation === 'landscape'
      ) {
        // Balik dimensi untuk orientasi landscape
        if (targetWidth < targetHeight) {
          const temp = targetWidth;
          targetWidth = targetHeight;
          targetHeight = temp;
        }
      }
    }

    // Hitung margin
    let marginVal = 0;
    if (options.margin === 'small') marginVal = 18; // ~0.25 inch
    if (options.margin === 'standard') marginVal = 36; // ~0.5 inch

    const availWidth = targetWidth - marginVal * 2;
    const availHeight = targetHeight - marginVal * 2;

    // Skala proporsional
    const scale = Math.min(availWidth / imgWidth, availHeight / imgHeight);
    const renderWidth = imgWidth * scale;
    const renderHeight = imgHeight * scale;

    const posX = marginVal + (availWidth - renderWidth) / 2;
    const posY = marginVal + (availHeight - renderHeight) / 2;

    const page = pdfDoc.addPage([targetWidth, targetHeight]);
    page.drawImage(image, {
      x: posX,
      y: posY,
      width: renderWidth,
      height: renderHeight
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Konversi Berkas PDF menjadi Array Gambar JPG (per halaman)
 */
export async function convertPdfToJpg(
  pdfBlob: Blob,
  dpi: number = 150,
  pageNumbers?: number[],
  onProgress?: ConvertProgressCallback
): Promise<{ pageNumber: number; blob: Blob; dataUrl: string }[]> {
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  const targetPages = pageNumbers && pageNumbers.length > 0
    ? pageNumbers.filter(p => p >= 1 && p <= numPages)
    : Array.from({ length: numPages }, (_, i) => i + 1);

  const results: { pageNumber: number; blob: Blob; dataUrl: string }[] = [];
  const scale = dpi / 72; // Rasio skala DPI dari 72 standard PDF points

  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i];
    if (onProgress) {
      onProgress(i + 1, targetPages.length, `Mengonversi halaman ${pageNum} dari ${numPages}...`);
    }

    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d')!;

    // Background putih bersih
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.92);
    });

    results.push({ pageNumber: pageNum, blob, dataUrl });
  }

  return results;
}

/**
 * Menggabungkan beberapa file PDF menjadi 1 file PDF tunggal
 */
export async function mergePdfFiles(pdfBlobs: Blob[]): Promise<Blob> {
  const mergedPdf = await PDFDocument.create();

  for (const blob of pdfBlobs) {
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedBytes = await mergedPdf.save();
  return new Blob([new Uint8Array(mergedBytes)], { type: 'application/pdf' });
}

/**
 * Memisahkan atau mengekstrak halaman tertentu dari PDF
 */
export async function splitPdf(
  pdfBlob: Blob,
  pageIndicesToExtract: number[]
): Promise<Blob> {
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const srcPdf = await PDFDocument.load(arrayBuffer);
  const outPdf = await PDFDocument.create();

  const validIndices = pageIndicesToExtract.filter(
    (idx) => idx >= 0 && idx < srcPdf.getPageCount()
  );

  const copiedPages = await outPdf.copyPages(srcPdf, validIndices);
  copiedPages.forEach((page) => outPdf.addPage(page));

  const outBytes = await outPdf.save();
  return new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' });
}

/**
 * Memutar halaman PDF tertentu
 */
export async function rotatePdf(
  pdfBlob: Blob,
  rotationDegrees: number = 90
): Promise<Blob> {
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();

  for (const page of pages) {
    const currentRot = page.getRotation().angle;
    page.setRotation(degrees((currentRot + rotationDegrees) % 360));
  }

  const pdfBytes = await pdf.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Kompresi PDF Cerdas dengan target ukuran maksimal (misal < 300KB, < 500KB)
 */
export async function compressPdf(
  pdfBlob: Blob,
  targetMaxBytes: number,
  onProgress?: ConvertProgressCallback
): Promise<Blob> {
  // Jika ukuran asli sudah di bawah target, kembalikan langsung
  if (pdfBlob.size <= targetMaxBytes) {
    return pdfBlob;
  }

  const arrayBuffer = await pdfBlob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  // Tentukan kualitas dan DPI berdasarkan target byte per halaman
  const bytesPerPage = targetMaxBytes / numPages;
  let targetDpi = 130;
  let jpegQuality = 0.75;

  if (bytesPerPage < 80 * 1024) {
    targetDpi = 96;
    jpegQuality = 0.55;
  } else if (bytesPerPage < 150 * 1024) {
    targetDpi = 110;
    jpegQuality = 0.65;
  }

  const compressedPdf = await PDFDocument.create();
  const scale = targetDpi / 72;

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) {
      onProgress(i, numPages, `Mengompres halaman ${i} dari ${numPages}...`);
    }

    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const imgBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', jpegQuality);
    });

    const imgBytes = await imgBlob.arrayBuffer();
    const embeddedImg = await compressedPdf.embedJpg(imgBytes);

    const origViewport = page.getViewport({ scale: 1 });
    const pdfPage = compressedPdf.addPage([origViewport.width, origViewport.height]);
    pdfPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: origViewport.width,
      height: origViewport.height
    });
  }

  const resultBytes = await compressedPdf.save();
  return new Blob([new Uint8Array(resultBytes)], { type: 'application/pdf' });
}

/**
 * Buat pratinjau thumbnail cepat dari halaman 1 berkas PDF
 */
export async function generatePdfThumbnail(pdfBlob: Blob): Promise<string | undefined> {
  try {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    if (pdfDoc.numPages < 1) return undefined;

    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 0.35 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return undefined;
  }
}
