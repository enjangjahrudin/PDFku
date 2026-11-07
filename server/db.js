import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan direktori data & uploads tersedia
const dataDir = path.resolve(__dirname, '../data');
const uploadsDir = path.resolve(__dirname, '../uploads');
const envPath = path.resolve(__dirname, '../.env');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pdfku.db');

let pool = null;
let sqliteDb = null;
export let isMySQL = false;
export let lastMysqlError = null;

export const db = {
  async get(sql, params = []) {
    const flatParams = Array.isArray(params) ? params.flat() : [params];
    if (isMySQL && pool) {
      const [rows] = await pool.query(sql, flatParams);
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    } else {
      if (!sqliteDb) sqliteDb = new Database(dbPath);
      return sqliteDb.prepare(sql).get(...flatParams) || null;
    }
  },

  async all(sql, params = []) {
    const flatParams = Array.isArray(params) ? params.flat() : [params];
    if (isMySQL && pool) {
      const [rows] = await pool.query(sql, flatParams);
      return Array.isArray(rows) ? rows : [];
    } else {
      if (!sqliteDb) sqliteDb = new Database(dbPath);
      return sqliteDb.prepare(sql).all(...flatParams) || [];
    }
  },

  async run(sql, params = []) {
    const flatParams = Array.isArray(params) ? params.flat() : [params];
    if (isMySQL && pool) {
      const [result] = await pool.query(sql, flatParams);
      return {
        lastInsertRowid: result.insertId,
        changes: result.affectedRows
      };
    } else {
      if (!sqliteDb) sqliteDb = new Database(dbPath);
      const res = sqliteDb.prepare(sql).run(...flatParams);
      return {
        lastInsertRowid: res.lastInsertRowid,
        changes: res.changes
      };
    }
  },

  prepare(sql) {
    return {
      get: (...params) => this.get(sql, params),
      all: (...params) => this.all(sql, params),
      run: (...params) => this.run(sql, params)
    };
  }
};

export function getDbConfigInfo() {
  return {
    engine: isMySQL ? 'MySQL Server' : 'SQLite Lokal (Fallback)',
    isMySQL,
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'pdfku_db',
    lastError: lastMysqlError
  };
}

