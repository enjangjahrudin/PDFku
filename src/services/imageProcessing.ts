import { CropPoints, FilterSettings } from '../types';

/**
 * Memuat gambar dari URL atau Data URL ke HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Gagal memuat gambar: ' + e));
    img.src = src;
  });
}

/**
 * Deteksi 4 sudut lembar dokumen secara otomatis & presisi tinggi:
 * 1. Pemodelan warna & kecerahan adaptif dari pusat dokumen (tahan bayangan tangan/HP & pantulan lantai)
 * 2. Connected Component Analysis tanpa mengikis sudut 90 derajat (neighbors >= 3)
 * 3. Directional Step-Edge Gradient Refinement untuk mencari transisi tepi kertas paling tajam
 * 4. Regresi Garis Tangguh Theil-Sen (4 sisi) & Perpotongan Geometri Perspektif
 */
export function detectDocumentCorners(
  canvas: HTMLCanvasElement,
  origWidth: number,
  origHeight: number
): CropPoints {
  try {
    const sampleW = 240;
    const sampleH = Math.max(120, Math.round((sampleW * origHeight) / origWidth));

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;
    const sCtx = sampleCanvas.getContext('2d');
    if (!sCtx) throw new Error('No 2D context');

    sCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
    const imgData = sCtx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;
    const totalPixels = sampleW * sampleH;

    const grayValues = new Float32Array(totalPixels);
    const satValues = new Float32Array(totalPixels);
    const warmCastValues = new Float32Array(totalPixels);
    const paperScore = new Float32Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      grayValues[i] = gray;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      satValues[i] = sat;

      // Lantai kayu/ubin cokelat/meja memiliki dominasi merah terhadap hijau/biru (R > G),
      // sedangkan kertas putih (bahkan saat terkena bayangan gelap) tetap netral (R <= G + 10)
      const warmCast = Math.max(0, (r - g) + Math.max(0, r - b) * 0.5);
      warmCastValues[i] = warmCast;

      // Skor kemiripan kertas
      paperScore[i] = gray * (1 - sat * 0.85) - warmCast * 1.1;
    }

    // 1. Ambil referensi warna kertas dari area tengah foto (28% - 72%)
    const centerScores: number[] = [];
    const centerGrays: number[] = [];
    const cx0 = Math.floor(sampleW * 0.28);
    const cx1 = Math.floor(sampleW * 0.72);
    const cy0 = Math.floor(sampleH * 0.28);
    const cy1 = Math.floor(sampleH * 0.72);

    for (let y = cy0; y <= cy1; y++) {
      for (let x = cx0; x <= cx1; x++) {
        const idx = y * sampleW + x;
        centerScores.push(paperScore[idx]);
        centerGrays.push(grayValues[idx]);
      }
    }
    centerScores.sort((a, b) => a - b);
    centerGrays.sort((a, b) => a - b);

    // Persentil ke-75 mewakili permukaan kertas bersih (mengabaikan teks hitam di dalam kertas)
    const refScore = centerScores[Math.floor(centerScores.length * 0.75)] || 150;
    const refGray = centerGrays[Math.floor(centerGrays.length * 0.75)] || 170;

    // 2. Mask biner kandidat kertas (mendukung area kertas terang & area kertas berbayang)
    const binaryMask = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      const g = grayValues[i];
      const s = satValues[i];
      const wc = warmCastValues[i];
      const sc = paperScore[i];

      const isMainPaper = sc >= refScore * 0.62 && g >= refGray * 0.60 && s < 0.32;
      const isShadowedPaper =
        g >= Math.max(65, refGray * 0.38) && s < 0.28 && wc < 10 && sc >= refScore * 0.38;

      if (isMainPaper || isShadowedPaper) {
        binaryMask[i] = 1;
      }
    }

    // 3. Filter noise ringan (neighbors >= 3 agar sudut siku 90° yang memiliki 4 piksel TIDAK terkikis)
    const cleanMask = new Uint8Array(totalPixels);
    for (let y = 1; y < sampleH - 1; y++) {
      for (let x = 1; x < sampleW - 1; x++) {
        const idx = y * sampleW + x;
        if (binaryMask[idx] === 1) {
          let count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (binaryMask[(y + dy) * sampleW + (x + dx)] === 1) count++;
            }
          }
          if (count >= 3) cleanMask[idx] = 1;
        }
      }
    }

    // 4. Connected Component Analysis: isolasi lembaran kertas terbesar
    const visited = new Uint8Array(totalPixels);
    let largestComp: { x: number; y: number }[] = [];

    for (let y = 1; y < sampleH - 1; y++) {
      for (let x = 1; x < sampleW - 1; x++) {
        const idx = y * sampleW + x;
        if (cleanMask[idx] === 1 && visited[idx] === 0) {
          const queue = [idx];
          visited[idx] = 1;
          const comp: { x: number; y: number }[] = [{ x, y }];
          let head = 0;

          while (head < queue.length) {
            const curr = queue[head++];
            const cy = Math.floor(curr / sampleW);
            const cx = curr % sampleW;

            const nbs = [
              cy > 0 ? (cy - 1) * sampleW + cx : -1,
              cy < sampleH - 1 ? (cy + 1) * sampleW + cx : -1,
              cx > 0 ? cy * sampleW + (cx - 1) : -1,
              cx < sampleW - 1 ? cy * sampleW + (cx + 1) : -1
            ];

            for (const n of nbs) {
              if (n !== -1 && cleanMask[n] === 1 && visited[n] === 0) {
                visited[n] = 1;
                queue.push(n);
                comp.push({ x: n % sampleW, y: Math.floor(n / sampleW) });
              }
            }
          }

          if (comp.length > largestComp.length) {
            largestComp = comp;
          }
        }
      }
    }

    if (largestComp.length > totalPixels * 0.06) {
      const compMask = new Uint8Array(totalPixels);
      let minX = sampleW;
      let maxX = 0;
      let minY = sampleH;
      let maxY = 0;

      for (const p of largestComp) {
        compMask[p.y * sampleW + p.x] = 1;
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const spanW = maxX - minX;
      const spanH = maxY - minY;

      // 5. Directional Step-Edge Gradient Refinement pada ke-4 sisi kertas
      const searchRadius = Math.max(6, Math.round(Math.min(sampleW, sampleH) * 0.05));

      const topPts: { u: number; v: number }[] = [];
      const bottomPts: { u: number; v: number }[] = [];
      const xStart = Math.floor(minX + spanW * 0.12);
      const xEnd = Math.ceil(maxX - spanW * 0.12);

      for (let x = xStart; x <= xEnd; x++) {
        let rawTop = -1;
        let rawBot = -1;
        for (let y = minY; y <= maxY; y++) {
          if (compMask[y * sampleW + x] === 1) {
            rawTop = y;
            break;
          }
        }
        for (let y = maxY; y >= minY; y--) {
          if (compMask[y * sampleW + x] === 1) {
            rawBot = y;
            break;
          }
        }

        if (rawTop !== -1 && rawBot !== -1 && rawBot - rawTop > spanH * 0.45) {
          // Cari lonjakan gradien terkuat di sekitar tepi atas
          let bestTopY = rawTop;
          let maxTopGrad = -Infinity;
          const tMin = Math.max(2, rawTop - searchRadius);
          const tMax = Math.min(sampleH - 4, rawTop + searchRadius);
          for (let y = tMin; y <= tMax; y++) {
            const insideScore =
              (paperScore[(y + 2) * sampleW + x] + paperScore[(y + 3) * sampleW + x]) * 0.5;
            const outsideScore =
              (paperScore[(y - 2) * sampleW + x] + paperScore[(y - 1) * sampleW + x]) * 0.5;
            const grad = insideScore - outsideScore;
            if (grad > maxTopGrad && insideScore > refScore * 0.42) {
              maxTopGrad = grad;
              bestTopY = y;
            }
          }
          topPts.push({ u: x, v: bestTopY });

          // Cari lonjakan gradien terkuat di sekitar tepi bawah
          let bestBotY = rawBot;
          let maxBotGrad = -Infinity;
          const bMin = Math.max(3, rawBot - searchRadius);
          const bMax = Math.min(sampleH - 3, rawBot + searchRadius);
          for (let y = bMin; y <= bMax; y++) {
            const insideScore =
              (paperScore[(y - 2) * sampleW + x] + paperScore[(y - 3) * sampleW + x]) * 0.5;
            const outsideScore =
              (paperScore[(y + 1) * sampleW + x] + paperScore[(y + 2) * sampleW + x]) * 0.5;
            const grad = insideScore - outsideScore;
            if (grad > maxBotGrad && insideScore > refScore * 0.35) {
              maxBotGrad = grad;
              bestBotY = y;
            }
          }
          bottomPts.push({ u: x, v: bestBotY });
        }
      }

      const leftPts: { u: number; v: number }[] = [];
      const rightPts: { u: number; v: number }[] = [];
      const yStart = Math.floor(minY + spanH * 0.12);
      const yEnd = Math.ceil(maxY - spanH * 0.12);

      for (let y = yStart; y <= yEnd; y++) {
        let rawLeft = -1;
        let rawRight = -1;
        for (let x = minX; x <= maxX; x++) {
          if (compMask[y * sampleW + x] === 1) {
            rawLeft = x;
            break;
          }
        }
        for (let x = maxX; x >= minX; x--) {
          if (compMask[y * sampleW + x] === 1) {
            rawRight = x;
            break;
          }
        }

        if (rawLeft !== -1 && rawRight !== -1 && rawRight - rawLeft > spanW * 0.45) {
          // Cari lonjakan gradien terkuat di sekitar tepi kiri
          let bestLeftX = rawLeft;
          let maxLeftGrad = -Infinity;
          const lMin = Math.max(2, rawLeft - searchRadius);
          const lMax = Math.min(sampleW - 4, rawLeft + searchRadius);
          for (let x = lMin; x <= lMax; x++) {
            const insideScore =
              (paperScore[y * sampleW + (x + 2)] + paperScore[y * sampleW + (x + 3)]) * 0.5;
            const outsideScore =
              (paperScore[y * sampleW + (x - 2)] + paperScore[y * sampleW + (x - 1)]) * 0.5;
            const grad = insideScore - outsideScore;
            if (grad > maxLeftGrad && insideScore > refScore * 0.42) {
              maxLeftGrad = grad;
              bestLeftX = x;
            }
          }
          leftPts.push({ u: y, v: bestLeftX });

          // Cari lonjakan gradien terkuat di sekitar tepi kanan
          let bestRightX = rawRight;
          let maxRightGrad = -Infinity;
          const rMin = Math.max(3, rawRight - searchRadius);
          const rMax = Math.min(sampleW - 3, rawRight + searchRadius);
          for (let x = rMin; x <= rMax; x++) {
            const insideScore =
              (paperScore[y * sampleW + (x - 2)] + paperScore[y * sampleW + (x - 3)]) * 0.5;
            const outsideScore =
              (paperScore[y * sampleW + (x + 1)] + paperScore[y * sampleW + (x + 2)]) * 0.5;
            const grad = insideScore - outsideScore;
            if (grad > maxRightGrad && insideScore > refScore * 0.35) {
              maxRightGrad = grad;
              bestRightX = x;
            }
          }
          rightPts.push({ u: y, v: bestRightX });
        }
      }

      // 6. Regresi garis lurus tangguh Theil-Sen (v = m * u + c)
      const fitRobustLine = (pts: { u: number; v: number }[], quantileC = 0.5) => {
        const n = pts.length;
        if (n < 4) return { m: 0, c: pts[0]?.v || 0 };
        const slopes: number[] = [];
        const step = Math.max(1, Math.floor(n * 0.45));
        for (let i = 0; i < n - step; i++) {
          const du = pts[i + step].u - pts[i].u;
          if (du !== 0) {
            slopes.push((pts[i + step].v - pts[i].v) / du);
          }
        }
        slopes.sort((a, b) => a - b);
        const m = slopes[Math.floor(slopes.length / 2)] || 0;

        const intercepts = pts.map((p) => p.v - m * p.u).sort((a, b) => a - b);
        const idx = Math.min(
          intercepts.length - 1,
          Math.max(0, Math.floor(intercepts.length * quantileC))
        );
        const c = intercepts[idx];
        return { m, c };
      };

      const topLine = fitRobustLine(topPts, 0.5);
      const bottomLine = fitRobustLine(bottomPts, 0.5);
      const leftLine = fitRobustLine(leftPts, 0.5);
      const rightLine = fitRobustLine(rightPts, 0.5);

      const intersectHV = (
        hLine: { m: number; c: number },
        vLine: { m: number; c: number }
      ) => {
        const denom = 1 - hLine.m * vLine.m;
        const y = (hLine.m * vLine.c + hLine.c) / (Math.abs(denom) < 1e-6 ? 1 : denom);
        const x = vLine.m * y + vLine.c;
        return { x, y };
      };

      const tl = intersectHV(topLine, leftLine);
      const tr = intersectHV(topLine, rightLine);
      const br = intersectHV(bottomLine, rightLine);
      const bl = intersectHV(bottomLine, leftLine);

      const scaleX = origWidth / sampleW;
      const scaleY = origHeight / sampleH;

      const resTl = {
        x: Math.max(0, Math.min(origWidth, Math.round(tl.x * scaleX))),
        y: Math.max(0, Math.min(origHeight, Math.round(tl.y * scaleY)))
      };
      const resTr = {
        x: Math.max(0, Math.min(origWidth, Math.round(tr.x * scaleX))),
        y: Math.max(0, Math.min(origHeight, Math.round(tr.y * scaleY)))
      };
      const resBr = {
        x: Math.max(0, Math.min(origWidth, Math.round(br.x * scaleX))),
        y: Math.max(0, Math.min(origHeight, Math.round(br.y * scaleY)))
      };
      const resBl = {
        x: Math.max(0, Math.min(origWidth, Math.round(bl.x * scaleX))),
        y: Math.max(0, Math.min(origHeight, Math.round(bl.y * scaleY)))
      };

      const validWidth =
        resTr.x - resTl.x > origWidth * 0.2 && resBr.x - resBl.x > origWidth * 0.2;
      const validHeight =
        resBl.y - resTl.y > origHeight * 0.2 && resBr.y - resTr.y > origHeight * 0.2;

      if (validWidth && validHeight) {
        return {
          topLeft: resTl,
          topRight: resTr,
          bottomRight: resBr,
          bottomLeft: resBl
        };
      }
    }
  } catch (err) {
    console.warn('Deteksi otomatis kertas fallback ke margin default:', err);
  }

  // Fallback standar: margin 6%
  const marginX = origWidth * 0.06;
  const marginY = origHeight * 0.06;

  return {
    topLeft: { x: Math.round(marginX), y: Math.round(marginY) },
    topRight: { x: Math.round(origWidth - marginX), y: Math.round(marginY) },
    bottomRight: { x: Math.round(origWidth - marginX), y: Math.round(origHeight - marginY) },
    bottomLeft: { x: Math.round(marginX), y: Math.round(origHeight - marginY) }
  };
}

