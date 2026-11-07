import React, { useRef, useEffect, useState } from 'react';
import { CropPoints } from '../../types';

interface CropEditorProps {
  imageSrc: string;
  cropPoints: CropPoints;
  onChangePoints: (points: CropPoints) => void;
}

type HandleType =
  | 'topLeft'
  | 'topRight'
  | 'bottomRight'
  | 'bottomLeft'
  | 'topEdge'
  | 'rightEdge'
  | 'bottomEdge'
  | 'leftEdge';

export const CropEditor: React.FC<CropEditorProps> = ({
  imageSrc,
  cropPoints,
  onChangePoints
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [activeHandle, setActiveHandle] = useState<HandleType | null>(null);
  const [dragStartPointer, setDragStartPointer] = useState<{ x: number; y: number } | null>(null);
  const [dragStartPoints, setDragStartPoints] = useState<CropPoints | null>(null);
  const [pointerCanvasPos, setPointerCanvasPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [imageSrc]);

  // Sinkronisasi ukuran canvas saat gambar selesai dimuat atau ukuran layar berubah
  const syncCanvasSize = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (img && canvas && img.clientWidth > 0 && img.clientHeight > 0) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
    }
  };

  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, []);

  // Render garis potong, 4 sudut lingkaran, 4 pill tengah sisi, dan kaca pembesar (loupe) ala CamScanner
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || imageSize.width === 0 || canvas.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / imageSize.width;
    const scaleY = canvas.height / imageSize.height;

    const p = {
      tl: { x: cropPoints.topLeft.x * scaleX, y: cropPoints.topLeft.y * scaleY },
      tr: { x: cropPoints.topRight.x * scaleX, y: cropPoints.topRight.y * scaleY },
      br: { x: cropPoints.bottomRight.x * scaleX, y: cropPoints.bottomRight.y * scaleY },
      bl: { x: cropPoints.bottomLeft.x * scaleX, y: cropPoints.bottomLeft.y * scaleY }
    };

    // Titik tengah ke-4 sisi untuk pill handle CamScanner
    const mid = {
      top: { x: (p.tl.x + p.tr.x) / 2, y: (p.tl.y + p.tr.y) / 2 },
      right: { x: (p.tr.x + p.br.x) / 2, y: (p.tr.y + p.br.y) / 2 },
      bottom: { x: (p.bl.x + p.br.x) / 2, y: (p.bl.y + p.br.y) / 2 },
      left: { x: (p.tl.x + p.bl.x) / 2, y: (p.tl.y + p.bl.y) / 2 }
    };

    // Redup sangat halus di luar area seleksi (seperti CamScanner agar tepi kertas tetap jelas)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p.tl.x, p.tl.y);
    ctx.lineTo(p.tr.x, p.tr.y);
    ctx.lineTo(p.br.x, p.br.y);
    ctx.lineTo(p.bl.x, p.bl.y);
    ctx.closePath();
    ctx.clip();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Garis poligon utama warna Teal/Mint khas CamScanner (#14b8a6)
    ctx.beginPath();
    ctx.moveTo(p.tl.x, p.tl.y);
    ctx.lineTo(p.tr.x, p.tr.y);
    ctx.lineTo(p.br.x, p.br.y);
    ctx.lineTo(p.bl.x, p.bl.y);
    ctx.closePath();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#14b8a6';
    ctx.stroke();

    // Gambar 4 Pill Handle di tengah sisi (Atas, Bawah, Kiri, Kanan) ala CamScanner
    const drawEdgePill = (
      pt: { x: number; y: number },
      angleRad: number,
      isActive: boolean
    ) => {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(angleRad);

      const pillW = isActive ? 30 : 26;
      const pillH = isActive ? 11 : 9;
      const r = pillH / 2;

      ctx.beginPath();
      ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, r);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#14b8a6';
      ctx.stroke();
      ctx.restore();
    };

    const topAngle = Math.atan2(p.tr.y - p.tl.y, p.tr.x - p.tl.x);
    const bottomAngle = Math.atan2(p.br.y - p.bl.y, p.br.x - p.bl.x);
    const leftAngle = Math.atan2(p.bl.y - p.tl.y, p.bl.x - p.tl.x);
    const rightAngle = Math.atan2(p.br.y - p.tr.y, p.br.x - p.tr.x);

    drawEdgePill(mid.top, topAngle, activeHandle === 'topEdge');
    drawEdgePill(mid.bottom, bottomAngle, activeHandle === 'bottomEdge');
    drawEdgePill(mid.left, leftAngle, activeHandle === 'leftEdge');
    drawEdgePill(mid.right, rightAngle, activeHandle === 'rightEdge');

    // Gambar 4 Lingkaran Sudut khas CamScanner
    const drawCornerCircle = (pt: { x: number; y: number }, isActive: boolean) => {
      if (isActive) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 184, 166, 0.32)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isActive ? 10.5 : 9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#14b8a6';
      ctx.stroke();
    };

    drawCornerCircle(p.tl, activeHandle === 'topLeft');
    drawCornerCircle(p.tr, activeHandle === 'topRight');
    drawCornerCircle(p.br, activeHandle === 'bottomRight');
    drawCornerCircle(p.bl, activeHandle === 'bottomLeft');

    // Kaca Pembesar (Magnifier Loupe) saat jari menggeser titik sudut/sisi
    if (activeHandle && pointerCanvasPos && imgRef.current) {
      const loupeRadius = 42;
      // Tempatkan loupe di pojok kiri atas, atau pindah ke kanan atas jika jari berada di pojok kiri atas
      const isFingerNearTopLeft = pointerCanvasPos.x < 110 && pointerCanvasPos.y < 110;
      const loupeX = isFingerNearTopLeft ? canvas.width - loupeRadius - 12 : loupeRadius + 12;
      const loupeY = loupeRadius + 12;

      const zoom = 2.2;
      const srcX = (pointerCanvasPos.x / canvas.width) * imageSize.width;
      const srcY = (pointerCanvasPos.y / canvas.height) * imageSize.height;
      const sampleRadiusX = (loupeRadius / zoom) * (imageSize.width / canvas.width);
      const sampleRadiusY = (loupeRadius / zoom) * (imageSize.height / canvas.height);

      ctx.save();
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#000000';
      ctx.fillRect(loupeX - loupeRadius, loupeY - loupeRadius, loupeRadius * 2, loupeRadius * 2);

      ctx.drawImage(
        imgRef.current,
        srcX - sampleRadiusX,
        srcY - sampleRadiusY,
        sampleRadiusX * 2,
        sampleRadiusY * 2,
        loupeX - loupeRadius,
        loupeY - loupeRadius,
        loupeRadius * 2,
        loupeRadius * 2
      );

      // Crosshair presisi di tengah kaca pembesar
      ctx.strokeStyle = '#14b8a6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(loupeX - 12, loupeY);
      ctx.lineTo(loupeX + 12, loupeY);
      ctx.moveTo(loupeX, loupeY - 12);
      ctx.lineTo(loupeX, loupeY + 12);
      ctx.stroke();
      ctx.restore();

      // Bingkai kaca pembesar
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#14b8a6';
      ctx.stroke();
    }
  }, [cropPoints, imageSize, activeHandle, pointerCanvasPos]);

  const handlePointerDown = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || imageSize.width === 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const scaleX = canvas.width / imageSize.width;
    const scaleY = canvas.height / imageSize.height;

    const tl = { x: cropPoints.topLeft.x * scaleX, y: cropPoints.topLeft.y * scaleY };
    const tr = { x: cropPoints.topRight.x * scaleX, y: cropPoints.topRight.y * scaleY };
    const br = { x: cropPoints.bottomRight.x * scaleX, y: cropPoints.bottomRight.y * scaleY };
    const bl = { x: cropPoints.bottomLeft.x * scaleX, y: cropPoints.bottomLeft.y * scaleY };

    const handles: { key: HandleType; x: number; y: number }[] = [
      { key: 'topLeft', x: tl.x, y: tl.y },
      { key: 'topRight', x: tr.x, y: tr.y },
      { key: 'bottomRight', x: br.x, y: br.y },
      { key: 'bottomLeft', x: bl.x, y: bl.y },
      { key: 'topEdge', x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 },
      { key: 'rightEdge', x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 },
      { key: 'bottomEdge', x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 },
      { key: 'leftEdge', x: (tl.x + bl.x) / 2, y: (tl.y + bl.y) / 2 }
    ];

    let closestKey: HandleType | null = null;
    let minDist = 44;

    for (const h of handles) {
      const dist = Math.hypot(h.x - clickX, h.y - clickY);
      if (dist < minDist) {
        minDist = dist;
        closestKey = h.key;
      }
    }

    if (closestKey) {
      setActiveHandle(closestKey);
      setDragStartPointer({ x: clickX, y: clickY });
      setDragStartPoints(cropPoints);
      setPointerCanvasPos({ x: clickX, y: clickY });
    }
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!activeHandle || !canvasRef.current || imageSize.width === 0) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(canvas.width, clientX - rect.left));
    const mouseY = Math.max(0, Math.min(canvas.height, clientY - rect.top));

    setPointerCanvasPos({ x: mouseX, y: mouseY });

    const scaleX = imageSize.width / canvas.width;
    const scaleY = imageSize.height / canvas.height;

    const clampX = (v: number) => Math.max(0, Math.min(imageSize.width, Math.round(v)));
    const clampY = (v: number) => Math.max(0, Math.min(imageSize.height, Math.round(v)));

    if (
      activeHandle === 'topLeft' ||
      activeHandle === 'topRight' ||
      activeHandle === 'bottomRight' ||
      activeHandle === 'bottomLeft'
    ) {
      onChangePoints({
        ...cropPoints,
        [activeHandle]: {
          x: clampX(mouseX * scaleX),
          y: clampY(mouseY * scaleY)
        }
      });
    } else if (dragStartPointer && dragStartPoints) {
      const dx = (mouseX - dragStartPointer.x) * scaleX;
      const dy = (mouseY - dragStartPointer.y) * scaleY;

      if (activeHandle === 'topEdge') {
        onChangePoints({
          ...cropPoints,
          topLeft: {
            x: dragStartPoints.topLeft.x,
            y: clampY(dragStartPoints.topLeft.y + dy)
          },
          topRight: {
            x: dragStartPoints.topRight.x,
            y: clampY(dragStartPoints.topRight.y + dy)
          }
        });
      } else if (activeHandle === 'bottomEdge') {
        onChangePoints({
          ...cropPoints,
          bottomLeft: {
            x: dragStartPoints.bottomLeft.x,
            y: clampY(dragStartPoints.bottomLeft.y + dy)
          },
          bottomRight: {
            x: dragStartPoints.bottomRight.x,
            y: clampY(dragStartPoints.bottomRight.y + dy)
          }
        });
      } else if (activeHandle === 'leftEdge') {
        onChangePoints({
          ...cropPoints,
          topLeft: {
            x: clampX(dragStartPoints.topLeft.x + dx),
            y: dragStartPoints.topLeft.y
          },
          bottomLeft: {
            x: clampX(dragStartPoints.bottomLeft.x + dx),
            y: dragStartPoints.bottomLeft.y
          }
        });
      } else if (activeHandle === 'rightEdge') {
        onChangePoints({
          ...cropPoints,
          topRight: {
            x: clampX(dragStartPoints.topRight.x + dx),
            y: dragStartPoints.topRight.y
          },
          bottomRight: {
            x: clampX(dragStartPoints.bottomRight.x + dx),
            y: dragStartPoints.bottomRight.y
          }
        });
      }
    }
  };

  const handlePointerUp = () => {
    setActiveHandle(null);
    setDragStartPointer(null);
    setDragStartPoints(null);
    setPointerCanvasPos(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full h-full max-h-[70vh] md:max-h-[580px] bg-black overflow-hidden select-none"
    >
      <img
        ref={imgRef}
        src={imageSrc}
        alt="Scan Target"
        className="max-w-full max-h-[70vh] md:max-h-[580px] object-contain"
        onLoad={syncCanvasSize}
      />
      <canvas
        ref={canvasRef}
        onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
        className="absolute inset-0 m-auto cursor-crosshair touch-none"
      />
    </div>
  );
};
