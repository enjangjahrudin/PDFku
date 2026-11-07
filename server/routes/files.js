import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, seedDefaultFolders } from '../db.js';
import { authenticateToken } from '../middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsBaseDir = path.resolve(__dirname, '../../uploads');

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadsBaseDir, `user_${req.user.id}`);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `doc_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max per file
});

const router = express.Router();
router.use(authenticateToken);

// Normalisasi ID folder bawaan agar selalu presisi ke akun user
function resolveUserFolderId(folderId, userId) {
  if (!folderId) return null;
  if (folderId === 'folder-scan' || folderId === `folder-scan-${userId}`) return `folder-scan-${userId}`;
  if (folderId === 'folder-converted' || folderId === 'folder-conv' || folderId === `folder-conv-${userId}`) return `folder-conv-${userId}`;
  if (folderId === 'folder-my-docs' || folderId === 'folder-doc' || folderId === `folder-doc-${userId}`) return `folder-doc-${userId}`;
  if (folderId === 'folder-archive' || folderId === 'folder-arc' || folderId === `folder-arc-${userId}`) return `folder-arc-${userId}`;
  return folderId;
}

// 1. Ambil daftar folder dan file milik user aktif
router.get('/', (req, res) => {
  try {
    const { folderId, search, view } = req.query;
    const userId = req.user.id;

    // Ambil semua folder user (buat default jika baru pertama kali)
    let folders = db.prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY name ASC').all(userId);
    if (folders.length === 0) {
      seedDefaultFolders(userId);
      folders = db.prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY name ASC').all(userId);
    }

    let filesQuery = 'SELECT * FROM files WHERE user_id = ?';
    const params = [userId];

    if (view === 'trash') {
      filesQuery += ' AND is_trash = 1';
    } else {
      filesQuery += ' AND is_trash = 0';

      if (view === 'starred') {
        filesQuery += ' AND is_starred = 1';
      } else if (search && search.trim() !== '') {
        filesQuery += ' AND (name LIKE ? OR ocr_text LIKE ?)';
        const term = `%${search.trim()}%`;
        params.push(term, term);
      } else if (folderId) {
        filesQuery += ' AND folder_id = ?';
        params.push(resolveUserFolderId(folderId, userId));
      }
    }

    filesQuery += ' ORDER BY created_at DESC';
    const files = db.prepare(filesQuery).all(...params);

    // Hitung total storage terpakai
    const storageStats = db.prepare('SELECT COALESCE(SUM(size), 0) as used_bytes, COUNT(*) as file_count FROM files WHERE user_id = ?').get(userId);

    return res.json({
      success: true,
      folders,
      files,
      storage: {
        used: storageStats.used_bytes,
        quota: req.user.storage_quota,
        fileCount: storageStats.file_count
      }
    });
  } catch (err) {
    console.error('Error get files:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat berkas.' });
  }
});

// 2. Upload berkas (Scan Dokumen / Konversi / File Biasa)
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada berkas yang diunggah.' });
    }

    const userId = req.user.id;
    const fileSize = req.file.size;

    // Cek kuota penyimpanan pengguna
    const currentUsage = db.prepare('SELECT COALESCE(SUM(size), 0) as used_bytes FROM files WHERE user_id = ?').get(userId);
    if (currentUsage.used_bytes + fileSize > req.user.storage_quota) {
      // Hapus file yang terlanjur terupload ke disk
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Kapasitas penyimpanan akun Anda telah penuh. Silakan hubungi Administrator atau hapus berkas lama.'
      });
    }

    const { name, folderId, ocrText, thumbnail } = req.body;
    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const fileName = name || req.file.originalname;
    const fileType = req.file.mimetype || 'application/octet-stream';
    const now = new Date().toISOString();

    // Simpan relatif disk path
    const relativeDiskPath = path.relative(path.resolve(__dirname, '../../'), req.file.path).replace(/\\/g, '/');

    const insert = db.prepare(`
      INSERT INTO files (id, user_id, name, type, size, disk_path, thumbnail, folder_id, ocr_text, is_starred, is_trash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `);

    const targetFolderId = resolveUserFolderId(folderId, userId);

    insert.run(
      fileId,
      userId,
      fileName,
      fileType,
      fileSize,
      relativeDiskPath,
      thumbnail || null,
      targetFolderId || null,
      ocrText || null,
      now,
      now
    );

    const savedFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);

    return res.status(201).json({
      success: true,
      message: 'Berkas berhasil disimpan ke server VPS.',
      file: savedFile
    });
  } catch (err) {
    console.error('Error upload file:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengunggah berkas ke server.' });
  }
});

// 3. Buat Folder Baru
router.post('/folder', (req, res) => {
  try {
    const { name, parentId, color } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nama folder tidak boleh kosong.' });
    }

    const userId = req.user.id;
    const targetParentId = resolveUserFolderId(parentId, userId);

    // Cek apakah folder dengan nama dan parent yang sama sudah ada untuk user ini
    const existing = db.prepare(`
      SELECT * FROM folders 
      WHERE user_id = ? AND name = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))
    `).get(userId, name.trim(), targetParentId || null, targetParentId || null);

    if (existing) {
      return res.status(200).json({ success: true, folder: existing });
    }

    const folderId = 'folder_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO folders (id, user_id, name, parent_id, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run(folderId, userId, name.trim(), targetParentId || null, color || '#3b82f6', now);

    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
    return res.status(201).json({ success: true, folder });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal membuat folder.' });
  }
});

// 3b. Ganti Nama Folder
router.put('/folder/:id', (req, res) => {
  try {
    const folderId = req.params.id;
    const userId = req.user.id;
    const { name, color, parentId } = req.body;

    const systemRoots = [
      `folder-scan-${userId}`, `folder-conv-${userId}`, `folder-doc-${userId}`, `folder-arc-${userId}`,
      'folder-scan', 'folder-converted', 'folder-my-docs', 'folder-archive'
    ];
    if (systemRoots.includes(folderId)) {
      return res.status(400).json({ success: false, message: 'Folder sistem bawaan tidak dapat diubah namanya.' });
    }

    const folder = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(folderId, userId);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder tidak ditemukan.' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined && name.trim() !== '') {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }
    if (parentId !== undefined) {
      updates.push('parent_id = ?');
      params.push(resolveUserFolderId(parentId, userId));
    }

    if (updates.length > 0) {
      params.push(folderId, userId);
      db.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
    return res.json({ success: true, folder: updated });
  } catch (err) {
    console.error('Gagal memperbarui folder:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui folder.' });
  }
});

// 3c. Hapus Folder Beserta Isinya
router.delete('/folder/:id', (req, res) => {
  try {
    const folderId = req.params.id;
    const userId = req.user.id;

    const systemRoots = [
      `folder-scan-${userId}`, `folder-conv-${userId}`, `folder-doc-${userId}`, `folder-arc-${userId}`,
      'folder-scan', 'folder-converted', 'folder-my-docs', 'folder-archive'
    ];
    if (systemRoots.includes(folderId)) {
      return res.status(400).json({ success: false, message: 'Folder sistem bawaan tidak dapat dihapus.' });
    }

    const folder = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(folderId, userId);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder tidak ditemukan.' });
    }

    // Kumpulkan semua subfolder secara rekursif
    const folderIdsToDelete = [folderId];
    let queue = [folderId];
    while (queue.length > 0) {
      const current = queue.shift();
      const subfolders = db.prepare('SELECT id FROM folders WHERE parent_id = ? AND user_id = ?').all(current, userId);
      for (const sub of subfolders) {
        folderIdsToDelete.push(sub.id);
        queue.push(sub.id);
      }
    }

    // Cari dan hapus semua file fisik di disk yang berada di dalam folder-folder ini
    const placeholders = folderIdsToDelete.map(() => '?').join(',');
    const filesToDelete = db.prepare(`SELECT * FROM files WHERE folder_id IN (${placeholders}) AND user_id = ?`).all(...folderIdsToDelete, userId);

    for (const f of filesToDelete) {
      if (f.disk_path) {
        const fullDiskPath = path.resolve(__dirname, '../../', f.disk_path);
        if (fs.existsSync(fullDiskPath)) {
          try { fs.unlinkSync(fullDiskPath); } catch (e) {}
        }
      }
    }

    // Hapus data file dari database
    db.prepare(`DELETE FROM files WHERE folder_id IN (${placeholders}) AND user_id = ?`).run(...folderIdsToDelete, userId);

    // Hapus folder-folder dari database
    db.prepare(`DELETE FROM folders WHERE id IN (${placeholders}) AND user_id = ?`).run(...folderIdsToDelete, userId);

    return res.json({ success: true, message: 'Folder dan seluruh isinya berhasil dihapus.' });
  } catch (err) {
    console.error('Gagal menghapus folder:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus folder.' });
  }
});

// 4. Update File (Rename, Move Folder, Star, Trash, Restore)
router.put('/:id', (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;
    const { name, folderId, isStarred, isTrash } = req.body;

    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, userId);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (folderId !== undefined) {
      updates.push('folder_id = ?');
      params.push(resolveUserFolderId(folderId, userId));
    }
    if (isStarred !== undefined) {
      updates.push('is_starred = ?');
      params.push(isStarred ? 1 : 0);
    }
    if (isTrash !== undefined) {
      updates.push('is_trash = ?');
      params.push(isTrash ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(fileId, userId);

      db.prepare(`UPDATE files SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
    }

    const updatedFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    return res.json({ success: true, file: updatedFile });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui berkas.' });
  }
});

