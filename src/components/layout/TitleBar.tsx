import React from 'react';
import { Scan, FileText, Sparkles, HardDrive } from 'lucide-react';

interface TitleBarProps {
  onOpenScanner: () => void;
  onOpenConverter: () => void;
  onOpenCompressor: () => void;
  onOpenPdfTools: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onOpenScanner,
  onOpenConverter,
  onOpenCompressor,
  onOpenPdfTools
}) => {
  return (
    <header className="h-11 bg-[#f3f3f3] border-b border-[#e5e5e5] px-2.5 sm:px-3 flex items-center justify-between select-none overflow-x-auto scrollbar-none shrink-0">
      {/* Brand & Tabs */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
            <Scan className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="font-semibold text-xs sm:text-sm tracking-tight text-gray-800">
            PDFku
          </span>
        </div>

        <div className="h-4 w-px bg-gray-300 hidden sm:block" />

        {/* Quick Launch Action Pills */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          <button
            onClick={onOpenScanner}
            className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition shadow-xs shrink-0"
          >
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-200" />
            <span>Scan Dokumen</span>
          </button>

          <button
            onClick={onOpenConverter}
            className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-md transition shrink-0"
          >
            <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
            <span>PDF ↔ JPG</span>
          </button>

          <button
            onClick={onOpenCompressor}
            className="hidden sm:flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-md transition shrink-0"
          >
            <span>Kompres PDF</span>
          </button>

          <button
            onClick={onOpenPdfTools}
            className="hidden sm:flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-md transition shrink-0"
          >
            <span>PDF Toolkit</span>
          </button>
        </div>
      </div>

      {/* Right side info: Local-first indicator */}
      <div className="hidden lg:flex items-center space-x-2 text-xs text-gray-500 shrink-0 ml-2">
        <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-medium">100% Client-Side (Privat & Aman)</span>
        </span>
        <HardDrive className="w-3.5 h-3.5 text-gray-400" />
      </div>
    </header>
  );
};
