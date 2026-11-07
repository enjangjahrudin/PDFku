import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, seedDefaultFolders } from '../db.js';
import { authenticateToken, JWT_SECRET } from '../middleware.js';

const router = express.Router();

// Register user baru
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;

    if (!username || !email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Semua bidang wajib diisi.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Periksa apakah username atau email sudah ada
    const existing = await db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(cleanUsername, cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username atau email sudah terdaftar.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const now = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO users (username, email, password_hash, name, role, status, storage_quota, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', 'active', 524288000, ?, ?)
    `);

    const result = await insert.run(cleanUsername, cleanEmail, hash, name.trim(), now, now);
    const userId = result.lastInsertRowid;

    // Buat folder bawaan
    await seedDefaultFolders(userId);

    const token = jwt.sign({ id: userId, email: cleanEmail, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil.',
      token,
      user: {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        name: name.trim(),
        role: 'user',
        storage_quota: 524288000
      }
    });
  } catch (err) {
    console.error('Error register:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat mendaftar.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier bisa email atau username

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email dan kata sandi wajib diisi.' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = await db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(cleanId, cleanId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan. Silakan periksa kembali.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan oleh Administrator.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Kata sandi tidak sesuai.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    // Hitung storage yang terpakai
    const storageSum = await db.prepare('SELECT COALESCE(SUM(size), 0) as used_bytes FROM files WHERE user_id = ?').get(user.id);

    return res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        storage_quota: user.storage_quota,
        used_storage: storageSum ? storageSum.used_bytes : 0
      }
    });
  } catch (err) {
    console.error('Error login:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat login.' });
  }
});

// Profil Saya (Me)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const storageSum = await db.prepare('SELECT COALESCE(SUM(size), 0) as used_bytes, COUNT(*) as file_count FROM files WHERE user_id = ?').get(req.user.id);
    return res.json({
      success: true,
      user: {
        ...req.user,
        used_storage: storageSum ? storageSum.used_bytes : 0,
        file_count: storageSum ? storageSum.file_count : 0
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data profil.' });
  }
});

// Update Password Sendiri
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
    }

    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(400).json({ success: false, message: 'Password lama salah.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);
    const now = new Date().toISOString();

    await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now, req.user.id);

    return res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengubah password.' });
  }
});

export default router;