// Migrasi otomatis data lama dari SQLite (pdfku.db) ke MySQL Server agar tidak ada akun/berkas yang hilang
async function migrateSqliteToMySQLIfNeeded() {
  if (!isMySQL || !pool || !fs.existsSync(dbPath)) return;

  let legacyDb = null;
  try {
    legacyDb = new Database(dbPath, { readonly: true });

    // Cek apakah tabel users ada di SQLite lama
    const hasUsersTable = legacyDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .get();
    if (!hasUsersTable) {
      legacyDb.close();
      return;
    }

    const oldUsers = legacyDb.prepare('SELECT * FROM users').all();
    for (const u of oldUsers) {
      await pool.query(
        `INSERT IGNORE INTO users (id, username, email, password_hash, name, role, status, storage_quota, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u.id,
          u.username,
          u.email,
          u.password_hash,
          u.name,
          u.role || 'user',
          u.status || 'active',
          u.storage_quota || 1073741824,
          u.created_at || new Date().toISOString(),
          u.updated_at || new Date().toISOString()
        ]
      );
    }

    const hasFoldersTable = legacyDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='folders'")
      .get();
    if (hasFoldersTable) {
      const oldFolders = legacyDb.prepare('SELECT * FROM folders').all();
      for (const f of oldFolders) {
        await pool.query(
          `INSERT IGNORE INTO folders (id, user_id, name, parent_id, color, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            f.id,
            f.user_id,
            f.name,
            f.parent_id || null,
            f.color || '#3b82f6',
            f.created_at || new Date().toISOString()
          ]
        );
      }
    }

    const hasFilesTable = legacyDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='files'")
      .get();
    if (hasFilesTable) {
      const oldFiles = legacyDb.prepare('SELECT * FROM files').all();
      for (const file of oldFiles) {
        await pool.query(
          `INSERT IGNORE INTO files (id, user_id, name, type, size, disk_path, thumbnail, folder_id, ocr_text, is_starred, is_trash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            file.id,
            file.user_id,
            file.name,
            file.type,
            file.size || 0,
            file.disk_path,
            file.thumbnail || null,
            file.folder_id || null,
            file.ocr_text || null,
            file.is_starred || 0,
            file.is_trash || 0,
            file.created_at || new Date().toISOString(),
            file.updated_at || new Date().toISOString()
          ]
        );
      }
    }

    legacyDb.close();

    // Arsipkan file SQLite lama agar migrasi hanya berjalan 1 KALI saja.
    // Jika tidak diarsipkan, setiap server restart (pm2 restart) akan mengembalikan (re-import) folder/berkas yang sudah dihapus pengguna!
    const migratedPath = path.join(dataDir, 'pdfku.db.migrated');
    try {
      if (fs.existsSync(dbPath)) {
        if (fs.existsSync(dbPath + '-wal')) try { fs.unlinkSync(dbPath + '-wal'); } catch (e) {}
        if (fs.existsSync(dbPath + '-shm')) try { fs.unlinkSync(dbPath + '-shm'); } catch (e) {}
        fs.renameSync(dbPath, migratedPath);
        console.log(`✅ File SQLite lama berhasil diarsipkan ke: ${migratedPath}`);
      }
    } catch (renErr) {
      console.warn('Notice arsip SQLite:', renErr.message);
    }

    console.log('✅ Sinkronisasi & migrasi data dari SQLite lama ke MySQL Server selesai.');
  } catch (err) {
    if (legacyDb) {
      try { legacyDb.close(); } catch (e) {}
    }
    console.warn('Notice migrasi SQLite -> MySQL:', err.message);
  }
}

// Normalisasi ID folder bawaan dan penyelamatan berkas yatim (orphan) tanpa mengubah hierarki folder kustom pengguna
export async function cleanAndDeduplicateDatabase() {
  try {
    // 1. Normalisasi generic parent_id & folder_id warisan lama, serta perbaiki parent_id yang sempat terisi kode warna (#...)
    await db.run("UPDATE folders SET parent_id = NULL WHERE parent_id LIKE '#%' OR parent_id = ''");

    if (isMySQL) {
      await db.run("UPDATE folders SET parent_id = CONCAT('folder-conv-', user_id) WHERE parent_id = 'folder-converted' OR parent_id = 'folder-conv'");
      await db.run("UPDATE folders SET parent_id = CONCAT('folder-scan-', user_id) WHERE parent_id = 'folder-scan'");
      await db.run("UPDATE folders SET parent_id = CONCAT('folder-doc-', user_id) WHERE parent_id = 'folder-my-docs' OR parent_id = 'folder-doc'");
      await db.run("UPDATE folders SET parent_id = CONCAT('folder-arc-', user_id) WHERE parent_id = 'folder-archive' OR parent_id = 'folder-arc'");

      await db.run("UPDATE files SET folder_id = CONCAT('folder-conv-', user_id) WHERE folder_id = 'folder-converted' OR folder_id = 'folder-conv'");
      await db.run("UPDATE files SET folder_id = CONCAT('folder-scan-', user_id) WHERE folder_id = 'folder-scan'");
      await db.run("UPDATE files SET folder_id = CONCAT('folder-doc-', user_id) WHERE folder_id = 'folder-my-docs' OR folder_id = 'folder-doc'");
      await db.run("UPDATE files SET folder_id = CONCAT('folder-arc-', user_id) WHERE folder_id = 'folder-archive' OR folder_id = 'folder-arc'");
    } else {
      await db.run("UPDATE folders SET parent_id = 'folder-conv-' || user_id WHERE parent_id = 'folder-converted' OR parent_id = 'folder-conv'");
      await db.run("UPDATE folders SET parent_id = 'folder-scan-' || user_id WHERE parent_id = 'folder-scan'");
      await db.run("UPDATE folders SET parent_id = 'folder-doc-' || user_id WHERE parent_id = 'folder-my-docs' OR parent_id = 'folder-doc'");
      await db.run("UPDATE folders SET parent_id = 'folder-arc-' || user_id WHERE parent_id = 'folder-archive' OR parent_id = 'folder-arc'");

      await db.run("UPDATE files SET folder_id = 'folder-conv-' || user_id WHERE folder_id = 'folder-converted' OR folder_id = 'folder-conv'");
      await db.run("UPDATE files SET folder_id = 'folder-scan-' || user_id WHERE folder_id = 'folder-scan'");
      await db.run("UPDATE files SET folder_id = 'folder-doc-' || user_id WHERE folder_id = 'folder-my-docs' OR folder_id = 'folder-doc'");
      await db.run("UPDATE files SET folder_id = 'folder-arc-' || user_id WHERE folder_id = 'folder-archive' OR folder_id = 'folder-arc'");
    }

    // 2. Gabungkan folder duplikat HANYA jika memiliki user_id, parent_id, dan nama yang sama persis
    const allFolders = await db.all('SELECT * FROM folders ORDER BY created_at ASC');
    const folderGroups = new Map();

    for (const f of allFolders) {
      const isSys =
        f.id.startsWith('folder-scan-') ||
        f.id.startsWith('folder-conv-') ||
        f.id.startsWith('folder-doc-') ||
        f.id.startsWith('folder-arc-');
      const key = isSys
        ? `sys:::${f.id}`
        : `${f.user_id}:::${f.parent_id || 'root'}:::${f.name.trim().toLowerCase()}`;
      if (!folderGroups.has(key)) {
        folderGroups.set(key, []);
      }
      folderGroups.get(key).push(f);
    }

    for (const [, group] of folderGroups.entries()) {
      if (group.length > 1) {
        const survivor = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          await db.run('UPDATE files SET folder_id = ? WHERE folder_id = ?', [survivor.id, dup.id]);
          await db.run('UPDATE folders SET parent_id = ? WHERE parent_id = ?', [survivor.id, dup.id]);
          await db.run('DELETE FROM folders WHERE id = ?', [dup.id]);
        }
      }
    }

    // 3. Pulihkan hanya berkas yatim (orphan) yang folder_id-nya tidak ada di tabel folders
    //    Jangan pernah memindahkan berkas yang sudah memiliki folder_id valid!
    const remainingFolders = await db.all('SELECT * FROM folders');
    const validFolderIds = new Set(remainingFolders.map(f => f.id));
    const userFolderByName = new Map();
    for (const f of remainingFolders) {
      userFolderByName.set(`${f.user_id}:::${f.name.trim().toLowerCase()}`, f.id);
    }

    const allFiles = await db.all('SELECT id, user_id, name, folder_id FROM files WHERE is_trash = 0');
    for (const file of allFiles) {
      if (file.folder_id && validFolderIds.has(file.folder_id)) {
        continue;
      }

      const halMatch = file.name.match(/^(.+)_Hal_\d+\.(jpg|jpeg|png)$/i);
      if (halMatch) {
        const rawFolderName = halMatch[1].trim();
        const prefixName = rawFolderName.toLowerCase();
        let matchedFolderId = userFolderByName.get(`${file.user_id}:::${prefixName}`);
        if (!matchedFolderId) {
          // Buat kembali folder hasil konversi yang sempat hilang agar berkas tidak lenyap di UI
          matchedFolderId = `folder_rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const parentConvId = `folder-conv-${file.user_id}`;
          const nowIso = new Date().toISOString();
          await db.run(
            'INSERT INTO folders (id, user_id, name, parent_id, color, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [matchedFolderId, file.user_id, rawFolderName, parentConvId, '#10b981', nowIso]
          );
          validFolderIds.add(matchedFolderId);
          userFolderByName.set(`${file.user_id}:::${prefixName}`, matchedFolderId);
        }
        await db.run('UPDATE files SET folder_id = ? WHERE id = ?', [matchedFolderId, file.id]);
        continue;
      }

      // Jika berkas lain kehilangan foldernya, arahkan ke Dokumen Saya milik user tersebut
      const fallbackDocFolder = `folder-doc-${file.user_id}`;
      if (validFolderIds.has(fallbackDocFolder)) {
        await db.run('UPDATE files SET folder_id = ? WHERE id = ?', [fallbackDocFolder, file.id]);
      }
    }
  } catch (migErr) {
    console.warn('Notice migrasi DB:', migErr.message);
  }
}

