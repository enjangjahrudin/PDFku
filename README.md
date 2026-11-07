# 📄 PDFku – Intelligent Document Scanner, Converter & Explorer

Aplikasi cerdas dan modern untuk memindai dokumen dengan filter ala CamScanner (*Ajaib Pro*), deteksi sudut kertas otomatis, konversi PDF ↔ JPG dua arah, kompresor PDF, dan pengelolaan arsip berkas dengan tampilan Windows 11 File Explorer.

Seluruh pemrosesan berjalan **100% Client-Side** (Offline-First di browser), sehingga dokumen sensitif dan rahasia tidak pernah dikirim ke server pihak ketiga mana pun.

---

## 🚀 Fitur Unggulan

### 1. 🪄 CamScanner-Style Mobile Scanner
- **Live Camera & Mobile Friendly:** Dirancang khusus responsif untuk perangkat ponsel (HP) dan desktop.
- **Deteksi Kertas Presisi Otomatis:** Algoritma edge-detection dan Theil-Sen line fitting mendeteksi batas kertas otomatis tanpa perlu geser manual.
- **Kaca Pembesar (Magnifier Loupe):** Memperbesar sudut hingga 2.5x saat menyeret handle untuk akurasi tingkat piksel.
- **8-Titik Kontrol:** 4 sudut dan 4 sisi untuk penyesuaian fleksibel.
- **Magic Filter & Ajaib Pro:**
  - **Ajaib Pro ✨:** Algoritma 2D Illumination White-point Grid yang meratakan pencahayaan, membersihkan noda/bayangan, dan memutihkan latar kertas sambil menjaga ketajaman teks hitam dan warna stempel.
  - **Cerapkan & Mempertajam:** Pilihan kontras tinggi.
  - **B&W / Clean Document:** Menghasilkan dokumen hitam-putih murni layaknya fotokopi resmi.
- **Multi-Halaman & Alur Cepat:** Mode satu halaman atau tambah banyak lembar halaman berturut-turut.
- **Simpan Fleksibel:** Ekspor langsung ke format PDF multi-halaman atau berkas gambar JPG/ZIP ke File Explorer lokal.

### 2. 🔄 Universal Converter (PDF ↔ JPG)
- **PDF to JPG:** Konversi setiap halaman dokumen PDF ke gambar JPG tajam (pilihan 150 DPI standar atau 300 DPI kualitas tinggi). Dilengkapi pratinjau thumbnail per halaman, unduhan arsip ZIP, dan simpan ke folder.
- **JPG to PDF:** Menggabungkan banyak gambar JPG/PNG menjadi satu file PDF rapi dengan opsi orientasi, margin, dan ukuran kertas (A4, F4, Letter).

### 3. 📁 Windows 11-Style File Explorer
- **Navigasi Lengkap:** Akses Cepat (*Recent, Starred, Tempat Sampah/Recycle Bin*) dan hierarki folder (*Hasil Scan, Hasil Konversi, Dokumen Saya, Arsip Dokumen*).
- **Ribbon Toolbar & Context Menu:** Folder Baru, Upload, Rename, Beri Tag Warna, Unduh, dan Hapus.
- **Tampilan Grid & List:** Pratinjau thumbnail nyata dari halaman pertama PDF/JPG.
- **Pencarian Cepat:** Mencari nama berkas dan isi teks OCR secara instan.

### 4. 🧰 PDF Productivity Toolkit
- **Smart PDF Compressor:** Perkecil ukuran dokumen PDF untuk kebutuhan pendaftaran (CPNS, beasiswa, portal kementerian) dengan target ukuran spesifik (< 300 KB, < 500 KB, < 1 MB).
- **Merge & Split PDF:** Gabungkan beberapa file PDF atau pisahkan halaman tertentu dengan mudah.
- **OCR Text Reader:** Ekstraksi teks dari gambar dan dokumen menggunakan engine Tesseract.js langsung di browser.

---

