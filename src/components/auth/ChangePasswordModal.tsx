import React, { useState } from 'react';
import { X, Lock, KeyRound, Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '../../services/authService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    handleResetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!oldPassword) {
      setError('Masukkan kata sandi saat ini.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }

    if (newPassword === oldPassword) {
      setError('Kata sandi baru tidak boleh sama dengan kata sandi lama.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsLoading(true);

    try {
      await authService.changePassword(oldPassword, newPassword);
      setSuccess('Kata sandi Anda berhasil diperbarui!');
      setTimeout(() => {
        handleClose();
      }, 1600);
    } catch (err: any) {
      setError(err?.message || 'Gagal mengubah kata sandi. Periksa kembali kata sandi lama Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="h-14 border-b border-gray-100 px-5 flex items-center justify-between bg-[#fafafa]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Ubah Kata Sandi</h3>
              <p className="text-[11px] text-gray-400">Perbarui kata sandi akun Anda untuk keamanan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 animate-in fade-in duration-150 font-medium">
              <Check className="w-4 h-4 shrink-0 text-emerald-600 stroke-[3]" />
              <span>{success}</span>
            </div>
          )}

          {/* Kata Sandi Lama */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Kata Sandi Saat Ini (Lama)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan kata sandi lama"
                required
                className="w-full pl-9 pr-10 py-2 border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-blue-500 transition shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="p-1.5 text-gray-400 hover:text-gray-600 absolute right-2.5 top-1/2 -translate-y-1/2 rounded"
              >
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-2" />

          {/* Kata Sandi Baru */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Kata Sandi Baru
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                required
                className="w-full pl-9 pr-10 py-2 border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-blue-500 transition shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="p-1.5 text-gray-400 hover:text-gray-600 absolute right-2.5 top-1/2 -translate-y-1/2 rounded"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword.length > 0 && newPassword.length < 6 && (
              <span className="text-[10px] text-amber-600 mt-1 block">
                Kata sandi baru masih kurang dari 6 karakter.
              </span>
            )}
          </div>

          {/* Konfirmasi Kata Sandi Baru */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Konfirmasi Kata Sandi Baru
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                required
                className="w-full pl-9 pr-10 py-2 border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-blue-500 transition shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="p-1.5 text-gray-400 hover:text-gray-600 absolute right-2.5 top-1/2 -translate-y-1/2 rounded"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <div className="flex items-center space-x-1 mt-1 text-[10px]">
                {confirmPassword === newPassword ? (
                  <span className="text-emerald-600 flex items-center space-x-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Kata sandi cocok</span>
                  </span>
                ) : (
                  <span className="text-rose-500">Kata sandi belum cocok</span>
                )}
              </div>
            )}
          </div>

          {/* Tombol Aksi */}
          <div className="pt-3 flex space-x-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading || !oldPassword || !newPassword || newPassword !== confirmPassword}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Kata Sandi</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};