import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemName?: string;
  itemType?: 'folder' | 'file';
  message?: string;
  isPermanent?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'Konfirmasi Hapus',
  itemName,
  itemType = 'folder',
  message,
  isPermanent = false,
  onConfirm,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-100">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm p-4 animate-in zoom-in-95 duration-100">
        <div className="flex items-start justify-between pb-2 mb-2 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
              <p className="text-[11px] text-gray-500">
                {isPermanent
                  ? 'Tindakan ini permanen & tidak dapat dibatalkan'
                  : 'Akan dipindahkan ke Tempat Sampah'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-2 text-xs text-gray-600 leading-relaxed">
          {message ? (
            <p>{message}</p>
          ) : (
            <p>
              Apakah Anda yakin ingin menghapus {itemType === 'folder' ? 'folder' : 'berkas'}{' '}
              <strong className="text-gray-800 font-semibold break-all">"{itemName}"</strong>?
              {itemType === 'folder' && (
                <span className="block mt-1 text-amber-700 font-medium">
                  {isPermanent
                    ? 'Seluruh dokumen dan berkas di dalam folder ini akan dihapus secara permanen.'
                    : 'Seluruh dokumen dan berkas di dalam folder ini juga akan ikut masuk ke Tempat Sampah.'}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex space-x-2 pt-3 mt-1 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium shadow-sm transition flex items-center justify-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isPermanent ? 'Hapus Permanen' : 'Pindahkan ke Sampah'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
