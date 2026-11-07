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
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max per file
    fieldSize: 50 * 1024 * 1024  // 50 MB max per field (thumbnail / ocrText)
  }
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
router.get('/', async (req, res) => {
  try {
    const { folderId, search, view } = req.query;
    const userId = req.user.id;

    // Ambil semua folder user (buat default jika baru pertama kali)
    let folders = await db.all('SELECT * FROM folders WHERE user_id = ? ORDER BY name ASC', [userId]);
    if (folders.length === 0) {
      await seedDefaultFolders(userId);
      folders = await db.all('SELECT * FROM folders WHERE user_id = ? ORDER BY name ASC', [userId]);
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
        const resolvedFolderId = resolveUserFolderId(folderId, userId);
        const altFolderId = resolvedFolderId.includes('-') 
          ? resolvedFolderId.replace(/-/g, '_') 
          : resolvedFolderId.replace(/_/g, '-');
        
        filesQuery += ' AND (folder_id = ? OR folder_id = ?)';
        params.push(resolvedFolderId, altFolderId);
      }
    }

    filesQuery += ' ORDER BY created_at DESC';
    const files = await db.all(filesQuery, params);

    // Hitung total storage terpakai
    const storageStats = await db.get('SELECT COALESCE(SUM(size), 0) as used_bytes, COUNT(*) as file_count FROM files WHERE user_id = ?', [userId]);

    return res.json({
      success: true,
      folders,
      files,
      storage: {
        used: storageStats ? storageStats.used_bytes : 0,
        quota: req.user.storage_quota,
        fileCount: storageStats ? storageStats.file_count : 0
      }
    });
  } catch (err) {
    console.error('Error get files:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat berkas.' });
  }
});

// 2. Upload berkas (Scan Dokumen / Konversi / File Biasa)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada berkas yang diunggah.' });
    }

    const userId = req.user.id;
    const fileSize = req.file.size;

    // Cek kuota penyimpanan pengguna
    const currentUsage = await db.get('SELECT COALESCE(SUM(size), 0) as used_bytes FROM files WHERE user_id = ?', [userId]);
    const usedBytes = currentUsage ? currentUsage.used_bytes : 0;
    if (usedBytes + fileSize > req.user.storage_quota) {
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

    const targetFolderId = resolveUserFolderId(folderId, userId);

    await db.run(`
      INSERT INTO files (id, user_id, name, type, size, disk_path, thumbnail, folder_id, ocr_text, is_starred, is_trash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `, [
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
    ]);

    const savedFile = await db.get('SELECT * FROM files WHERE id = ?', [fileId]);

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

// 2b. Upload berkas per bagian (Chunked Upload) untuk menembus batas 1MB Nginx reverse proxy
router.post('/upload-chunk', async (req, res) => {
  try {
    const {
      uploadId,
      chunkIndex,
      totalChunks,
      chunkBase64,
      name,
      mimeType,
      folderId,
      ocrText,
      thumbnail
    } = req.body;

    if (!uploadId || chunkIndex === undefined || !totalChunks || !chunkBase64) {
      return res.status(400).json({ success: false, message: 'Parameter chunk tidak lengkap.' });
    }

    const userId = req.user.id;
    const userDir = path.join(uploadsBaseDir, `user_${userId}`);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const safeUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
    const tempFilePath = path.join(userDir, `tmp_${safeUploadId}.part`);
    const buffer = Buffer.from(chunkBase64, 'base64');

    if (Number(chunkIndex) === 0 && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    fs.appendFileSync(tempFilePath, buffer);

    // Jika belum chunk terakhir, kembalikan status OK untuk lanjut ke chunk berikutnya
    if (Number(chunkIndex) + 1 < Number(totalChunks)) {
      return res.status(200).json({
        success: true,
        status: 'chunk_received',
        chunkIndex: Number(chunkIndex)
      });
    }

    // Chunk terakhir selesai: finalisasi berkas & simpan ke database MySQL
    const finalStats = fs.statSync(tempFilePath);
    const fileSize = finalStats.size;

    const currentUsage = await db.get('SELECT COALESCE(SUM(size), 0) as used_bytes FROM files WHERE user_id = ?', [userId]);
    const usedBytes = currentUsage ? Number(currentUsage.used_bytes) : 0;
    if (usedBytes + fileSize > req.user.storage_quota) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        success: false,
        message: 'Kapasitas penyimpanan akun Anda telah penuh.'
      });
    }

    const fileName = name || 'dokumen.jpg';
    const ext = path.extname(fileName) || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const finalFileName = `doc_${uniqueSuffix}${ext}`;
    const finalFilePath = path.join(userDir, finalFileName);

    fs.renameSync(tempFilePath, finalFilePath);

    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const fileType = mimeType || 'image/jpeg';
    const now = new Date().toISOString();
    const relativeDiskPath = path.relative(path.resolve(__dirname, '../../'), finalFilePath).replace(/\\/g, '/');
    const targetFolderId = resolveUserFolderId(folderId, userId);

    await db.run(`
      INSERT INTO files (id, user_id, name, type, size, disk_path, thumbnail, folder_id, ocr_text, is_starred, is_trash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `, [
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
    ]);

    const savedFile = await db.get('SELECT * FROM files WHERE id = ?', [fileId]);
    return res.status(201).json({
      success: true,
      message: 'Berkas berhasil disimpan ke database MySQL.',
      file: savedFile
    });
  } catch (err) {
    console.error('Error upload chunk:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengunggah bagian berkas.' });
  }
});