// 5. Hapus File Permanen
router.delete('/:id', (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, userId);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    // Hapus fisik file dari disk VPS
    const fullDiskPath = path.resolve(__dirname, '../../', file.disk_path);
    if (fs.existsSync(fullDiskPath)) {
      try {
        fs.unlinkSync(fullDiskPath);
      } catch (e) {
        console.warn('Gagal menghapus file fisik di disk:', e);
      }
    }

    db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(fileId, userId);
    return res.json({ success: true, message: 'Berkas berhasil dihapus permanen.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus berkas.' });
  }
});

// 6. Kosongkan Tempat Sampah (Empty Trash)
router.delete('/trash/empty', (req, res) => {
  try {
    const userId = req.user.id;
    const trashedFiles = db.prepare('SELECT * FROM files WHERE user_id = ? AND is_trash = 1').all(userId);

    for (const f of trashedFiles) {
      const fullDiskPath = path.resolve(__dirname, '../../', f.disk_path);
      if (fs.existsSync(fullDiskPath)) {
        try { fs.unlinkSync(fullDiskPath); } catch (e) {}
      }
    }

    db.prepare('DELETE FROM files WHERE user_id = ? AND is_trash = 1').run(userId);
    return res.json({ success: true, message: 'Tempat sampah berhasil dikosongkan.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengosongkan tempat sampah.' });
  }
});

// 7. Download / Stream Berkas
router.get('/download/:id', (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, userId);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    const fullDiskPath = path.resolve(__dirname, '../../', file.disk_path);
    if (!fs.existsSync(fullDiskPath)) {
      return res.status(404).json({ success: false, message: 'Berkas fisik tidak ditemukan di server.' });
    }

    res.download(fullDiskPath, file.name);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengunduh berkas.' });
  }
});

// 8. Stream Pratinjau Berkas (Inline)
router.get('/preview/:id', (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, userId);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    const fullDiskPath = path.resolve(__dirname, '../../', file.disk_path);
    if (!fs.existsSync(fullDiskPath)) {
      return res.status(404).json({ success: false, message: 'Berkas fisik tidak ditemukan di server.' });
    }

    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    const stream = fs.createReadStream(fullDiskPath);
    stream.pipe(res);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memuat pratinjau berkas.' });
  }
});

export default router;
