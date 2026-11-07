import { createWorker } from 'tesseract.js';

export interface OcrProgressCallback {
  (progress: number, statusText: string): void;
}

/**
 * Ekstraksi teks dari gambar menggunakan Tesseract.js (Bahasa Indonesia & English)
 */
export async function extractTextFromImage(
  imageSource: string | Blob,
  language: string = 'ind+eng',
  onProgress?: OcrProgressCallback
): Promise<string> {
  const worker = await createWorker(language, 1, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100), 'Mengenali teks dokumen...');
      } else if (onProgress) {
        onProgress(0, m.status || 'Mempersiapkan OCR...');
      }
    }
  });

  try {
    const ret = await worker.recognize(imageSource);
    await worker.terminate();
    return ret.data.text.trim();
  } catch (err) {
    await worker.terminate();
    throw new Error('Gagal mengekstrak teks OCR: ' + (err as Error).message);
  }
}