// 3. Buat Folder Baru (Cegah Duplikasi dengan Mencari Folder Eksis Terlebih Dahulu)
router.post('/folder', async (req, res) => {
  try {
    const { name, parentId, color } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nama folder tidak boleh kosong.' });
    }

    const userId = req.user.id;
    const targetParentId = resolveUserFolderId(parentId, userId);
    const cleanName = name.trim();

    // Cek apakah folder dengan nama yang sama sudah ada untuk user ini di folder induk yang sama
    let existing;
    if (targetParentId) {
      existing = await db.get(`
        SELECT * FROM folders 
        WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND parent_id = ?
        LIMIT 1
      `, [userId, cleanName, targetParentId]);
    } else {
      existing = await db.get(`
        SELECT * FROM folders 
        WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND (parent_id IS NULL OR parent_id = '')
        LIMIT 1
      `, [userId, cleanName]);
    }

    if (existing) {
      return res.status(200).json({ success: true, folder: existing });
    }

    const folderId = 'folder_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    await db.run(`
      INSERT INTO folders (id, user_id, name, parent_id, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [folderId, userId, cleanName, targetParentId || null, color || '#3b82f6', now]);

    const folder = await db.get('SELECT * FROM folders WHERE id = ?', [folderId]);
    return res.status(201).json({ success: true, folder });
  } catch (err) {
    console.error('Error buat folder:', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat folder.' });
  }
});

// 3b. Ganti Nama Folder
router.put('/folder/:id', async (req, res) => {
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

    let folder = await db.get('SELECT * FROM folders WHERE id = ? AND user_id = ?', [folderId, userId]);
    if (!folder) {
      const altId = folderId.includes('-') ? folderId.replace(/-/g, '_') : folderId.replace(/_/g, '-');
      folder = await db.get('SELECT * FROM folders WHERE id = ? AND user_id = ?', [altId, userId]);
    }

    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder tidak ditemukan.' });
    }

    const actualId = folder.id;
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
      params.push(actualId, userId);
      await db.run(`UPDATE folders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
    }

    const updated = await db.get('SELECT * FROM folders WHERE id = ?', [actualId]);
    return res.json({ success: true, folder: updated });
  } catch (err) {
    console.error('Gagal memperbarui folder:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui folder.' });
  }
});

// 3c. Hapus Folder Beserta Isinya (Mendukung ID dan Pembersihan Duplikat)
router.delete('/folder/:id', async (req, res) => {
  try {
    const folderId = req.params.id;
    const folderName = req.query.name;
    const userId = req.user.id;

    const systemRoots = [
      `folder-scan-${userId}`, `folder-conv-${userId}`, `folder-doc-${userId}`, `folder-arc-${userId}`,
      'folder-scan', 'folder-converted', 'folder-my-docs', 'folder-archive'
    ];
    if (systemRoots.includes(folderId)) {
      return res.status(400).json({ success: false, message: 'Folder sistem bawaan tidak dapat dihapus.' });
    }

    // Cari folder berdasarkan ID utama, ID alternatif (- vs _), atau nama jika ada
    let folder = await db.get('SELECT * FROM folders WHERE id = ? AND user_id = ?', [folderId, userId]);
    if (!folder) {
      const altId = folderId.includes('-') ? folderId.replace(/-/g, '_') : folderId.replace(/_/g, '-');
      folder = await db.get('SELECT * FROM folders WHERE id = ? AND user_id = ?', [altId, userId]);
    }
    if (!folder && folderName) {
      folder = await db.get('SELECT * FROM folders WHERE LOWER(name) = LOWER(?) AND user_id = ? LIMIT 1', [folderName.trim(), userId]);
    }

    if (!folder) {
      // Jika sudah tidak ada di server, anggap sudah terhapus agar client sinkron
      return res.json({ success: true, message: 'Folder sudah tidak ada di server.' });
    }

    // Kumpulkan semua ID folder yang sama atau subfolder secara rekursif
    // Termasuk seluruh duplikat folder dengan nama yang sama milik user ini
    const matchingFolders = await db.all(
      'SELECT id FROM folders WHERE user_id = ? AND (id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)))',
      [userId, folder.id, folder.name]
    );

    const folderIdsToDelete = Array.from(
      new Set(
        [folder.id, ...matchingFolders.map(f => f.id)].filter(fid => !systemRoots.includes(fid))
      )
    );

    if (folderIdsToDelete.length === 0) {
      return res.json({ success: true, message: 'Folder tidak ditemukan atau merupakan folder sistem.' });
    }
    let queue = [...folderIdsToDelete];

    while (queue.length > 0) {
      const current = queue.shift();
      const subfolders = await db.all('SELECT id FROM folders WHERE parent_id = ? AND user_id = ?', [current, userId]);
      for (const sub of subfolders) {
        if (!folderIdsToDelete.includes(sub.id)) {
          folderIdsToDelete.push(sub.id);
          queue.push(sub.id);
        }
      }
    }

    // Cari dan hapus semua file fisik di disk yang berada di dalam folder-folder ini
    const placeholders = folderIdsToDelete.map(() => '?').join(',');
    const filesToDelete = await db.all(`SELECT * FROM files WHERE folder_id IN (${placeholders}) AND user_id = ?`, [...folderIdsToDelete, userId]);

    for (const f of filesToDelete) {
      if (f.disk_path) {
        const fullDiskPath = path.resolve(__dirname, '../../', f.disk_path);
        if (fs.existsSync(fullDiskPath)) {
          try { fs.unlinkSync(fullDiskPath); } catch (e) {}
        }
      }
    }

    // Hapus data file dari database
    await db.run(`DELETE FROM files WHERE folder_id IN (${placeholders}) AND user_id = ?`, [...folderIdsToDelete, userId]);

    // Hapus folder-folder dari database
    await db.run(`DELETE FROM folders WHERE id IN (${placeholders}) AND user_id = ?`, [...folderIdsToDelete, userId]);

    return res.json({ success: true, message: 'Folder dan seluruh isinya berhasil dihapus.' });
  } catch (err) {
    console.error('Gagal menghapus folder:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus folder.' });
  }
});

// 4. Update File (Rename, Move Folder, Star, Trash, Restore)
router.put('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;
    const { name, folderId, isStarred, isTrash } = req.body;

    let file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, userId]);
    if (!file) {
      const altId = fileId.includes('-') ? fileId.replace(/-/g, '_') : fileId.replace(/_/g, '-');
      file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [altId, userId]);
    }

    if (!file) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    const actualId = file.id;
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
      params.push(actualId, userId);

      await db.run(`UPDATE files SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
    }

    const updatedFile = await db.get('SELECT * FROM files WHERE id = ?', [actualId]);
    return res.json({ success: true, file: updatedFile });
  } catch (err) {
    console.error('Error update file:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui berkas.' });
  }
});