## 🛠️ Panduan Pengembangan Lokal

Pastikan Node.js (v18+) telah terpasang.

```bash
# 1. Pasang dependensi
npm install

# 2. Jalankan development server
npm run dev

# 3. Bangun paket produksi
npm run build
```

---

## 🌐 Panduan Deploy ke VPS Menggunakan aaPanel

Karena **PDFku** adalah aplikasi web modern berbasis *Single Page Application* (SPA) dengan pemrosesan 100% di browser pengguna (*client-side*), cara deploy yang paling cepat, hemat RAM, dan efisien di aaPanel adalah menjadikannya **Static Website via Nginx**.

### Langkah 1: Build Proyek
Di komputer lokal atau di terminal server, jalankan:
```bash
npm run build
```
Folder `dist/` akan otomatis terbuat dan berisi semua file web produksi yang siap disajikan.

---

### Langkah 2: Tambah Website di aaPanel
1. Buka dashboard **aaPanel** Anda (`https://IP-VPS:8888`).
2. Masuk ke menu **Website** > Klik tombol **Add site**.
3. Isi kolom:
   - **Domain name**: Masukkan domain atau subdomain Anda (misal: `pdfku.namadomain.com` atau alamat IP).
   - **Description**: `PDFku Web Scanner & Toolkit`.
   - **Root directory**: `/www/wwwroot/pdfku` (otomatis terisi).
   - **FTP & Database**: Biarkan `No` (karena database PDFku berjalan di browser IndexedDB pengguna, tidak membutuhkan database server).
   - **PHP version**: Pilih `pure static` (karena PDFku murni HTML, CSS, JS).
4. Klik **Submit**.

---

### Langkah 3: Upload File Build ke aaPanel
Ada dua cara mudah:

#### Opsi A: Melalui Menu Files aaPanel (Paling Mudah)
1. Di komputer lokal, compress folder `dist` menjadi `dist.zip` (atau arsipkan seluruh isi di dalam folder `dist`).
2. Di dashboard aaPanel, klik menu **Files** lalu navigasi ke folder root website Anda: `/www/wwwroot/pdfku`.
3. Klik tombol **Upload**, pilih file zip tersebut, lalu ekstrak (*Unzip*) sehingga file `index.html` dan folder `assets/` berada langsung di dalam `/www/wwwroot/pdfku/`.

#### Opsi B: Menggunakan Git Clone & Build Otomatis di Server
1. Masuk ke terminal VPS via SSH atau Web Terminal aaPanel:
   ```bash
   cd /www/wwwroot
   git clone https://github.com/enjangjahrudin/PDFku.git pdfku
   cd pdfku
   npm install
   npm run build
   ```
2. Arahkan *Run directory* website di aaPanel ke folder `/dist`.

---

### Langkah 4: Konfigurasi Nginx (Penting untuk SPA)
Agar rute URL tidak 404 saat di-refresh:
1. Di aaPanel, masuk ke menu **Website**, klik nama situs Anda.
2. Pilih tab **URL rewrite**.
3. Tambahkan aturan berikut atau pilih template `try_files`:
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```
4. Klik **Save**.

---

### Langkah 5: Pasang SSL (HTTPS) – WAJIB untuk Kamera HP!
> ⚠️ **PENTING:** Browser ponsel (Chrome/Safari) **hanya mengizinkan akses kamera dan lampu flash (torch)** jika website berjalan di protokol aman **HTTPS** (`https://`).

1. Pada pengaturan website di aaPanel, klik tab **SSL**.
2. Pilih tab **Let's Encrypt**.
3. Centang domain Anda, lalu klik tombol **Apply**.
4. Aktifkan sakelar **Force HTTPS** agar semua koneksi otomatis dialihkan ke HTTPS.
5. Buka `https://domain-anda.com` di browser HP Anda dan izinkan akses kamera untuk menikmati fitur Magic Scanner!

---

## 📜 Lisensi
Dilisensikan di bawah MIT License.
