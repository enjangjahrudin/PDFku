import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import filesRoutes from './routes/files.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inisialisasi Database SQLite
initDb();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes (Akses berkas wajib melalui /api/files dengan autentikasi per-user)
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'PDFku Cloud Server',
    version: '1.2.0',
    time: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PDFku Backend Server berjalan di http://0.0.0.0:${PORT}`);
});
