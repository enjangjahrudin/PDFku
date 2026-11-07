# PRODUCT REQUIREMENT DOCUMENT (PRD)
## SmartDoc – Intelligent Document Scanner, Converter & Explorer

* **Status:** Draft / Updated with Feature Recommendations
* **Versi:** 1.1.0
* **Target Platform:** Web Application (Responsive Desktop/Tablet-First, PWA-Ready)
* **Kategori:** Productivity / Document Management System (DMS)

---

## 1. Executive Summary & Visi Produk

### 1.1 Latar Belakang
Banyak pengguna kantor, staf administrasi, pelajar, dan pebisnis yang menghadapi kerepotan dalam memindai dokumen fisik, mengonversi antar format berkas (PDF ↔ JPG), serta merapikan arsip berkas di komputer. Sebagian besar alat online yang ada:
1. Mengharuskan upload dokumen rahasia/pribadi ke server publik pihak ketiga yang rawan kebocoran data.
2. Membatasi ukuran berkas, jumlah halaman, atau menyisipkan watermark berbayar.
3. Terfragmentasi (aplikasi scan di ponsel, converter di website gratisan, dan pengorganisasian file harus bolak-balik ke Windows Explorer).

### 1.2 Visi & Nilai Utama
**SmartDoc** adalah aplikasi serbaguna berbasis *local-first* yang menyatukan alur kerja pemrosesan dokumen secara lengkap ke dalam satu antarmuka yang bersih dan akrab:
1. **Magic Scanner ala CamScanner**: Pembersihan dokumen otomatis (contrast boost, penghilangan bayangan, perataan tepi perspektif otomatis).
2. **Dual-Direction Converter**: Konversi fleksibel PDF ke JPG dan JPG ke PDF tanpa kompromi kualitas.
3. **Windows-Style File Explorer**: Mengelola folder, berkas hasil scan, dan konversi dengan tampilan yang familiar dan mudah digunakan.
4. **Privasi & Kecepatan Mutlak**: Seluruh pemrosesan berjalan di sisi klien (*Client-side / WebAssembly*) tanpa melempar dokumen ke server eksternal.

---

## 2. Target Pengguna (User Personas)
* **Staf Administrasi, Keuangan & Legal:** Sering memindai kuitansi, nota, kontrak, dan perlu menggabungkannya ke dalam satu PDF rapi dengan ukuran terkontrol.
* **Pencari Kerja & Calon Peserta Seleksi (CPNS, Beasiswa, Visa):** Membutuhkan kompresi PDF ke ukuran spesifik (misal: tepat di bawah 300 KB atau 500 KB) dan scan dokumen KTP/Ijazah tanpa bayangan.
* **Pelajar / Mahasiswa:** Mengonversi materi kuliah, catatan tulisan tangan, serta tugas agar mudah dibaca dan dicari teksnya.
* **Pengguna Umum & UMKM:** Membutuhkan sistem pengarsipan digital mandiri tanpa berlangganan software mahal.

---

## 3. Cakupan Fitur & Kebutuhan Fungsional (Core Modules)

### Modul 1: Smart Document Scanner & Magic Enhancer (P0 - Core)

Tujuan: Menghasilkan tangkapan dokumen berkualitas cetak dari kamera atau foto mentah.

1. **Input Sumber:**
   - Ambil langsung via Kamera / Webcam.
   - Upload berkas gambar mentah (`.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`).
   - Batch upload gambar multi-halaman sekaligus.

2. **Auto Edge Detection & Crop (Deteksi Batas Otomatis):**
   - Mendeteksi 4 sudut lembar dokumen secara otomatis menggunakan deteksi kontur (*OpenCV.js*).
   - Menyediakan handle interaktif 4 titik bagi pengguna untuk meluruskan sudut secara manual.
   - Transformasi perspektif (*perspective warp*) sehingga dokumen yang difoto miring menjadi tegak lurus sempurna.

3. **Magic Enhancement Filters (Penyempurnaan Ajaib):**
   - **Magic Color (Default ala CamScanner):** Mencerahkan latar belakang menjadi putih bersih alami, menaikkan kontras teks hitam, dan mempertahankan ketajaman warna stempel/tanda tangan.
   - **B&W / Clean Document (Binarization):** Mengubah dokumen menjadi hitam-putih murni dengan threshold adaptif (mirip fotokopi dokumen resmi).
   - **Grayscale:** Konversi skala abu-abu halus untuk dokumen teks formal.
   - **Shadow Removal:** Algoritma pembersih bayangan tangan, bayangan ponsel, atau lipatan kertas.
   - **Original / No-Filter:** Mempertahankan foto asli tanpa modifikasi warna.
   - **Penyesuaian Manual:** Slider kecerahan (*brightness*), kontras (*contrast*), ketajaman (*sharpening*), dan rotasi 90°.