/**
 * Memutar gambar 90 derajat searah atau berlawanan jarum jam
 */
export async function rotateImage(
  dataUrl: string,
  degrees: 90 | -90 | 270 = 90
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.95),
    width: canvas.width,
    height: canvas.height
  };
}

export async function rotateImage90(
  dataUrl: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  return rotateImage(dataUrl, 90);
}

/**
 * Menghitung matriks proyeksi 3x3 (Homography Matrix) dari 4 sudut ke persegi panjang datar
 */
function getPerspectiveTransform(src: { x: number; y: number }[], dst: { x: number; y: number }[]): number[] {
  // Selesaikan 8 persamaan linier untuk matriks 3x3 dengan h33 = 1
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;

    a.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    a.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  // Eliminasi Gauss-Jordan sederhana untuk mencari [h11, h12, h13, h21, h22, h23, h31, h32]
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) {
        maxRow = k;
      }
    }
    const tmpA = a[i]; a[i] = a[maxRow]; a[maxRow] = tmpA;
    const tmpB = b[i]; b[i] = b[maxRow]; b[maxRow] = tmpB;

    const pivot = a[i][i];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let j = i; j < n; j++) a[i][j] /= pivot;
    b[i] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = a[k][i];
        for (let j = i; j < n; j++) a[k][j] -= factor * a[i][j];
        b[k] -= factor * b[i];
      }
    }
  }

  return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1];
}

