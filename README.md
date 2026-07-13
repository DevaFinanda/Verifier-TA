# IDentia Verifier

**IDentia Verifier** adalah komponen *Relying Party* dalam ekosistem identitas terdesentralisasi. Verifier bertugas meminta presentasi kredensial (**Verifiable Presentation / VP**) dari dompet pengguna (aplikasi IDentia), lalu memvalidasi keaslian dan integritasnya menggunakan tanda tangan digital **Ed25519** serta identitas terdesentralisasi **DID:JWK**.

Proyek ini terdiri dari dua bagian utama:

- **Backend** — layanan API (TypeScript/Node.js) yang mengelola alur OID4VP dan verifikasi tanda tangan VP.
- **Frontend** — antarmuka web (dashboard) untuk operator/petugas rumah sakit dalam meminta dan meninjau hasil verifikasi.

---

## Fitur Utama

- **Permintaan presentasi (OID4VP)** — membuat *Presentation Request* dan menampilkan QR code / deep link untuk dompet pengguna.
- **Verifikasi Verifiable Presentation** — memvalidasi tanda tangan **JWT VP/VC** menggunakan **Ed25519 (EdDSA)**.
- **Resolusi DID:JWK** — mengekstrak kunci publik dari identitas terdesentralisasi untuk verifikasi.
- **Dashboard petugas** — antarmuka web untuk memulai verifikasi dan meninjau status kredensial pasien/pengunjung.
- **Autentikasi operator** — login untuk mengakses dashboard Verifier.
- **Manajemen proses dengan PM2** — konfigurasi deployment produksi (`pm2_info.json`).

---

## Standar & Spesifikasi yang Didukung

| Standar | Keterangan |
|---|---|
| **OID4VP** | OpenID for Verifiable Presentations |
| **W3C Verifiable Credentials 1.0** | Model data kredensial yang dapat diverifikasi |
| **DID:JWK** | Metode Decentralized Identifier berbasis JSON Web Key |
| **Ed25519 (EdDSA)** | Algoritma tanda tangan digital untuk verifikasi VP/VC |
| **JWT (JWS)** | Format kontainer VP/VC yang ditandatangani |

---

## Arsitektur & Teknologi

- **Bahasa:** TypeScript (98%), dengan JavaScript & CSS pendukung
- **Runtime:** Node.js
- **Process manager:** PM2
- **Struktur:**
  - `backend/` — API dan logika verifikasi OID4VP
  - `frontend1/` — antarmuka web dashboard Verifier

### Alur Verifikasi 

```
  Dompet IDentia  ──(OID4VP: kirim VP)──▶  Verifier (backend)
                                              │
                                     1. Validasi struktur JWT VP/VC
                                     2. Resolusi DID:JWK → kunci publik
                                     3. Verifikasi tanda tangan Ed25519
                                     4. Kembalikan status verifikasi
```

---

## Prasyarat

- [Node.js](https://nodejs.org) 18.x atau lebih baru
- npm (atau pnpm/yarn)
- [PM2](https://pm2.keymetrics.io) untuk deployment produksi (opsional saat pengembangan)

---

## Instalasi & Menjalankan

1. **Klon repositori**

   ```bash
   git clone https://github.com/DevaFinanda/Verifier-TA.git
   cd Verifier-TA
   ```

2. **Pasang dependensi**

   ```bash
   npm install
   ```

3. **Jalankan untuk pengembangan**

   ```bash
   # Backend
   cd backend
   npm run dev

   # Frontend (terminal terpisah)
   cd frontend1
   npm run dev
   ```

4. **Jalankan di produksi dengan PM2**

   ```bash
   pm2 start pm2_info.json
   pm2 save
   pm2 status
   ```

---

## Konfigurasi

Sesuaikan variabel lingkungan sesuai kebutuhan. Detail lengkap tersedia pada berkas **`ENVIRONMENT_SPECIFICATION.md`**, dan diagram arsitektur pada **`DIAGRAM_INFORMATION.md`**.

Contoh konfigurasi endpoint Verifier:

```env
VERIFIER_BASE_URL=https://verifier.identia.<sub domain>
PORT=3000
```

> **Catatan keamanan:** gunakan HTTPS pada lingkungan produksi dan simpan kredensial serta kunci privat melalui variabel lingkungan, bukan langsung di dalam kode.

---

## Kredensial Login (Dashboard)

Gunakan kredensial berikut untuk masuk ke dashboard Verifier:

| Field | Nilai |
|---|---|
| **Username / Email** | `admin@rumahsakit.com` |
| **Password** | `password123` |

> **Catatan:** kredensial di atas adalah akun default untuk pengembangan/demo. **Segera ganti password** dan jangan gunakan kredensial ini di lingkungan produksi.

---

## Struktur Proyek

```
Verifier-TA/
├── backend/                     # API & logika verifikasi OID4VP (TypeScript)
├── frontend1/                   # Dashboard web Verifier
├── node_modules/                # Dependensi
├── DIAGRAM_INFORMATION.md       # Dokumentasi diagram arsitektur
├── ENVIRONMENT_SPECIFICATION.md # Spesifikasi variabel lingkungan
├── package.json                 # Definisi skrip & dependensi
├── package-lock.json
├── pm2_info.json                # Konfigurasi proses PM2
└── README.md
```

---
