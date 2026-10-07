# EakTele — Desain & Blueprint

> Bot Telegram khusus jual-beli akun Telegram. Berjalan dalam sistem EakMail
> (backend yang sama), token bot terpisah, folder kode terpisah.
>
> **Status:** Desain awal — belum diimplementasi.

---

## 1. Konsep

EakTele adalah **toko akun Telegram berbasis bot** — pelanggan membeli akun
Telegram langsung di bot tanpa perlu website. Setelah beli, pelanggan mendapat
nomor + password 2FA, dan bisa minta OTP kapanpun langsung dari bot (sistem
konek ke akun itu via GramJS dan baca pesan OTP terbaru).

Perbedaan dari EakMail Storefront Bot:

| | EakMail Storefront | EakTele |
|---|---|---|
| Produk | Digital goods umum (voucher, dll) | Khusus akun Telegram |
| Delivery | Teks/kode dari stok | Nomor + 2FA + live OTP |
| Bot token | `STOREFRONT_BOT_TOKEN` | `EAKTELE_BOT_TOKEN` |
| Kode | `telegram/bot/` | `telegram/eaktele/` |

---

## 2. Flow Pelanggan

```
/start
│
├─── Belum join @eaktele → 🔒 Akses Terbatas (force join gate)
│
└─── Sudah join → Menu Utama
      │
      ├── 📱 Beli Akun
      │     └── Pilih paket (misal: "Akun +62 — 1 akun")
      │           └── Konfirmasi order + harga
      │                 └── Pilih bayar: [💰 Saldo] [📷 QRIS]
      │                       └── ✅ Berhasil
      │                             └── Tampil detail akun (nomor, 2FA)
      │                                   ├── [📲 Get OTP]
      │                                   └── [📖 Panduan Logout]
      │
      ├── 📋 Pesanan Saya
      │     └── Daftar pesanan aktif
      │           └── Pilih satu → Detail akun
      │                 ├── [📲 Get OTP]
      │                 └── [📖 Panduan Logout]
      │
      ├── 💰 Saldo & Top Up
      │     └── Lihat saldo + tombol top up (sama seperti EakMail)
      │
      └── 💬 Bantuan / CS
```

---

## 3. Tampilan Pesan Bot

### 3.1 Menu Utama

```
👋 Selamat datang di EakTele!

Toko akun Telegram terpercaya — beli, login,
dan dapatkan OTP langsung di sini.

Pilih menu:

[📱 Beli Akun]
[📋 Pesanan Saya]
[💰 Saldo]
[💬 Bantuan]
```

---

### 3.2 Pilih Paket

```
📱 Pilih Paket Akun Telegram

┌─────────────────────────────┐
│ 🇮🇩 Akun +62 Indonesia       │
│ Rp 25.000 / akun            │
│ Stok: 8 tersedia            │
└─────────────────────────────┘

[🛒 Beli 1 Akun — Rp 25.000]
[⬅️ Kembali]
```

---

### 3.3 Konfirmasi Order

```
🛒 Konfirmasi Pesanan

Produk : Akun +62 Indonesia
Jumlah : 1 akun
Total  : Rp 25.000
Saldo  : Rp 50.000

Pilih metode bayar:

[💰 Bayar dengan Saldo]
[📷 Bayar via QRIS]
[❌ Batal]
```

---

### 3.4 Detail Akun (setelah bayar)

```
✅ Pembelian Berhasil!

━━━━━━━━━━━━━━━━━━━━━
📋 DETAIL AKUN TELEGRAM
━━━━━━━━━━━━━━━━━━━━━
📞 Nomor   : +6281326345167
🔐 2FA/Pass: 7777

━━━━━━━━━━━━━━━━━━━━━
⚠️  PENTING — Baca sebelum login:
Setelah berhasil masuk di device kamu,
wajib klik Logout Session Web agar
sesi lama terhapus dan akun aman.
━━━━━━━━━━━━━━━━━━━━━

Order ID: #TL-20261007-0042

[📲 Get OTP]   [📖 Panduan Logout]
```

---

### 3.5 Get OTP

```
📲 Kode OTP — +6281326345167

┌─────────────────────┐
│      1 2 3 4 5 6    │
└─────────────────────┘

⏱ Dikirim: 2 menit lalu
📩 Dari: +62811000000 (Telegram)

[🔄 Refresh OTP]   [⬅️ Kembali]
```

Jika tidak ada OTP baru:
```
⏳ Belum ada OTP masuk.

Coba login dulu ke akun Telegram-nya,
lalu tekan Refresh setelah kode dikirim.

[🔄 Refresh OTP]
```