/**
 * Invers matriks 3x3
 */
function invert3x3(m: number[]): number[] {
  const [
    m00, m01, m02,
    m10, m11, m12,
    m20, m21, m22
  ] = m;

  const det =
    m00 * (m11 * m22 - m12 * m21) -
    m01 * (m10 * m22 - m12 * m20) +
    m02 * (m10 * m21 - m11 * m20);

  if (Math.abs(det) < 1e-10) return m;

  const invDet = 1 / det;

  return [
    (m11 * m22 - m12 * m21) * invDet,
    (m02 * m21 - m01 * m22) * invDet,
    (m01 * m12 - m02 * m11) * invDet,
    (m12 * m20 - m10 * m22) * invDet,
    (m00 * m22 - m02 * m20) * invDet,
    (m02 * m10 - m00 * m12) * invDet,
    (m10 * m21 - m11 * m20) * invDet,
    (m01 * m20 - m00 * m21) * invDet,
    (m00 * m11 - m01 * m10) * invDet
  ];
}

/**
 * Melakukan perataan perspektif (Warp Perspective) dari 4 titik sudut
 */
export function warpPerspective(
  srcCanvas: HTMLCanvasElement,
  corners: CropPoints
): HTMLCanvasElement {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;

  // Hitung lebar dan tinggi dokumen baru
  const widthTop = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
  const widthBottom = Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y);
  const outWidth = Math.max(100, Math.round(Math.max(widthTop, widthBottom)));

  const heightLeft = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y);
  const heightRight = Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y);
  const outHeight = Math.max(100, Math.round(Math.max(heightLeft, heightRight)));

  const dstCorners = [
    { x: 0, y: 0 },
    { x: outWidth, y: 0 },
    { x: outWidth, y: outHeight },
    { x: 0, y: outHeight }
  ];

  const srcCorners = [topLeft, topRight, bottomRight, bottomLeft];
  const H = getPerspectiveTransform(srcCorners, dstCorners);
  const invH = invert3x3(H);

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = outWidth;
  dstCanvas.height = outHeight;
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) return srcCanvas;

  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return srcCanvas;

  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const dstData = dstCtx.createImageData(outWidth, outHeight);

  const sData = srcData.data;
  const dData = dstData.data;
  const sW = srcCanvas.width;
  const sH = srcCanvas.height;

  // Bilinear interpolation mapping
  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const z = invH[6] * x + invH[7] * y + invH[8];
      const srcX = (invH[0] * x + invH[1] * y + invH[2]) / z;
      const srcY = (invH[3] * x + invH[4] * y + invH[5]) / z;

      const dIdx = (y * outWidth + x) * 4;

      if (srcX >= 0 && srcX < sW - 1 && srcY >= 0 && srcY < sH - 1) {
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const wx = srcX - x0;
        const wy = srcY - y0;

        const idx00 = (y0 * sW + x0) * 4;
        const idx01 = (y0 * sW + x1) * 4;
        const idx10 = (y1 * sW + x0) * 4;
        const idx11 = (y1 * sW + x1) * 4;

        for (let c = 0; c < 3; c++) {
          const top = sData[idx00 + c] * (1 - wx) + sData[idx01 + c] * wx;
          const btm = sData[idx10 + c] * (1 - wx) + sData[idx11 + c] * wx;
          dData[dIdx + c] = Math.round(top * (1 - wy) + btm * wy);
        }
        dData[dIdx + 3] = 255;
      } else {
        dData[dIdx] = 255;
        dData[dIdx + 1] = 255;
        dData[dIdx + 2] = 255;
        dData[dIdx + 3] = 255;
      }
    }
  }

  dstCtx.putImageData(dstData, 0, 0);
  return dstCanvas;
}

