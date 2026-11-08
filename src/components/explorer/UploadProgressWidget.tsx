import React, { useEffect, useRef } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  File,
  Folder,
  Check
} from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';

export interface UploadItemProgress {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  progressPercent: number;
}

export interface UploadBatchState {
  isOpen: boolean;
  isMinimized: boolean;
  folderName: string;
  items: UploadItemProgress[];
  totalFiles: number;
  completedFiles: number;
  isAllCompleted: boolean;
}

interface UploadProgressWidgetProps {
  state: UploadBatchState;
  onToggleMinimize: () => void;
  onClose: () => void;
}

export const UploadProgressWidget: React.FC<UploadProgressWidgetProps> = ({
  state,
  onToggleMinimize,
  onClose
}) => {
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (state.isAllCompleted && state.isOpen) {
      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
      }, 7000);
    }
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [state.isAllCompleted, state.isOpen, onClose]);

  if (!state.isOpen) return null;

  const totalFiles = state.totalFiles || state.items.length;
  const completedFiles = state.completedFiles;
  const hasErrors = state.items.some((i) => i.status === 'error');
  const overallPercent = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;

  const getFileIcon = (fileName: string, mimeType: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || mimeType.includes('pdf')) {
      return <FileText className="w-4 h-4 text-red-500 shrink-0" />;
    }
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '') || mimeType.includes('image')) {
      return <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />;
    }
    return <File className="w-4 h-4 text-gray-500 shrink-0" />;
  };

  return (
    <div
      onMouseEnter={() => {
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      }}
      className="fixed bottom-4 right-4 z-50 w-84 sm:w-96 max-w-[94vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col font-sans transition-all duration-300 animate-in slide-in-from-bottom-5"
    >
      {/* Header Widget */}
      <div
        className={`px-3.5 py-2.5 flex items-center justify-between text-white transition-colors duration-200 ${
          state.isAllCompleted
            ? hasErrors
              ? 'bg-amber-600'
              : 'bg-emerald-600'
            : 'bg-slate-900'
        }`}
      >
        <div className="flex items-center space-x-2 overflow-hidden pr-2">
          {state.isAllCompleted ? (
            hasErrors ? (
              <AlertCircle className="w-4 h-4 text-amber-200 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0 animate-in zoom-in-75" />
            )
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
          )}

          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold truncate leading-tight">
              {state.isAllCompleted
                ? hasErrors
                  ? `Selesai dengan catatan (${completedFiles}/${totalFiles} berkas)`
                  : `Berhasil mengunggah ${totalFiles} berkas`
                : `Mengunggah berkas (${completedFiles}/${totalFiles})...`}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={onToggleMinimize}
            className="p-1 hover:bg-white/20 rounded transition text-white/90 hover:text-white"
            title={state.isMinimized ? 'Perluas tampilan' : 'Kecilkan tampilan'}
          >
            {state.isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded transition text-white/90 hover:text-white"
            title="Tutup pemberitahuan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar Header */}
      {!state.isMinimized && (
        <div className="w-full bg-gray-100 h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              state.isAllCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}
            style={{ width: `${state.isAllCompleted ? 100 : overallPercent}%` }}
          />
        </div>
      )}

      {/* Body Widget (saat tidak diminimize) */}
      {!state.isMinimized && (
        <>
          {/* Target Folder Info */}
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <div className="flex items-center space-x-1 truncate">
              <span>Ke folder:</span>
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-0.5" />
              <span className="font-semibold text-gray-700 truncate">{state.folderName || 'Hasil Scan'}</span>
            </div>
            <span className="font-medium text-gray-600 shrink-0 ml-2">{overallPercent}%</span>
          </div>

          {/* List Files */}
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
            {state.items.map((item) => (
              <div key={item.id} className="px-3 py-2 flex items-center justify-between space-x-2 text-xs">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  {getFileIcon(item.name, item.type)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-700 text-[11px] leading-tight" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-none">{formatFileSize(item.size)}</p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center space-x-1.5 pl-2">
                  {item.status === 'uploading' && (
                    <div className="flex items-center space-x-1.5">
                      <div className="w-12 bg-gray-200 rounded-full h-1.5 overflow-hidden hidden sm:block">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                          style={{ width: `${item.progressPercent || 20}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-blue-600 min-w-6 text-right">
                        {item.progressPercent}%
                      </span>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                    </div>
                  )}

                  {item.status === 'success' && (
                    <div className="flex items-center space-x-1 text-emerald-600 font-medium text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="hidden sm:inline">Berhasil</span>
                    </div>
                  )}

                  {item.status === 'error' && (
                    <div
                      className="flex items-center space-x-1 text-red-600 font-medium text-[11px]"
                      title={item.errorMessage || 'Gagal mengunggah'}
                    >
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="hidden sm:inline">Gagal</span>
                    </div>
                  )}

                  {item.status === 'pending' && (
                    <span className="text-[10px] text-gray-400 italic">Antre...</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Status */}
          {state.isAllCompleted && (
            <div className="p-2.5 bg-emerald-50/80 border-t border-emerald-100 flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs text-emerald-800 font-medium">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Tersimpan aman di database VPS</span>
              </div>
              <button
                onClick={onClose}
                className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-md transition"
              >
                Tutup
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