---

### 3.6 Panduan Logout Session Web

```
📖 Cara Logout Session Web

1. Buka Telegram di HP
2. Masuk ke Settings → Privacy & Security
3. Pilih Active Sessions
4. Cari sesi "Web" atau sesi asing
5. Tap sesi tersebut → Terminate

✅ Setelah logout, akun aman dipakai.

[⬅️ Kembali ke Detail Akun]
```

---

### 3.7 Pesanan Saya

```
📋 Pesanan Aktif Kamu

1. #TL-20261007-0042
   +6281326345167 · Dibeli: 7 Okt 2026

2. #TL-20261006-0018
   +6285720209158 · Dibeli: 6 Okt 2026

Pilih nomor pesanan untuk lihat detail.

[1️⃣ Pesanan #42]  [2️⃣ Pesanan #18]
[⬅️ Menu Utama]
```

---

## 4. Model Data (DB)

### 4.1 Tabel `TelegramAccountStock`

Stok akun yang dikelola admin. Setiap baris = satu akun Telegram.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | Primary key |
| `productId` | uuid | FK ke `Product` (paket/kategori akun) |
| `phone` | string | Nomor HP akun (e.g. `+6281326345167`) |
| `password2faEnc` | string? | Password 2FA, terenkripsi. Null jika tidak ada 2FA |
| `sessionEnc` | string? | GramJS session string, terenkripsi. Null jika belum login |
| `apiId` | int? | Telegram API ID khusus akun ini (opsional, fallback ke global) |
| `apiHashEnc` | string? | Telegram API Hash khusus akun ini, terenkripsi (opsional) |
| `status` | enum | Lihat §4.2 di bawah |
| `isSessionActive` | bool | Session masih valid / belum expired (cek berkala) |
| `isLoggedOutByBuyer` | bool | Pembeli sudah logout session web (self-report) |
| `orderId` | uuid? | FK ke `Order` saat sudah terjual. Null jika belum terjual |
| `soldAt` | datetime? | Waktu terjual |
| `lastOtpRequestAt` | datetime? | Terakhir kali pelanggan klik Get OTP |
| `otpRequestCount` | int | Berapa kali OTP sudah diminta (untuk audit) |
| `notes` | string? | Catatan admin (misal: "akun lama", "sudah ganti HP") |
| `createdAt` | datetime | Waktu stok ditambahkan |
| `updatedAt` | datetime | |

### 4.2 Status Akun (`TelegramAccountStatus`)

| Status | Artinya |
|---|---|
| `AVAILABLE` | Siap dijual, session aktif |
| `RESERVED` | Sedang dalam proses checkout (lock sementara) |
| `SOLD` | Sudah terjual, dipegang pembeli |
| `INVALID` | Session expired / akun diban / tidak bisa konek |
| `NO_SESSION` | Akun ditambahkan tapi belum ada session string (perlu login dulu) |

Status `INVALID` di-set otomatis saat GramJS gagal connect saat Get OTP.
Status `NO_SESSION` di-set saat admin add akun via mode paste/bulk tanpa session.

### 4.3 Tabel `Order` (extend yang sudah ada)

Tidak perlu tabel baru — pakai tabel `Order` yang sudah ada di EakMail.
Field `deliveryData` (JSON) berisi: `{ stockId, phone, password2fa }`.

### 4.4 Relasi

```
Product (paket akun, e.g. "Akun +62 Indonesia")
  └── TelegramAccountStock[] (stok akun individual)
        └── Order (saat terjual, stockId di-lock ke orderId)
```

### 4.5 View Dashboard Stok

Dashboard menampilkan filter dan kolom berdasarkan tabel ini:

```
Filter: [Semua ▾] [Tersedia] [Terjual] [Invalid] [Belum Login]

┌──────────────────┬──────────┬──────────┬───────────┬──────────┬───────────┬─────────┐
│ Nomor            │ Paket    │ Status   │ Session   │ Logout?  │ OTP Req   │ Aksi    │
├──────────────────┼──────────┼──────────┼───────────┼──────────┼───────────┼─────────┤
│ +6281326345167   │ +62 ID   │ SOLD     │ ✅ Aktif  │ ✅ Ya    │ 3x        │ Detail  │
│ +628988063246    │ +62 ID   │ AVAILABLE│ ✅ Aktif  │ -        │ -         │ Detail  │
│ +6283110711954   │ +62 ID   │ INVALID  │ ❌ Mati   │ -        │ 1x        │ Detail  │
│ +6285720209158   │ +62 ID   │ NO_SESSION│ ⏳ Belum  │ -        │ -        │ Login   │
└──────────────────┴──────────┴──────────┴───────────┴──────────┴───────────┴─────────┘
```