/**
 * Estimasi peta iluminasi latar belakang 2D (Local White-Point Grid)
 * Menghilangkan bayangan HP/tangan secara merata di seluruh permukaan dokumen (CamScanner Ajaib Pro Engine)
 */
function computeIlluminationGrid(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  gridCols = 20,
  gridRows = 26
) {
  const rGrid = new Float32Array(gridCols * gridRows);
  const gGrid = new Float32Array(gridCols * gridRows);
  const bGrid = new Float32Array(gridCols * gridRows);
  const lGrid = new Float32Array(gridCols * gridRows);

  const cellW = width / gridCols;
  const cellH = height / gridRows;

  for (let gy = 0; gy < gridRows; gy++) {
    const y0 = Math.floor(gy * cellH);
    const y1 = Math.min(height - 1, Math.floor((gy + 1) * cellH));
    const stepY = Math.max(1, Math.floor((y1 - y0) / 10));

    for (let gx = 0; gx < gridCols; gx++) {
      const x0 = Math.floor(gx * cellW);
      const x1 = Math.min(width - 1, Math.floor((gx + 1) * cellW));
      const stepX = Math.max(1, Math.floor((x1 - x0) / 10));

      const samples: { r: number; g: number; b: number; l: number }[] = [];
      for (let y = y0; y <= y1; y += stepY) {
        for (let x = x0; x <= x1; x += stepX) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          samples.push({ r, g, b, l });
        }
      }

      samples.sort((a, b) => a.l - b.l);
      // Persentil ke-82 mewakili permukaan kertas putih lokal di blok tersebut (mengabaikan teks gelap)
      const pick = samples[Math.floor(samples.length * 0.82)] || { r: 200, g: 200, b: 200, l: 200 };
      const gIdx = gy * gridCols + gx;
      rGrid[gIdx] = Math.max(60, pick.r);
      gGrid[gIdx] = Math.max(60, pick.g);
      bGrid[gIdx] = Math.max(60, pick.b);
      lGrid[gIdx] = Math.max(60, pick.l);
    }
  }

  // Haluskan grid dengan 3x3 box filter (2 pass) agar transisi bayangan mulus tanpa batas kotak
  const smoothChannel = (arr: Float32Array) => {
    let curr = arr;
    for (let pass = 0; pass < 2; pass++) {
      const next = new Float32Array(gridCols * gridRows);
      for (let gy = 0; gy < gridRows; gy++) {
        for (let gx = 0; gx < gridCols; gx++) {
          let sum = 0;
          let cnt = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = gy + dy;
              const nx = gx + dx;
              if (ny >= 0 && ny < gridRows && nx >= 0 && nx < gridCols) {
                sum += curr[ny * gridCols + nx];
                cnt++;
              }
            }
          }
          next[gy * gridCols + gx] = sum / cnt;
        }
      }
      curr = next;
    }
    return curr;
  };

  return {
    rGrid: smoothChannel(rGrid),
    gGrid: smoothChannel(gGrid),
    bGrid: smoothChannel(bGrid),
    lGrid: smoothChannel(lGrid),
    gridCols,
    gridRows
  };
}