4. **Multi-Page Management & Output:**
   - Pengurutan ulang halaman (drag-and-drop reorder).
   - Simpan langsung ke format **PDF multi-halaman** atau **file JPG per lembar**.

---

### Modul 2: Universal Converter (PDF ↔ JPG) (P0 - Core)

Tujuan: Konversi dua arah yang cepat, presisi, dan menjaga kualitas asli.

#### A. PDF to JPG Converter
* **Input:** File `.pdf` (single atau batch).
* **Fitur Pemrosesan:**
  - Pilihan halaman: seluruh halaman atau rentang spesifik (misal: `1, 3-5, 8`).
  - Pemilihan DPI / Resolusi: Standar (150 DPI) atau Cetak Kualitas Tinggi (300 DPI).
* **Output:**
  - File JPG tunggal atau kumpulan file dalam bentuk arsip `.zip`.
  - Opsi: *Simpan langsung ke folder aktif di File Explorer SmartDoc*.

#### B. JPG to PDF Converter
* **Input:** Satu atau banyak berkas gambar.
* **Fitur Pemrosesan:**
  - Preview thumbnail tiap halaman dengan fasilitas drag-and-drop urutan.
  - Pengaturan Orientasi: *Auto-detect*, *Portrait*, atau *Landscape*.
  - Pengaturan Ukuran Kertas: *A4*, *Letter*, *Legal*, atau *Fit to Image*.
  - Pengaturan Margin Dokumen: *No Margin*, *Small*, atau *Standard*.
* **Output:**
  - Satu file PDF gabungan (*Merged PDF*).

---

### Modul 3: Windows-Style File Explorer (P0 - Core)

Tujuan: Pengelolaan berkas dokumen dengan antarmuka yang sangat akrab menyerupai Windows 11 File Explorer.

1. **Tata Letak (Layout):**
   - **Sidebar Navigasi (Kiri):**
     - Quick Access: *Recent Files*, *Favorites / Starred*, *Recycle Bin*.
     - Folder Tree: Pohon direktori hierarkis (`Dokumen Saya`, `Hasil Scan`, `Hasil Konversi`, `Arsip`).
     - Indikator kapasitas penyimpanan lokal.
   - **Top Navigation Bar & Breadcrumb (Atas):**
     - Navigasi: Back (`←`), Forward (`→`), Up to Parent (`↑`), Refresh (`↻`).
     - Breadcrumb interaktif yang dapat diklik tiap segmennya (misal: `Dokumen Saya > 2026 > Keuangan`).
     - Search Box instan dengan pencarian cepat nama berkas dan tag.
   - **Toolbar Menu (Atas):**
     - Tombol aksi: `+ Scan Dokumen`, `+ Konversi Berkas`, `+ Folder Baru`, `Upload`, `Rename`, `Copy`, `Move`, `Delete`, `Download`.
   - **Main Content Area (Tengah):**
     - **Grid View:** Ikon kartu besar dengan gambar thumbnail nyata dari halaman pertama dokumen.
     - **Details / List View:** Tabel lengkap (*Nama, Tanggal Modifikasi, Tipe Berkas, Ukuran Berkas*).
     - Multi-selection: Seleksi multi-berkas dengan `Ctrl` / `Shift` atau drag lasso seleksi mouse.
     - Context Menu (Klik Kanan mouse) pada berkas/folder.
   - **Preview Pane (Kanan / Modal Terbuka):**
     - Pembaca PDF bawaan (*inline PDF viewer*) dengan zoom dan lompat halaman.
     - Penampil gambar dengan pan & zoom.

---

## 4. Rekomendasi Fitur Tambahan Unggulan (Recommended Value-Add Features)

Berikut adalah penambahan fitur yang sangat direkomendasikan untuk menjadikan SmartDoc aplikasi terlengkap dan paling praktis di kelasnya:

### Modul 4: OCR & Searchable PDF Generator (P1 - High Value)
* **Ekstraksi Teks (Optical Character Recognition):**
  - Mengenali teks dari hasil scan atau berkas JPG secara otomatis menggunakan engine OCR lokal (*Tesseract.js*).
  - Mendukung Bahasa Indonesia dan Bahasa Inggris.
