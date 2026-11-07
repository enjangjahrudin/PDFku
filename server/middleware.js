import jwt from 'jsonwebtoken';
import { db } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'pdfku-secret-key-2026-vps-secure';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Silakan login.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Sesi login telah kedaluwarsa atau tidak valid.' });
    }

    try {
      const user = await db.prepare('SELECT id, username, email, name, role, status, storage_quota FROM users WHERE id = ?').get(decoded.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Akun pengguna tidak ditemukan.' });
      }

      if (user.status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan oleh Administrator.' });
      }

      req.user = user;
      next();
    } catch (dbErr) {
      console.error('Auth DB error:', dbErr);
      return res.status(500).json({ success: false, message: 'Kesalahan internal database autentikasi.' });
    }
  });
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak. Fitur ini hanya untuk Administrator.' });
  }
  next();
}
