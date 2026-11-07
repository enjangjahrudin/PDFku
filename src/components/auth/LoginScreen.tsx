import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Scan, Lock, Mail, User, ShieldCheck, ArrowRight, Loader2, KeyRound, Cloud, CheckCircle2 } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        await login(identifier, password);
      } else {
        await register(username, email, password, name);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa kembali username atau kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  const fillAdminDemo = () => {
    setTab('login');
    setIdentifier('admin@pdfku.id');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-slate-100 select-none">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/25 mb-3 ring-4 ring-white/10">
            <Scan className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            PDFku Cloud
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Silakan masuk untuk mengakses scanner dokumen dan arsip berkas pribadi Anda
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white/10 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/15 dark:border-slate-800 shadow-2xl p-6 sm:p-8">
          {/* Tab Switcher */}
          <div className="flex p-1 mb-5 bg-white/10 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                tab === 'login'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Masuk (Login)
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                tab === 'register'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-start gap-2">
              <span className="font-bold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Lengkap Anda"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username (tanpa spasi)"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@domain.com"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {tab === 'login' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username atau Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="admin@pdfku.id atau username"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/15 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>{tab === 'login' ? 'Masuk ke Aplikasi' : 'Daftar Akun'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Admin Helper */}
          {tab === 'login' && (
            <div className="mt-5 pt-4 border-t border-white/10 text-center">
              <button
                type="button"
                onClick={fillAdminDemo}
                className="inline-flex items-center gap-1.5 text-xs text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-400/20 transition"
              >
                <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                <span>Isi Akun Bawaan Administrator</span>
              </button>
            </div>
          )}
        </div>

        {/* Security badges */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Isolasi Akun Terjamin</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            <span>Tersinkron ke VPS</span>
          </div>
        </div>
      </div>
    </div>
  );
};