Tombol aksi per baris:
- **Detail** → popup: info lengkap, riwayat OTP, order terkait
- **Login** → mulai flow OTP untuk akun `NO_SESSION`
- **Hapus** → soft-delete (set status `INVALID`, bukan delete fisik)
- **Cek Session** → trigger GramJS connect test, update `isSessionActive`

---

## 5. Cara Admin Tambah Stok Akun

Ada **dua cara** add stok — keduanya tersedia di dashboard EakMail:

### 5.1 Login Langsung (Direkomendasikan)

Admin cukup masukkan nomor HP, sistem yang urus login dan simpan session.
Proses ini reuse `LoginFlow` yang sudah ada di sistem promosi akun.

```
Dashboard → EakTele → Stok Akun → + Tambah Akun
        │
        ▼
Input: Nomor HP + 2FA password (kalau ada)
        │
        ▼
Sistem kirim permintaan login ke Telegram
        │
        ▼
Telegram kirim OTP ke nomor itu (dari 42777)
        │
        ▼
Admin masukkan kode OTP di dashboard
        │
        ▼
Sistem simpan session string (terenkripsi di DB)
✅ Akun siap dijual
```

Form di dashboard:
```
┌─────────────────────────────────────────┐
│ Tambah Akun Telegram ke Stok            │
│                                         │
│ Nomor HP    : +6281326345167            │
│ 2FA / Pass  : 7777  (kosongkan jika X) │
│ Paket / Produk: [Akun +62 Indonesia ▾] │
│                                         │
│         [Kirim OTP]                     │
└─────────────────────────────────────────┘

→ Setelah klik Kirim OTP:

┌─────────────────────────────────────────┐
│ Masukkan kode OTP yang diterima         │
│ nomor +6281326345167                    │
│                                         │
│ Kode OTP  : [______]                   │
│                                         │
│    [✅ Verifikasi & Simpan]             │
└─────────────────────────────────────────┘
```

### 5.2 Paste Session String (Advanced)

Untuk admin yang sudah punya session string dari tools lain
(Telethon, GramJS script, dll):

```
┌─────────────────────────────────────────┐
│ Import Session String                   │
│                                         │
│ Nomor HP    : +6281326345167            │
│ 2FA / Pass  : 7777                      │
│ Session     : [paste string panjang...] │
│ Paket       : [Akun +62 Indonesia ▾]   │
│                                         │
│         [✅ Simpan Akun]               │
└─────────────────────────────────────────┘
```

### 5.3 Upload Massal (Bulk)

Untuk add banyak akun sekaligus — format per baris:
`nomor|2fa|session_string`

```
+6281326345167|7777|1BVtsOHABu2...
+628988063246|1234|1BVtsOHABu3...
+6283110711954|0000|1BVtsOHABu4...
```

Upload lewat textarea di dashboard → sistem proses satu per satu,
tampilkan hasil (berhasil/gagal per baris).

---

## 6. Fitur Get OTP — Cara Kerja

OTP Telegram selalu dikirim oleh **sender 42777** (nomor resmi Telegram).
Sistem baca pesan terbaru dari chat itu dan extract kode-nya.

```
Pelanggan tekan [📲 Get OTP]
        │
        ▼
Bot ambil sessionEnc dari TelegramAccountStock (DB)
        │
        ▼
GramJS connect ke akun itu pakai session string
        │
        ▼
Ambil pesan terbaru dari chat dengan 42777
(Telegram Service Notifications)
        │
        ▼
Extract kode OTP dengan regex: \b\d{5,6}\b
        │
        ▼
Kirim ke pelanggan:
"Kode: 123456 · Dikirim: 2 menit lalu"
        │
        ▼
GramJS disconnect
```

**Contoh pesan dari 42777:**
```
Login code: 12345. Do not share this code.
```
→ regex extract → `12345`

**Jika tidak ada OTP baru (belum login):**
```
⏳ Belum ada OTP masuk.
Coba login dulu ke akunnya,
lalu tekan Refresh setelah kode dikirim.
[🔄 Refresh OTP]
```

**Jika session tidak valid / expired:**
```
❌ Sesi akun tidak aktif.
Hubungi CS untuk bantuan.
[💬 Hubungi CS]
```

---

## 7. Dashboard Admin (EakMail)

Halaman baru di dashboard EakMail: **Stok Akun EakTele**

