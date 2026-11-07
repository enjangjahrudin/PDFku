import { authService } from './authService';
import { ServerFile, ServerFolder } from '../types';

export interface CloudFetchResult {
  folders: ServerFolder[];
  files: ServerFile[];
  storage: {
    used: number;
    quota: number;
    fileCount: number;
  };
}

export const cloudFileService = {
  async fetchFiles(params?: { folderId?: string; search?: string; view?: string }): Promise<CloudFetchResult> {
    const query = new URLSearchParams();
    if (params?.folderId) query.set('folderId', params.folderId);
    if (params?.search) query.set('search', params.search);
    if (params?.view) query.set('view', params.view);

    const res = await fetch(`/api/files?${query.toString()}`, {
      headers: authService.getAuthHeader()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal memuat berkas dari cloud server.');
    }

    return {
      folders: data.folders,
      files: data.files,
      storage: data.storage
    };
  },

  async uploadFile(
    fileBlob: Blob,
    metadata: { name: string; folderId?: string; ocrText?: string; thumbnail?: string }
  ): Promise<ServerFile> {
    const formData = new FormData();
    formData.append('file', fileBlob, metadata.name);
    formData.append('name', metadata.name);
    if (metadata.folderId) formData.append('folderId', metadata.folderId);
    if (metadata.ocrText) formData.append('ocrText', metadata.ocrText);
    if (metadata.thumbnail) formData.append('thumbnail', metadata.thumbnail);

    const res = await fetch('/api/files/upload', {
      method: 'POST',
      headers: authService.getAuthHeader(),
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal mengunggah berkas ke VPS.');
    }

    return data.file;
  },

  async createFolder(name: string, parentId?: string, color?: string): Promise<ServerFolder> {
    const res = await fetch('/api/files/folder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify({ name, parentId, color })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal membuat folder.');
    }

    return data.folder;
  },

  async renameFolder(id: string, name: string): Promise<ServerFolder> {
    const res = await fetch(`/api/files/folder/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify({ name })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal mengubah nama folder.');
    }

    return data.folder;
  },

  async deleteFolder(id: string, name?: string): Promise<void> {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    const res = await fetch(`/api/files/folder/${encodeURIComponent(id)}${query}`, {
      method: 'DELETE',
      headers: authService.getAuthHeader()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal menghapus folder.');
    }
  },

  async updateFile(
    id: string,
    updates: { name?: string; folderId?: string; isStarred?: boolean; isTrash?: boolean }
  ): Promise<ServerFile> {
    const res = await fetch(`/api/files/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify(updates)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal memperbarui berkas.');
    }

    return data.file;
  },

  async deleteFilePermanently(id: string): Promise<void> {
    const res = await fetch(`/api/files/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeader()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal menghapus berkas permanen.');
    }
  },

  async emptyTrash(): Promise<void> {
    const res = await fetch('/api/files/trash/empty', {
      method: 'DELETE',
      headers: authService.getAuthHeader()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal mengosongkan tempat sampah.');
    }
  },

  getDownloadUrl(id: string): string {
    return `/api/files/download/${id}`;
  },

  getPreviewUrl(id: string): string {
    return `/api/files/preview/${id}`;
  }
};
