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

// Perkecil ukuran thumbnail base64 agar ringan di database MySQL & tidak melewati batas 1MB Nginx
async function compressThumbnail(dataUrl?: string): Promise<string | undefined> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
  // Jika sudah kecil (< 35 KB), langsung gunakan
  if (dataUrl.length < 35000) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 280;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
          resolve(dataUrl.substring(0, 30000));
        }
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
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

  async uploadFileChunked(
    fileBlob: Blob,
    metadata: { name: string; folderId?: string; ocrText?: string; thumbnail?: string }
  ): Promise<ServerFile> {
    const CHUNK_SIZE = 350 * 1024; // 350 KB per bagian (aman di bawah limit 1MB Nginx)
    const totalChunks = Math.max(1, Math.ceil(fileBlob.size / CHUNK_SIZE));
    const uploadId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const compactThumb = await compressThumbnail(metadata.thumbnail);

    let lastResult: any = null;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileBlob.size);
      const slice = fileBlob.slice(start, end);
      const arrayBuf = await slice.arrayBuffer();
      const chunkBase64 = arrayBufferToBase64(arrayBuf);

      const isLast = chunkIndex === totalChunks - 1;
      const res = await fetch('/api/files/upload-chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({
          uploadId,
          chunkIndex,
          totalChunks,
          chunkBase64,
          name: metadata.name,
          mimeType: fileBlob.type || (metadata.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          folderId: metadata.folderId,
          ocrText: isLast ? metadata.ocrText : undefined,
          thumbnail: isLast ? compactThumb : undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Gagal mengunggah bagian ${chunkIndex + 1}/${totalChunks}`);
      }
      lastResult = data;
    }

    return lastResult.file;
  },

  async uploadFile(
    fileBlob: Blob,
    metadata: { name: string; folderId?: string; ocrText?: string; thumbnail?: string }
  ): Promise<ServerFile> {
    const compactThumb = await compressThumbnail(metadata.thumbnail);

    // Jika ukuran file > 450 KB, gunakan Chunked Upload agar tidak ditolak batas 1MB Nginx
    if (fileBlob.size > 450 * 1024) {
      return this.uploadFileChunked(fileBlob, { ...metadata, thumbnail: compactThumb });
    }

    try {
      const formData = new FormData();
      formData.append('file', fileBlob, metadata.name);
      formData.append('name', metadata.name);
      if (metadata.folderId) formData.append('folderId', metadata.folderId);
      if (metadata.ocrText) formData.append('ocrText', metadata.ocrText);
      if (compactThumb) formData.append('thumbnail', compactThumb);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: authService.getAuthHeader(),
        body: formData
      });

      if (!res.ok) {
        return this.uploadFileChunked(fileBlob, { ...metadata, thumbnail: compactThumb });
      }

      const data = await res.json();
      if (!data.success) {
        return this.uploadFileChunked(fileBlob, { ...metadata, thumbnail: compactThumb });
      }

      return data.file;
    } catch {
      return this.uploadFileChunked(fileBlob, { ...metadata, thumbnail: compactThumb });
    }
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

  async moveFolder(id: string, parentId: string | null): Promise<ServerFolder> {
    const res = await fetch(`/api/files/folder/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify({ parentId: parentId || null })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal memindahkan folder.');
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