/**
 * Menerapkan Filter Ajaib ala CamScanner:
 * - magic_color ("Ajaib Pro"): Latar kertas 100% putih bersih (#ffffff), bebas bayangan, teks tajam pekat
 * - lighten ("Cerahkan"): Mencerahkan dokumen dengan tetap menjaga tekstur lembut
 * - sharpen ("Mempertajam"): Menajamkan detail huruf kecil & garis tabel
 * - no_shadow ("Tanpa Bayangan"): Menghapus bayangan tangan/HP secara merata
 * - bw ("B&W"): Hitam putih adaptif lokal bebas bercak bayangan gelap
 * - grayscale ("Abu-abu"): Skala abu-abu bersih
 * - original ("Original"): Gambar asli
 */
export function applyDocumentFilters(
  canvas: HTMLCanvasElement,
  settings: FilterSettings
): HTMLCanvasElement {
  const { filter, brightness, contrast, rotation } = settings;

  let workingCanvas = canvas;
  if (rotation !== 0) {
    const rotCanvas = document.createElement('canvas');
    const isSideways = rotation === 90 || rotation === 270;
    rotCanvas.width = isSideways ? canvas.height : canvas.width;
    rotCanvas.height = isSideways ? canvas.width : canvas.height;
    const rotCtx = rotCanvas.getContext('2d')!;

    rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rotCtx.rotate((rotation * Math.PI) / 180);
    rotCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    workingCanvas = rotCanvas;
  }

  if (filter === 'original' && brightness === 0 && contrast === 0) {
    return workingCanvas;
  }

  const w = workingCanvas.width;
  const h = workingCanvas.height;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const ctx = outCanvas.getContext('2d')!;
  ctx.drawImage(workingCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const bAdd = (brightness / 100) * 255;

  // Hitung peta iluminasi lokal untuk filter berbasis normalisasi kertas
  const illum = computeIlluminationGrid(data, w, h);
  const { rGrid, gGrid, bGrid, lGrid, gridCols, gridRows } = illum;

  const sampleIllum = (x: number, y: number) => {
    const gx = Math.max(0, Math.min(gridCols - 1.001, (x / w) * (gridCols - 1)));
    const gy = Math.max(0, Math.min(gridRows - 1.001, (y / h) * (gridRows - 1)));
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const wx = gx - x0;
    const wy = gy - y0;

    const i00 = y0 * gridCols + x0;
    const i10 = i00 + 1;
    const i01 = (y0 + 1) * gridCols + x0;
    const i11 = i01 + 1;

    const bilerp = (arr: Float32Array) =>
      (arr[i00] * (1 - wx) + arr[i10] * wx) * (1 - wy) +
      (arr[i01] * (1 - wx) + arr[i11] * wx) * wy;

    return {
      rBg: bilerp(rGrid),
      gBg: bilerp(gGrid),
      bBg: bilerp(bGrid),
      lBg: bilerp(lGrid)
    };
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (filter === 'magic_color' || filter === 'sharpen') {
        // CamScanner "Ajaib Pro" / "Mempertajam":
        // Normalisasi terhadap titik putih kertas lokal sehingga latar menjadi 100% putih bersih (#ffffff)
        const { rBg, gBg, bBg } = sampleIllum(x, y);
        let rn = Math.min(255, (r / rBg) * 255);
        let gn = Math.min(255, (g / gBg) * 255);
        let bn = Math.min(255, (b / bBg) * 255);

        const ln = 0.299 * rn + 0.587 * gn + 0.114 * bn;
        const whiteFloor = filter === 'sharpen' ? 200 : 206;

        if (ln >= whiteFloor) {
          rn = 255;
          gn = 255;
          bn = 255;
        } else if (ln > 165) {
          // Transisi halus antara tepi huruf dan kertas putih
          const t = (ln - 165) / (whiteFloor - 165);
          const curve = t * t * (3 - 2 * t);
          rn = rn + (255 - rn) * curve;
          gn = gn + (255 - gn) * curve;
          bn = bn + (255 - bn) * curve;
        } else {
          // Pekatkan teks & garis tabel agar hitam tajam seperti dokumen cetak asli
          const darkGain = filter === 'sharpen' ? 0.58 : 0.65;
          const factor = Math.pow(Math.max(0, ln / 175), 0.75) * darkGain;
          rn *= factor;
          gn *= factor;
          bn *= factor;
        }

        data[i] = Math.max(0, Math.min(255, cFactor * (rn - 128) + 128 + bAdd));
        data[i + 1] = Math.max(0, Math.min(255, cFactor * (gn - 128) + 128 + bAdd));
        data[i + 2] = Math.max(0, Math.min(255, cFactor * (bn - 128) + 128 + bAdd));
      } else if (filter === 'lighten') {
        // "Cerahkan": Angkat eksposur kertas secara lembut tanpa menghilangkan gradasi asli
        const { rBg, gBg, bBg } = sampleIllum(x, y);
        const rn = Math.min(255, (r / rBg) * 242 + 12);
        const gn = Math.min(255, (g / gBg) * 242 + 12);
        const bn = Math.min(255, (b / bBg) * 242 + 12);

        data[i] = Math.max(0, Math.min(255, cFactor * (rn - 128) + 128 + bAdd));
        data[i + 1] = Math.max(0, Math.min(255, cFactor * (gn - 128) + 128 + bAdd));
        data[i + 2] = Math.max(0, Math.min(255, cFactor * (bn - 128) + 128 + bAdd));
      } else if (filter === 'no_shadow') {
        // "Tanpa Bayangan": Ratakan iluminasi latar belakang tanpa memaksa saturasi berlebihan
        const { rBg, gBg, bBg } = sampleIllum(x, y);
        let rn = Math.min(255, (r / rBg) * 250);
        let gn = Math.min(255, (g / gBg) * 250);
        let bn = Math.min(255, (b / bBg) * 250);

        const ln = 0.299 * rn + 0.587 * gn + 0.114 * bn;
        if (ln > 218) {
          rn = 255;
          gn = 255;
          bn = 255;
        }

        data[i] = Math.max(0, Math.min(255, cFactor * (rn - 128) + 128 + bAdd));
        data[i + 1] = Math.max(0, Math.min(255, cFactor * (gn - 128) + 128 + bAdd));
        data[i + 2] = Math.max(0, Math.min(255, cFactor * (bn - 128) + 128 + bAdd));
      } else if (filter === 'bw') {
        // "B&W": Binarisasi adaptif terhadap iluminasi lokal (bebas noda bayangan hitam)
        const { lBg } = sampleIllum(x, y);
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const normGray = (gray / lBg) * 255 + bAdd * 0.5;
        const bw = normGray > 192 ? 255 : normGray < 140 ? 0 : Math.round(((normGray - 140) / 52) * 255);
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      } else if (filter === 'grayscale') {
        // "Abu-abu": Grayscale bersih dengan kompensasi bayangan
        const { lBg } = sampleIllum(x, y);
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const normGray = Math.min(255, (gray / lBg) * 250);
        const finalGray = Math.max(0, Math.min(255, cFactor * (normGray - 128) + 128 + bAdd));
        data[i] = finalGray;
        data[i + 1] = finalGray;
        data[i + 2] = finalGray;
      } else {
        data[i] = Math.max(0, Math.min(255, cFactor * (r - 128) + 128 + bAdd));
        data[i + 1] = Math.max(0, Math.min(255, cFactor * (g - 128) + 128 + bAdd));
        data[i + 2] = Math.max(0, Math.min(255, cFactor * (b - 128) + 128 + bAdd));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return outCanvas;
}