- Tambah akun: form login langsung (nomor HP → OTP → simpan session)
- Import session string manual (advanced)
- Upload massal CSV: `nomor|2fa|session_string`
- Lihat stok tersedia / terjual / bermasalah
- Export daftar akun terjual + order ID
- Hapus stok yang bermasalah

---

## 8. Arsitektur Kode

Mengikuti struktur EakMail yang sudah ada:

```
EakMail-backend/
└── src/
    ├── telegram/
    │   ├── bot/              ← EakMail Storefront Bot (sudah ada)
    │   └── eaktele/          ← EakTele Bot (baru)
    │       ├── index.ts      ← buildEakTeleBot() + registerHandlers()
    │       ├── keyboards.ts  ← inline keyboard builders
    │       ├── handlers/
    │       │   ├── start.ts         ← /start, menu utama
    │       │   ├── catalog.ts       ← pilih paket akun, lihat stok
    │       │   ├── order.ts         ← beli + bayar (saldo/QRIS)
    │       │   ├── otp.ts           ← Get OTP, Refresh OTP
    │       │   ├── orders-list.ts   ← Pesanan Saya
    │       │   └── membership.ts    ← force join gate (adaptasi dari bot/)
    │       └── i18n/
    │           └── strings.ts  ← semua copy bahasa Indonesia EakTele
    │
    └── modules/
        └── eaktele/            ← business logic EakTele
            ├── stock.repository.ts   ← CRUD TelegramAccountStock + filter/status
            ├── stock.service.ts      ← assign stok ke order, validasi, cek ketersediaan
            ├── stock-login.service.ts ← flow OTP login untuk tambah stok (reuse LoginFlow)
            └── otp.service.ts        ← GramJS connect → baca 42777 → extract kode
                                         (pakai EAKTELE_API_ID/HASH, fallback ke global)
```

---

## 9. Env Variables Baru

```env
# Bot token EakTele (wajib)
EAKTELE_BOT_TOKEN=

# Force join channel sebelum bisa pakai bot (opsional, kosong = nonaktif)
EAKTELE_REQUIRED_JOIN=@eaktele

# Telegram API credentials KHUSUS EakTele (untuk GramJS OTP reader)
# Beda dari TELEGRAM_API_ID/HASH yang dipakai promosi akun EakMail.
# Kalau tidak diset, fallback ke TELEGRAM_API_ID / TELEGRAM_API_HASH.
EAKTELE_API_ID=
EAKTELE_API_HASH=
```

**Kenapa API credentials terpisah:**
- Akun stok EakTele akan sering di-connect untuk baca OTP → volume tinggi
- Pisah credentials menghindari rate-limit/ban yang mempengaruhi sistem promosi EakMail
- Bisa pakai Telegram app registration sendiri untuk EakTele jika diperlukan

---

## 10. Fase Implementasi

| Fase | Yang dibangun |
|---|---|
| **1** | Skema DB `TelegramAccountStock`, migrasi Prisma |
| **2** | `stock.repository.ts` + `stock.service.ts` |
| **3** | Bot EakTele dasar: `/start`, menu, force join gate |
| **4** | Flow beli akun: pilih paket → bayar (saldo/QRIS) → dapat detail |
| **5** | `otp.service.ts` (GramJS reader) + handler Get OTP |
| **6** | Dashboard upload stok akun di EakMail frontend |
| **7** | Halaman Pesanan Saya di bot |

---

## 11. Yang Dibagi dengan EakMail (Reuse)

**Shared (pakai langsung):**

- Tabel `Customer`, `Order`, `Product`, `Payment` → pakai yang sama
- Sistem saldo + top up → sama persis
- Pakasir (QRIS) → sama
- Enkripsi/dekripsi secret (`encrypt` / `decrypt` dari `lib/crypto`) → sama
- Logger, config loader, DB client (Prisma) → sama
- `LoginFlow` dari `promotion-account.service.ts` → reuse untuk add stok

**Dikopi / diadaptasi:**

- Force join middleware → adaptasi dari `membership.handler.ts`
- GramJS connect pattern → adaptasi dari `session-manager/` (connect, invoke, disconnect)

**Tidak dibagi (terpisah penuh):**

- Bot token → `EAKTELE_BOT_TOKEN` (bukan `STOREFRONT_BOT_TOKEN`)
- Telegram API credentials → `EAKTELE_API_ID` / `EAKTELE_API_HASH` (fallback ke global)
- Tabel stok → `TelegramAccountStock` (baru, khusus EakTele)
- Kode bot → `telegram/eaktele/` (bukan `telegram/bot/`)
- Business logic → `modules/eaktele/` (bukan modules EakMail)

---

*Last updated: Oktober 2026*
