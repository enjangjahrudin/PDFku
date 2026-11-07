import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan direktori data & uploads tersedia
const dataDir = path.resolve(__dirname, '../data');
const uploadsDir = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pdfku.db');
export const db = new Database(dbPath);

// Inisialisasi skema tabel SQLite
export function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      storage_quota INTEGER DEFAULT 524288000, -- 500 MB default
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      color TEXT DEFAULT '#4f46e5',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      disk_path TEXT NOT NULL,
      thumbnail TEXT,
      folder_id TEXT,
      ocr_text TEXT,
      is_starred INTEGER DEFAULT 0,
      is_trash INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
    CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
    CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
  `);

  // Migrasi otomatis perbaikan parent_id folder & folder_id berkas agar rapi di bawah folder bawaan user
  try {
    db.exec(`
      UPDATE folders SET parent_id = 'folder-conv-' || user_id WHERE parent_id = 'folder-converted';
      UPDATE folders SET parent_id = 'folder-scan-' || user_id WHERE parent_id = 'folder-scan';
      UPDATE folders SET parent_id = 'folder-doc-' || user_id WHERE parent_id = 'folder-my-docs';
      UPDATE folders SET parent_id = 'folder-arc-' || user_id WHERE parent_id = 'folder-archive';

      UPDATE files SET folder_id = 'folder-conv-' || user_id WHERE folder_id = 'folder-converted';
      UPDATE files SET folder_id = 'folder-scan-' || user_id WHERE folder_id = 'folder-scan';
      UPDATE files SET folder_id = 'folder-doc-' || user_id WHERE folder_id = 'folder-my-docs';
      UPDATE files SET folder_id = 'folder-arc-' || user_id WHERE folder_id = 'folder-archive';
    `);
  } catch (err) {
    console.warn('Notice migrasi DB:', err);
  }

  // Buat default Administrator jika belum ada akun di database
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (countUsers.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    const now = new Date().toISOString();

    const insertAdmin = db.prepare(`
      INSERT INTO users (username, email, password_hash, name, role, status, storage_quota, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', 'active', 5368709120, ?, ?)
    `);
    const res = insertAdmin.run('admin', 'admin@pdfku.id', hash, 'Administrator PDFku', now, now);
    const adminId = res.lastInsertRowid;

    // Buat default folder awal untuk admin
    seedDefaultFolders(adminId);
    console.log('✅ Default admin akun dibuat: admin@pdfku.id / admin123');
  }
}

export function seedDefaultFolders(userId) {
  const folders = [
    { id: `folder-scan-${userId}`, name: 'Hasil Scan', color: '#3b82f6' },
    { id: `folder-conv-${userId}`, name: 'Hasil Konversi', color: '#10b981' },
    { id: `folder-doc-${userId}`, name: 'Dokumen Saya', color: '#f59e0b' },
    { id: `folder-arc-${userId}`, name: 'Arsip Dokumen', color: '#8b5cf6' }
  ];

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO folders (id, user_id, name, parent_id, color, created_at)
    VALUES (?, ?, ?, NULL, ?, ?)
  `);

  for (const f of folders) {
    insert.run(f.id, userId, f.name, f.color, now);
  }
}