* **Searchable PDF (PDF Dapat Dicari):**
  - Membuat lapisan teks transparan tak terlihat tepat di atas gambar hasil scan (*invisible text overlay*). Dokumen tetap tampak rapi seperti aslinya, namun teks di dalamnya bisa diseleksi kursor, di-*copy-paste*, dan dicari dengan tombol `Ctrl + F`.
* **Ekspor Teks Cepat:**
  - Tombol 1-klik untuk menyalin seluruh teks hasil scan ke clipboard atau ekspor menjadi berkas `.txt`.

### Modul 5: Smart Document Compressor (Target File Size) (P1 - High Value)
* **Kebutuhan Pengguna Nyata:** Instansi pemerintah, portal beasiswa, rekrutmen BUMN/CPNS sering mensyaratkan "File PDF maksimal 300 KB atau 500 KB".
* **Fitur Presisi Ukuran:**
  - Pengguna dapat memilih preset instan: *Maksimal 300 KB*, *Maksimal 500 KB*, *Maksimal 1 MB*, atau *Custom Size*.
  - Algoritma adaptif yang otomatis menyesuaikan DPI dan tingkat kompresi JPEG agar ukuran file berada tepat di bawah batas target tanpa merusak keterbacaan teks.
  - Tampilan estimasi ukuran berkas sebelum diekspor.

### Modul 6: PDF Toolkit (Merge, Split, Rotate & Page Organizer) (P1 - High Value)
* **Merge PDF:** Menggabungkan beberapa file PDF yang berbeda menjadi satu dokumen berurutan.
* **Split PDF:** Memisahkan dokumen PDF per halaman atau mengekstrak halaman tertentu saja.
* **Page Organizer:**
  - Hapus halaman kosong atau salah scan.
  - Putar (*rotate*) halaman tertentu yang posisinya terbalik (90° / 180°).
  - Susun ulang urutan halaman dokumen PDF yang sudah ada tanpa perlu scan ulang.

### Modul 7: Tanda Tangan Digital, Cap/Stempel & Redaction (P1 - High Value)
* **E-Signature (Tanda Tangan Elektronik):**
  - Pengguna dapat menggambar tanda tangan langsung di layar (mouse/layar sentuh) atau mengunggah tanda tangan berformat PNG transparan.
  - Geser dan tempelkan tanda tangan ke halaman dokumen yang dituju.
* **Cap / Stempel Cepat:**
  - Menyediakan template stempel siap pakai seperti: *LUNAS*, *DRAFT*, *CONFIDENTIAL*, *APPROVED*, lengkap dengan tanggal otomatis.
* **Sensoring / Redaction (Tutup Bagian Rahasia):**
  - Kuas/blok hitam untuk menutupi informasi sensitif (misal: NIK, nomor rekening, alamat rumah) sebelum dokumen dibagikan ke pihak luar.
* **Custom Watermark:**
  - Tambahkan teks watermark diagonal (misal: *"Hanya untuk pengajuan Bank Mandiri"*) untuk mencegah penyalahgunaan dokumen identitas.

### Modul 8: Phone-to-PC Instant Scan via QR Code (P2 - Inovasi Akses)
* **Kendala Umum:** Kamera laptop/webcam PC umumnya memiliki resolusi rendah dan sulit diarahkan ke lembaran kertas.
* **Solusi Pintar:**
  - Di layar SmartDoc PC, klik tombol *"Scan via HP"*, maka muncul sebuah QR Code unik.
  - Buka kamera ponsel dan scan QR Code tersebut (terbuka halaman web scanner ringan di HP).
  - Pengguna mengambil foto dokumen dengan kamera ponsel yang tajam.
  - Foto dan hasil pemrosesan langsung terkirim secara instan ke layar PC dan tersimpan otomatis di File Explorer SmartDoc tanpa butuh kabel data atau login akun.

### Modul 9: Tagging, Color Labels & Kunci Password PDF (P2 - Pengelolaan Lanjutan)
* **Color Labeling & Tagging:**
  - Memberi label warna pada file/folder (Merah = Penting/Urgent, Hijau = Selesai, Biru = Arsip).
  - Menambahkan tag kategori (misal: `#KTP`, `#Pajak2025`, `#Invoice`, `#Kontrak`).
* **Enkripsi / Password Protect PDF:**
  - Fitur mengunci file PDF hasil konversi/scan dengan kata sandi sebelum dibagikan ke orang lain.

---

## 5. Arsitektur Teknis & Tech Stack Rekomendasi

