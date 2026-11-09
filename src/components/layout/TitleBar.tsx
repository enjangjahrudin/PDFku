import React, { useState, useRef, useEffect } from 'react';
import {
  Scan,
  FileText,
  Sparkles,
  HardDrive,
  Cloud,
  Shield,
  User,
  LogOut,
  ChevronDown,
  Lock,
  RefreshCw,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatBytes } from '../../utils/formatters';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

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
  const { user, isAuthenticated, isAdmin, logout, setIsAuthModalOpen, setIsAdminModalOpen, refreshUser } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown profil jika klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showUserDropdown]);

  return (
    <>
      <header className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2.5 sm:px-4 flex items-center justify-between select-none shrink-0 shadow-xs">
        {/* Brand & Tabs */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Scan className="w-4 h-4" />
            </div>
            <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-800 dark:text-slate-100">
              PDFku
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          {/* Quick Tool Links */}
          <div className="flex items-center space-x-1 sm:space-x-1.5">
            <button
              onClick={onOpenScanner}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 rounded-lg transition font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Scan Dokumen</span>
            </button>

            <button
              onClick={onOpenConverter}
              className="hidden sm:flex items-center space-x-1 px-2.5 py-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg transition font-medium"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>PDF ↔ JPG</span>
            </button>

            <button
              onClick={onOpenCompressor}
              className="hidden md:flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-lg transition font-medium"
            >
              <HardDrive className="w-3.5 h-3.5 text-slate-600" />
              <span>Kompres PDF</span>
            </button>

            <button
              onClick={onOpenPdfTools}
              className="hidden md:flex items-center space-x-1 px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-lg transition font-medium"
            >
              <span>PDF Toolkit</span>
            </button>
          </div>
        </div>

        {/* Right side: Cloud sync & User Profile / Login */}
        <div className="flex items-center space-x-2 text-xs shrink-0">
          {/* Status cloud vs offline */}
          {isAuthenticated ? (
            <div className="hidden lg:flex items-center space-x-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 px-2.5 py-1 rounded-lg">
              <Cloud className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span className="font-medium">VPS Cloud Sinkron</span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center space-x-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg">
              <HardDrive className="w-3.5 h-3.5 text-amber-600" />
              <span>Penyimpanan Lokal (Offline)</span>
            </div>
          )}

          {/* User Account / Login Button */}
          {isAuthenticated && user ? (
            <div ref={userDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-1.5 p-1 sm:px-2.5 sm:py-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[11px] shadow-2xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline font-medium text-slate-700 dark:text-slate-200 max-w-[110px] truncate">
                  {user.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu Profil Pengguna */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 text-xs">
                  {/* Info User */}
                  <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-700">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{user.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {user.role}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {formatBytes(user.used_storage || 0)} / {Math.round(user.storage_quota / (1024 * 1024))} MB
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        setIsAdminModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>Dashboard Admin & Pengguna</span>
                    </button>
                  )}

                  {/* Tombol Ubah Kata Sandi */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      setIsChangePasswordOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 transition font-medium"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    <span>Ubah Kata Sandi</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setShowUserDropdown(false);
                      await refreshUser();
                      window.location.reload();
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center space-x-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span>Sinkronkan Ulang Dokumen</span>
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      logout();
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center space-x-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar (Logout)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Masuk / Akun</span>
            </button>
          )}
        </div>
      </header>

      {/* Modal Ubah Kata Sandi */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
};