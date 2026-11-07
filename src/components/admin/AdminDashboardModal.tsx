import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { User, ServerStats } from '../../types';
import {
  X,
  Users,
  HardDrive,
  FileText,
  Shield,
  UserPlus,
  Key,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Lock,
  Mail,
  UserCheck
} from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export const AdminDashboardModal: React.FC = () => {
  const { isAdminModalOpen, setIsAdminModalOpen, user: currentUser } = useAuth();

  const [stats, setStats] = useState<ServerStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for admin actions
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Form add user
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [newQuotaMb, setNewQuotaMb] = useState<number>(500);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData] = await Promise.all([
        adminService.getStats(),
        adminService.getUsers()
      ]);
      setStats(statsData);
      setUsers(usersData);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Gagal memuat data admin.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminModalOpen) {
      loadData();
    }
  }, [isAdminModalOpen]);

  if (!isAdminModalOpen) return null;

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await adminService.updateUser(user.id, { status: newStatus });
      setActionMessage({ type: 'success', text: `Status ${user.name} diubah menjadi ${newStatus}.` });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleToggleRole = async (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await adminService.updateUser(user.id, { role: newRole });
      setActionMessage({ type: 'success', text: `Role ${user.name} diubah menjadi ${newRole}.` });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Yakin ingin menghapus akun ${user.name} (${user.email}) beserta seluruh dokumennya? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await adminService.deleteUser(user.id);
      setActionMessage({ type: 'success', text: `Pengguna ${user.name} berhasil dihapus.` });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResetPasswordModal || newPasswordInput.length < 6) return;

    try {
      await adminService.updateUser(showResetPasswordModal.id, { newPassword: newPasswordInput });
      setActionMessage({ type: 'success', text: `Password untuk ${showResetPasswordModal.name} berhasil diperbarui.` });
      setShowResetPasswordModal(null);
      setNewPasswordInput('');
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.createUser({
        username: newUsername,
        email: newEmail,
        name: newName,
        password: newPass,
        role: newRole,
        storage_quota: newQuotaMb * 1024 * 1024
      });
      setActionMessage({ type: 'success', text: `Pengguna ${newName} berhasil dibuat.` });
      setShowAddUserModal(false);
      setNewUsername('');
      setNewEmail('');
      setNewName('');
      setNewPass('');
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(query) ||
      u.username.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-xl shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Dashboard Administrator PDFku
                <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold rounded-full border border-indigo-200 dark:border-indigo-800">
                  VPS Server
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pantau statistik penyimpanan, kelola akun pengguna, dan kuota berkas
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAdminModalOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center justify-between ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="font-bold ml-2">×</button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50/50 dark:bg-slate-800/60 rounded-xl border border-blue-100 dark:border-slate-700">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs font-semibold">Total Pengguna</span>
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {stats?.totalUsers ?? '...'}
              </div>
              <span className="text-[11px] text-slate-500">
                {stats?.activeUsers ?? 0} aktif
              </span>
            </div>

            <div className="p-4 bg-emerald-50/50 dark:bg-slate-800/60 rounded-xl border border-emerald-100 dark:border-slate-700">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-semibold">Total Dokumen</span>
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {stats?.totalFiles ?? '...'}
              </div>
              <span className="text-[11px] text-slate-500">Tersimpan di VPS</span>
            </div>

            <div className="p-4 bg-purple-50/50 dark:bg-slate-800/60 rounded-xl border border-purple-100 dark:border-slate-700">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                <HardDrive className="w-4 h-4" />
                <span className="text-xs font-semibold">Storage Terpakai</span>
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {stats ? formatBytes(stats.totalStorageBytes) : '...'}
              </div>
              <span className="text-[11px] text-slate-500">Kapasitas Disk VPS</span>
            </div>

            <div className="p-4 bg-amber-50/50 dark:bg-slate-800/60 rounded-xl border border-amber-100 dark:border-slate-700">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                <UserCheck className="w-4 h-4" />
                <span className="text-xs font-semibold">Status Server</span>
              </div>
              <div className="text-lg font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </div>
              <span className="text-[11px] text-slate-500">SQLite & Express</span>
            </div>
          </div>

          {/* User Management Section */}
          <div className="bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Toolbar User */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, email, username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                  title="Segarkan Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Tambah Pengguna</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pengguna</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Penyimpanan & Berkas</th>
                    <th className="px-4 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((u) => {
                    const quotaMb = Math.round(u.storage_quota / (1024 * 1024));
                    const usedBytes = u.used_storage || 0;
                    const percentUsed = Math.min(100, Math.round((usedBytes / u.storage_quota) * 100));

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {u.name} {u.id === currentUser?.id && <span className="text-[10px] text-blue-500 font-normal">(Anda)</span>}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            @{u.username} • {u.email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleRole(u)}
                            disabled={u.id === currentUser?.id}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${
                              u.role === 'admin'
                                ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'
                            } ${u.id !== currentUser?.id ? 'hover:opacity-80' : 'cursor-default'}`}
                          >
                            {u.role.toUpperCase()}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={u.id === currentUser?.id}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${
                              u.status === 'active'
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                                : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 border-red-200'
                            } ${u.id !== currentUser?.id ? 'hover:opacity-80' : 'cursor-default'}`}
                          >
                            {u.status === 'active' ? 'Aktif' : 'Dinonaktifkan'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span>{formatBytes(usedBytes)} / {quotaMb} MB</span>
                            <span className="text-slate-400">({u.file_count || 0} berkas)</span>
                          </div>
                          <div className="w-36 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                percentUsed > 90 ? 'bg-red-500' : percentUsed > 70 ? 'bg-amber-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${percentUsed}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setShowResetPasswordModal(u)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                              title="Reset Kata Sandi"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                            {u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal: Tambah User Baru */}
        {showAddUserModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Tambah Akun Pengguna Baru</h3>
                <button onClick={() => setShowAddUserModal(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg dark:bg-slate-800"
                    placeholder="Budi Santoso"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg dark:bg-slate-800"
                    placeholder="budisantoso"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg dark:bg-slate-800"
                    placeholder="budi@example.com"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Password Awal</label>
                  <input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg dark:bg-slate-800"
                    placeholder="Minimal 6 karakter"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium mb-1">Role Akun</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800"
                    >
                      <option value="user">User Biasa</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Kuota Penyimpanan (MB)</label>
                    <input
                      type="number"
                      value={newQuotaMb}
                      onChange={(e) => setNewQuotaMb(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-medium shadow-sm"
                  >
                    Simpan Pengguna
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Reset Password */}
        {showResetPasswordModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Reset Password: {showResetPasswordModal.name}
                </h3>
                <button onClick={() => setShowResetPasswordModal(null)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium mb-1">Password Baru</label>
                  <input
                    type="password"
                    required
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3 py-1.5 border rounded-lg dark:bg-slate-800"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordModal(null)}
                    className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-medium shadow-sm"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