export async function initDb() {
  const dbType = process.env.DB_TYPE || (process.env.DB_NAME || process.env.DB_USER ? 'mysql' : 'sqlite');
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'pdfku_db';

  if (dbType === 'mysql') {
    try {
      console.log(`🔌 Menghubungkan ke MySQL Server (${host}:${port}, database: ${database})...`);

      // 1. Cek koneksi & buat database jika belum ada
      const tempConn = await mysql.createConnection({
        host,
        port,
        user,
        password
      });

      await tempConn.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await tempConn.end();

      // 2. Buat Connection Pool untuk aplikasi
      if (pool) {
        try { await pool.end(); } catch (e) {}
      }
      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        charset: 'utf8mb4'
      });

      // Tes koneksi pool
      await pool.query('SELECT 1');
      isMySQL = true;
      lastMysqlError = null;
      console.log(`✅ Berhasil terhubung ke MySQL Server: ${database}`);

      // 3. Buat skema tabel MySQL
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(64) UNIQUE NOT NULL,
          email VARCHAR(128) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(128) NOT NULL,
          role VARCHAR(20) DEFAULT 'user',
          status VARCHAR(20) DEFAULT 'active',
          storage_quota BIGINT DEFAULT 1073741824,
          created_at VARCHAR(64) NOT NULL,
          updated_at VARCHAR(64) NOT NULL,
          INDEX idx_users_username (username),
          INDEX idx_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS folders (
          id VARCHAR(64) PRIMARY KEY,
          user_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          parent_id VARCHAR(64) NULL,
          color VARCHAR(20) DEFAULT '#3b82f6',
          created_at VARCHAR(64) NOT NULL,
          INDEX idx_folders_user (user_id),
          INDEX idx_folders_parent (parent_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS files (
          id VARCHAR(64) PRIMARY KEY,
          user_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          size BIGINT NOT NULL,
          disk_path VARCHAR(500) NOT NULL,
          thumbnail LONGTEXT NULL,
          folder_id VARCHAR(64) NULL,
          ocr_text LONGTEXT NULL,
          is_starred TINYINT DEFAULT 0,
          is_trash TINYINT DEFAULT 0,
          created_at VARCHAR(64) NOT NULL,
          updated_at VARCHAR(64) NOT NULL,
          INDEX idx_files_user (user_id),
          INDEX idx_files_folder (folder_id),
          INDEX idx_files_trash (user_id, is_trash)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 4. Migrasi otomatis data dari SQLite lama (jika ada) ke MySQL
      await migrateSqliteToMySQLIfNeeded();
    } catch (mysqlErr) {
      lastMysqlError = mysqlErr.message;
      console.warn(`⚠️ Koneksi MySQL gagal (${mysqlErr.message}). Beralih otomatis ke SQLite.`);
      isMySQL = false;
    }
  }

  // Jika SQLite dipilih atau MySQL gagal terhubung:
  if (!isMySQL) {
    if (!sqliteDb) {
      sqliteDb = new Database(dbPath);
    }
    sqliteDb.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        storage_quota INTEGER DEFAULT 1073741824,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        parent_id TEXT,
        color TEXT DEFAULT '#3b82f6',
        created_at TEXT NOT NULL
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
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
      CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
      CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
    `);
  }

  // Jalankan pembersihan duplikat dan penautan ulang berkas
  await cleanAndDeduplicateDatabase();

  // Buat default Administrator jika belum ada akun
  try {
    const countUsers = await db.get('SELECT COUNT(*) as count FROM users');
    if (!countUsers || countUsers.count === 0) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin123', salt);
      const now = new Date().toISOString();

      const res = await db.run(`
        INSERT INTO users (username, email, password_hash, name, role, status, storage_quota, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'admin', 'active', 5368709120, ?, ?)
      `, ['admin', 'admin@pdfku.id', hash, 'Administrator PDFku', now, now]);

      const adminId = res.lastInsertRowid;
      await seedDefaultFolders(adminId);
      console.log('✅ Default akun Administrator dibuat: admin@pdfku.id / admin123');
    }
  } catch (adminErr) {
    console.warn('Notice init admin:', adminErr.message);
  }
}

// Fungsi untuk menyimpan konfigurasi MySQL ke .env & langsung menghubungkan ulang tanpa restart manual
export async function configureAndConnectMySQL({ host, port, user, password, database }) {
  process.env.DB_TYPE = 'mysql';
  process.env.DB_HOST = host || '127.0.0.1';
  process.env.DB_PORT = String(port || 3306);
  process.env.DB_USER = user || 'root';
  process.env.DB_PASSWORD = password || '';
  process.env.DB_NAME = database || 'pdfku_db';

  // Simpan ke file .env agar permanen saat server restart
  const envContent = [
    `PORT=${process.env.PORT || 3001}`,
    `DB_TYPE=mysql`,
    `DB_HOST=${process.env.DB_HOST}`,
    `DB_PORT=${process.env.DB_PORT}`,
    `DB_USER=${process.env.DB_USER}`,
    `DB_PASSWORD=${process.env.DB_PASSWORD}`,
    `DB_NAME=${process.env.DB_NAME}`,
    `JWT_SECRET=${process.env.JWT_SECRET || 'pdfku-secret-key-2026-vps-secure'}`
  ].join('\n') + '\n';

  fs.writeFileSync(envPath, envContent, 'utf8');

  await initDb();
  if (!isMySQL) {
    throw new Error(lastMysqlError || 'Gagal terhubung ke MySQL Server.');
  }
  return getDbConfigInfo();
}

export async function seedDefaultFolders(userId) {
  const folders = [
    { id: `folder-scan-${userId}`, name: 'Hasil Scan', color: '#3b82f6' },
    { id: `folder-conv-${userId}`, name: 'Hasil Konversi', color: '#10b981' },
    { id: `folder-doc-${userId}`, name: 'Dokumen Saya', color: '#f59e0b' },
    { id: `folder-arc-${userId}`, name: 'Arsip Dokumen', color: '#8b5cf6' }
  ];

  const now = new Date().toISOString();
  for (const f of folders) {
    const existing = await db.get('SELECT id FROM folders WHERE id = ?', [f.id]);
    if (!existing) {
      await db.run(`
        INSERT INTO folders (id, user_id, name, parent_id, color, created_at)
        VALUES (?, ?, ?, NULL, ?, ?)
      `, [f.id, userId, f.name, f.color, now]);
    }
  }
}
