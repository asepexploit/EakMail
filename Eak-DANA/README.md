# Eak-DANA

APK Android untuk mendeteksi notifikasi transaksi masuk DANA secara otomatis dan meneruskannya ke **EakMail Backend** di VPS.

---

## Cara Kerja

```
Notifikasi DANA masuk di HP
       ↓
DanaNotificationListener (NotificationListenerService)
       ↓ parse amount + description
DanaEventEntity → Room DB (antrian lokal)
       ↓
EventSyncWorker (WorkManager) → POST /api/payments/dana/event
       ↓
EakMail Backend → validasi order → PAID / REVIEW
```

---

## Build APK

**Prasyarat:**
- Android Studio Ladybug (2024.2.1) atau lebih baru
- JDK 17
- Android SDK 34

**Langkah:**
```bash
# Clone repo EakMail
cd eakmail/Eak-DANA

# Build debug APK
./gradlew assembleDebug

# APK output: app/build/outputs/apk/debug/app-debug.apk
```

**Install ke HP:**
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## Konfigurasi Awal di HP

### 1. Berikan Akses Notifikasi

Ini langkah **wajib** dan harus dilakukan manual oleh pengguna:

1. Buka aplikasi **Eak-DANA**
2. Tap tombol **"Berikan Akses Notifikasi"**
3. Di halaman Settings Android, cari **"Eak-DANA"** dan aktifkan toggle-nya
4. Kembali ke aplikasi — status akan berubah menjadi **"Aktif"**

> ⚠️ Tanpa izin ini, aplikasi tidak akan mendeteksi notifikasi DANA apapun.

### 2. Dapatkan Device Token dari EakMail Dashboard

Di EakMail Backend:
```bash
# Via API (dari server VPS)
curl -X POST https://vps-anda.com/api/payments/dana/devices/register \
  -H "Content-Type: application/json" \
  -d '{"label": "HP Saya - Xiaomi 13"}'
```

Response:
```json
{
  "deviceId": "clxxxxx...",
  "token": "abcdef1234..."
}
```

> Simpan `token` dan `deviceId` — token hanya ditampilkan **sekali**.

### 3. Isi Pengaturan di Aplikasi

Buka **Pengaturan** di aplikasi:
- **URL Backend**: `https://vps-anda.com` (tanpa trailing slash)
- **Device Token**: token dari langkah 2
- **Device ID**: deviceId dari langkah 2
- **Timeout**: 15 detik (default)

Tap **"Simpan Pengaturan"**, lalu tap **"Tes Koneksi"** di dashboard.

---

## Integrasi EakMail Backend

### Endpoint yang tersedia

| Method | Path | Keterangan |
|---|---|---|
| `POST` | `/api/payments/dana/event` | Kirim event notifikasi DANA |
| `GET` | `/api/payments/dana/status` | Status device hari ini |
| `GET` | `/api/payments/dana/events` | List event (dashboard) |
| `POST` | `/api/payments/dana/devices/register` | Daftarkan device baru |
| `GET` | `/api/payments/dana/devices` | List semua device |
| `POST` | `/api/payments/dana/devices/revoke` | Cabut akses device |

### Jalankan Migration Database

Di VPS EakMail:
```bash
cd EakMail-backend
npx prisma migrate deploy
# atau manual:
psql -U eakmail -d eakmail -f prisma/migrations/20261021000000_add_dana_integration/migration.sql
```

---

## Logika Pencocokan Order

Backend **tidak langsung** menganggap notifikasi DANA sebagai pembayaran sah. Alurnya:

1. APK kirim event dengan `parsed_amount` (mis. 50000)
2. Backend cari order `PENDING` dengan `amount ≈ 50000` yang dibuat dalam 24 jam terakhir
3. Jika cocok → order jadi `PAID`, fulfillment di-enqueue
4. Jika tidak cocok → `eventStatus = NO_MATCH`, disimpan untuk review manual di dashboard

**Status response:**
- `ACCEPTED` — cocok dengan order, fulfillment berjalan
- `NO_MATCH` — tidak ada order yang cocok
- `DUPLICATE` — notifikasi ini sudah pernah dikirim sebelumnya

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Notifikasi tidak terdeteksi | Pastikan Notification Access sudah diizinkan |
| Status VPS: Error | Cek URL backend, pastikan HTTPS aktif |
| HTTP 401 | Token salah atau device sudah di-revoke |
| Antrian terus bertambah | Cek koneksi internet HP dan status VPS |
| `NO_MATCH` terus | Cek nominal order di EakMail, pastikan cocok persis |

---

## Keterbatasan yang Diketahui

1. **Format notifikasi DANA bisa berubah** — parser defensif tapi tidak dijamin 100% akurat untuk semua versi DANA.
2. **Bukan bukti pembayaran final** — backend harus selalu validasi, tidak boleh langsung percaya nominal dari APK.
3. **Satu HP satu device token** — tidak ada multi-account DANA di satu device.
4. **Pencocokan by amount saja** — jika ada dua order dengan nominal sama dalam 24 jam, order terbaru yang diprioritaskan. Lebih aman gunakan nominal order yang unik.