### 5.1 Frontend UI / Application Framework
* **Core:** Next.js (React) atau Vite + React (TypeScript).
* **Styling & Komponen:** Tailwind CSS + Radix UI / Shadcn UI (memberikan nuansa antarmuka Windows 11 Fluent Design yang modern, bersih, dan berkecepatan tinggi).
* **Icons:** Lucide React (ikon folder, PDF, image, chevron, dan kontrol explorer yang sangat presisi).

### 5.2 Pemrosesan Gambar (Magic Scanner Engine)
* **OpenCV.js (WebAssembly):**
  - Deteksi kontur lembaran kertas secara real-time.
  - Homography / Perspective Warp 4-titik.
  - Filter adaptif (Gaussian blur, adaptive thresholding, morphological color dilation untuk shadow removal).
* **HTML5 Canvas:** Untuk penyesuaian kecerahan, kontras, dan interaksi titik potong (*crop handles*).

### 5.3 Pemrosesan Dokumen & PDF Engine
* **`pdf-lib`:** Untuk manipulasi PDF (membuat PDF dari gambar, merge, split, rotasi halaman, penambahan watermark/tanda tangan, enkripsi password).
* **`pdfjs-dist` (Mozilla PDF.js):** Untuk me-render halaman PDF ke resolusi tinggi dan mengonversinya menjadi JPG.
* **`tesseract.js`:** Engine OCR berbasis WebAssembly untuk ekstraksi teks dan pembuatan Searchable PDF secara lokal di browser.

### 5.4 Penyimpanan Berkas Lokal (Local-First Persistence)
* **IndexedDB via Dexie.js / OPFS (Origin Private File System):**
  - Menyimpan pohon direktori folder virtual dan konten berkas biner (blob PDF & JPG) langsung di penyimpanan aman browser.
  - Menghindari kebutuhan server penyimpanan berbayar dan menjamin data tidak meninggalkan perangkat pengguna.

---

## 6. Kebutuhan Non-Fungsional (Non-Functional Requirements)

1. **Privasi 100% (Zero Cloud Leakage):**
   - Tidak ada pengunggahan gambar atau dokumen ke cloud. Seluruh algoritma (crop, filter, convert, OCR) dieksekusi 100% pada CPU/GPU komputer lokal melalui WebAssembly dan Web Workers.
2. **Performa & Responsivitas:**
   - Pemrosesan gambar menggunakan *Web Workers* di latar belakang agar antarmuka pengguna tidak mengalami *freeze* / lag saat memproses berkas besar.
   - Waktu render thumbnail dokumen < 300 ms.
3. **Kenyamanan Pengalaman Pengguna (UX Familiarity):**
   - Shortcut keyboard standar Windows berfungsi: `Ctrl + A` (pilih semua), `F2` (ganti nama berkas), `Delete` (hapus ke tempat sampah), `Ctrl + F` (fokus ke kolom cari).
4. **Keamanan Penghapusan:**
   - Fitur *Recycle Bin* aktif secara bawaan untuk memulihkan berkas yang tidak sengaja terhapus.

---

## 7. Rencana Tahapan Rilis (Development Roadmap)

```
[FASE 1: Fondasi Explorer & Universal Converter] (MVP)
  ├── Inisialisasi Proyek (Vite/Next.js + TypeScript + Tailwind + Shadcn)
  ├── File Explorer Windows-Style (Sidebar Folder Tree, Breadcrumb, Grid/Details View)
  ├── Local File System Engine (IndexedDB / Dexie.js)
  └── Converter PDF ↔ JPG dua arah (resolusi tinggi, multi-page)

[FASE 2: Magic Scanner & Image Enhancement] (Core Feature)
  ├── Integrasi Kamera & Upload Gambar Mentah
  ├── Auto Edge Detection & 4-Point Interactive Perspective Warp (OpenCV.js)
  ├── Filter Magic Color, B&W Clean Document, Shadow Removal
  └── Export multi-halaman ke PDF/JPG & Auto-save ke File Explorer

[FASE 3: Fitur Rekomendasi Produktivitas] (High Value Extensions)
  ├── Smart Document Compressor (Target ukuran spesifik: <300KB, <500KB)
  ├── PDF Toolkit (Merge, Split, Rotate, Delete Pages)
  ├── E-Signature, Stempel Dokumen & Sensor (Redaction)
  └── OCR Engine & Searchable PDF (Tesseract.js)

[FASE 4: Fitur Inovasi & Desktop Packaging]
  ├── Phone-to-PC Instant Scan via QR Code
  ├── Tagging & Enkripsi Password PDF
  └── Packaging Desktop App (.exe) menggunakan Tauri / Electron
```
