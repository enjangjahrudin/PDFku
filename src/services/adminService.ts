import { authService } from './authService';
import { User, ServerStats } from '../types';

export const adminService = {
  async getStats(): Promise<ServerStats> {
    const res = await fetch('/api/admin/stats', {
      headers: authService.getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal memuat statistik admin.');
    }
    return data.stats;
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch('/api/admin/users', {
      headers: authService.getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal memuat daftar pengguna.');
    }
    return data.users;
  },

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    name: string;
    role: 'admin' | 'user';
    storage_quota: number;
  }): Promise<void> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal membuat pengguna baru.');
    }
  },

  async updateUser(
    id: number,
    updates: {
      role?: 'admin' | 'user';
      status?: 'active' | 'suspended';
      storage_quota?: number;
      name?: string;
      newPassword?: string;
    }
  ): Promise<void> {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal memperbarui pengguna.');
    }
  },

  async deleteUser(id: number): Promise<void> {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal menghapus pengguna.');
    }
  }
};