// 5. Hapus File Permanen
router.delete('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    let file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, userId]);
    if (!file) {
      const altId = fileId.includes('-') ? fileId.replace(/-/g, '_') : fileId.replace(/_/g, '-');
      file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [altId, userId]);
    }

    if (!file) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    const actualId = file.id;

    // Hapus fisik file dari disk VPS
    const fullDiskPath = path.resolve(__dirname, '../../', file.disk_path);
    if (fs.existsSync(fullDiskPath)) {
      try {
        fs.unlinkSync(fullDiskPath);
      } catch (e) {
        console.warn('Gagal menghapus file fisik di disk:', e);
      }
    }

    await db.run('DELETE FROM files WHERE id = ? AND user_id = ?', [actualId, userId]);
    return res.json({ success: true, message: 'Berkas berhasil dihapus permanen.' });
  } catch (err) {
    console.error('Error hapus file:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus berkas.' });
  }
});

// 6. Kosongkan Tempat Sampah (Empty Trash)
router.delete('/trash/empty', async (req, res) => {
  try {
    const userId = req.user.id;
    const trashedFiles = await db.all('SELECT * FROM files WHERE user_id = ? AND is_trash = 1', [userId]);

    for (const f of trashedFiles) {
      const fullDiskPath = path.resolve(__dirname, '../../', f.disk_path);
      if (fs.existsSync(fullDiskPath)) {
        try { fs.unlinkSync(fullDiskPath); } catch (e) {}
      }
    }

    await db.run('DELETE FROM files WHERE user_id = ? AND is_trash = 1', [userId]);
    return res.json({ success: true, message: 'Tempat sampah berhasil dikosongkan.' });
  } catch (err) {
    console.error('Error empty trash:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengosongkan tempat sampah.' });
  }
});

// 7. Download / Stream Berkas
router.get('/download/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    let file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, userId]);
    if (!file) {
      const altId = fileId.includes('-') ? fileId.replace(/-/g, '_') : fileId.replace(/_/g, '-');
      file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [altId, userId]);
    }

    if (!file) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    const fullDiskPath = path.resolve(__dirname, '../../', file.disk_path);
    if (!fs.existsSync(fullDiskPath)) {
      return res.status(404).json({ success: false, message: 'Berkas fisik tidak ditemukan di server.' });
    }

    res.download(fullDiskPath, file.name);
  } catch (err) {
    console.error('Error download:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengunduh berkas.' });
  }
});

// 8. Stream Pratinjau Berkas (Inline)
router.get('/preview/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    let file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, userId]);
    if (!file) {
      const altId = fileId.includes('-') ? fileId.replace(/-/g, '_') : fileId.replace(/_/g, '-');
      file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [altId, userId]);
    }

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
    console.error('Error preview:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat pratinjau berkas.' });
  }
});

export default router;
