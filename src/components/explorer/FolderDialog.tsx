import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Edit2, Folder } from 'lucide-react';

interface FolderDialogProps {
  isOpen: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  parentName?: string | null;
  onClose: () => void;
  onSubmit: (name: string, colorTag?: string) => void;
}

export const FolderDialog: React.FC<FolderDialogProps> = ({
  isOpen,
  mode,
  initialName = '',
  parentName,
  onClose,
  onSubmit
}) => {
  const [name, setName] = useState(initialName);
  const [colorTag, setColorTag] = useState<string>('#3b82f6');

  useEffect(() => {
    setName(initialName);
  }, [initialName, isOpen]);

  if (!isOpen) return null;

  const colors = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#6b7280'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), colorTag);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm p-4 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            {mode === 'create' ? (
              <FolderPlus className="w-4 h-4 text-amber-500" />
            ) : (
              <Edit2 className="w-4 h-4 text-blue-600" />
            )}
            <h4 className="text-xs font-semibold text-gray-800">
              {mode === 'create' ? 'Buat Folder Baru' : 'Ganti Nama (Rename)'}
            </h4>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'create' && parentName && (
          <div className="mb-3 px-2.5 py-1.5 bg-blue-50/70 border border-blue-100/80 rounded-lg flex items-center space-x-2 text-[11px] text-blue-700">
            <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">
              Lokasi: <span className="font-semibold text-blue-900">{parentName}</span>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Nama {mode === 'create' ? 'Folder' : 'Berkas / Folder'}
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Warna Label Folder
              </label>
              <div className="flex items-center space-x-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColorTag(c)}
                    className={`w-5 h-5 rounded-full transition transform hover:scale-110 ${
                      colorTag === c ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
