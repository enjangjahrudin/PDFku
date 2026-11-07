import express from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, seedDefaultFolders, getDbConfigInfo, configureAndConnectMySQL } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsBaseDir = path.resolve(__dirname, '../../uploads');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// 0. Info & Konfigurasi Database MySQL Server
router.get('/db-config', (req, res) => {
  return res.json({
    success: true,
    config: getDbConfigInfo()
  });
});

router.post('/db-config', async (req, res) => {
  try {
    const { host, port, user, password, database } = req.body;
    const config = await configureAndConnectMySQL({ host, port, user, password, database });
    return res.json({
      success: true,
      message: `Berhasil terhubung ke MySQL Server (${config.database}) dan memigrasikan data!`,
      config
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Gagal menghubungkan ke MySQL Server.'
    });
  }
});

// 1. Statistik Keseluruhan Server & Dokumen
router.get('/stats', async (req, res) => {
  try {
    const totalUsersRow = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const activeUsersRow = await db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get();
    const totalFilesRow = await db.prepare('SELECT COUNT(*) as count FROM files').get();
    const totalStorageRow = await db.prepare('SELECT COALESCE(SUM(size), 0) as total_bytes FROM files').get();

    const totalUsers = totalUsersRow ? totalUsersRow.count : 0;
    const activeUsers = activeUsersRow ? activeUsersRow.count : 0;
    const totalFiles = totalFilesRow ? totalFilesRow.count : 0;
    const totalStorage = totalStorageRow ? totalStorageRow.total_bytes : 0;

    // Hitung berdasarkan tipe berkas
    const typeBreakdown = await db.prepare(`
      SELECT 
        CASE 
          WHEN type LIKE '%pdf%' THEN 'PDF'
          WHEN type LIKE '%image%' THEN 'Gambar (JPG/PNG)'
          ELSE 'Lainnya'
        END as category,
        COUNT(*) as count,
        COALESCE(SUM(size), 0) as bytes
      FROM files
      GROUP BY category
    `).all();

    return res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalFiles,
        totalStorageBytes: totalStorage,
        typeBreakdown,
        serverTime: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error admin stats:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil statistik server.' });
  }
});

// 2. Daftar Semua Pengguna (User Management)
router.get('/users', async (req, res) => {
  try {
    const users = await db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.name, 
        u.role, 
        u.status, 
        u.storage_quota, 
        u.created_at,
        u.updated_at,
        COALESCE(SUM(f.size), 0) as used_storage,
        COUNT(f.id) as file_count
      FROM users u
      LEFT JOIN files f ON u.id = f.user_id
      GROUP BY u.id
      ORDER BY u.id ASC
    `).all();

    return res.json({ success: true, users });
  } catch (err) {
    console.error('Error admin users:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar pengguna.' });
  }
});

// 3. Tambah Pengguna Baru oleh Admin
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, name, role, storage_quota } = req.body;

    if (!username || !email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    const existing = await db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(cleanUsername, cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username atau email sudah digunakan.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const now = new Date().toISOString();
    const quota = Number(storage_quota) || 524288000; // 500 MB default

    const insert = db.prepare(`
      INSERT INTO users (username, email, password_hash, name, role, status, storage_quota, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `);

    const result = await insert.run(cleanUsername, cleanEmail, hash, name.trim(), role || 'user', quota, now, now);
    const newUserId = result.lastInsertRowid;

    await seedDefaultFolders(newUserId);

    return res.status(201).json({
      success: true,
      message: 'Pengguna baru berhasil ditambahkan.',
      userId: newUserId
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan pengguna.' });
  }
});

// 4. Update Pengguna (Ubah Role, Status, Kuota, atau Reset Password)
router.put('/users/:id', async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const { role, status, storage_quota, name, newPassword } = req.body;

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    // Hindari mencabut role admin dari diri sendiri secara tidak sengaja
    if (targetUserId === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat mencabut hak Administrator dari akun Anda sendiri.' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (role) {
      updates.push('role = ?');
      params.push(role);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (storage_quota !== undefined) {
      updates.push('storage_quota = ?');
      params.push(Number(storage_quota));
    }
    if (newPassword && newPassword.trim().length >= 6) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(newPassword.trim(), salt);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(targetUserId);

      await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    return res.json({ success: true, message: 'Data pengguna berhasil diperbarui.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengguna.' });
  }
});

// 5. Hapus Pengguna & Semua Berkasnya dari Disk
router.delete('/users/:id', async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);

    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang login.' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    // Hapus folder upload user dari disk VPS
    const userDir = path.join(uploadsBaseDir, `user_${targetUserId}`);
    if (fs.existsSync(userDir)) {
      try {
        fs.rmSync(userDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Gagal menghapus direktori user di disk:', e);
      }
    }

    // Cascade delete file & folder & user
    await db.prepare('DELETE FROM files WHERE user_id = ?').run(targetUserId);
    await db.prepare('DELETE FROM folders WHERE user_id = ?').run(targetUserId);
    await db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);

    return res.json({ success: true, message: 'Pengguna dan seluruh berkasnya berhasil dihapus permanen.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pengguna.' });
  }
});

export default router;
