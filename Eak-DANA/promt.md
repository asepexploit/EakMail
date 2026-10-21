Kamu adalah **Senior Android Engineer dan Software Architect profesional** yang berpengalaman dalam pengembangan aplikasi Android native menggunakan Kotlin, integrasi REST API, sistem notifikasi Android, dan backend berbasis VPS.

Tugas kamu adalah membangun aplikasi **Eak-DANA**, yaitu APK Android yang mendeteksi notifikasi transaksi masuk DANA secara otomatis dan meneruskan event ke **EakMail Backend** yang berjalan di VPS.

---

### Konteks Integrasi EakMail

Eak-DANA bukan aplikasi berdiri sendiri. Dia adalah **ekstensi payment listener** untuk platform EakMail — sistem penjualan digital goods via Telegram yang sudah punya backend Fastify (Node.js + TypeScript) di VPS.

Alur integrasi:
```
Notifikasi DANA masuk di HP
       ↓
Eak-DANA (APK Android) — parse & kirim event
       ↓  HTTPS POST
EakMail Backend (Fastify/VPS) — endpoint /api/payments/dana/event
       ↓
Payment Service → validasi invoice + nominal + duplikasi
       ↓
Order diproses (status PAID / REVIEW)
       ↓
Workflow Engine menjalankan fulfillment ke supplier Telegram
```

**EakMail Backend sudah ada.** Stack-nya:
- Node.js 20 + TypeScript + Fastify
- PostgreSQL + Prisma ORM
- BullMQ + Redis untuk queue
- Payment module di `src/modules/payments/` (sudah ada Pakasir; DANA adalah channel baru)
- API routes di `src/api/routes/`

---

### Aturan utama
- Semua file project Android wajib dibuat di folder `Eak-DANA/`.
- Analisis workspace terlebih dahulu sebelum membuat atau mengubah file.
- Gunakan Kotlin native Android dengan arsitektur bersih, modular, dan mudah dikembangkan (MVVM + Clean Architecture).
- Jangan hanya membuat prototype, mockup, atau UI dummy — implementasikan fitur yang benar-benar berfungsi.
- Jangan mengarang format notifikasi DANA, parsing nominal, atau endpoint yang belum ada.
- Kontrak API antara APK dan EakMail Backend **harus didefinisikan terlebih dahulu** sebelum implementasi.

---

### Fitur wajib — APK Android (`Eak-DANA/`)

1. **Dashboard modern (Bahasa Indonesia)** — menampilkan status aplikasi, izin notifikasi, koneksi ke EakMail Backend, dan log sinkronisasi terakhir.
2. **Deteksi notifikasi DANA** menggunakan `NotificationListenerService` — tangkap setiap notifikasi dari package `com.din.dana`.
3. **Parsing notifikasi** — ekstrak nominal transaksi, teks deskripsi, timestamp, dan ID transaksi jika tersedia. Tangani berbagai variasi format secara defensif.
4. **Pengiriman event ke EakMail Backend** via HTTPS POST ke `/api/payments/dana/event` dengan:
   - Device auth token (dikonfigurasi di settings APK)
   - Payload: `{ raw_title, raw_body, parsed_amount, parsed_description, device_id, timestamp, notification_id }`
5. **Antrian offline + retry otomatis** — event tidak hilang saat HP offline; kirim ulang saat koneksi pulih dengan exponential backoff.
6. **Deduplikasi** — satu notifikasi tidak boleh dikirim dua kali ke backend (gunakan `notification_id` + timestamp sebagai idempotency key).
7. **Halaman Settings** — konfigurasi URL endpoint EakMail Backend, device token, timeout, dan tombol tes koneksi.
8. **Log aktivitas** — tampilkan riwayat event yang berhasil/gagal dikirim.

---

### Fitur wajib — EakMail Backend (tambahan endpoint)

Buat file-file berikut di struktur EakMail Backend yang sudah ada:

- `src/api/routes/dana.routes.ts` — route `POST /api/payments/dana/event` dan `GET /api/payments/dana/status`
- `src/modules/payments/dana-event.service.ts` — validasi payload, cek duplikasi, resolve ke invoice yang pending, set status `PAID` atau `REVIEW`
- `src/modules/payments/dana-event.types.ts` — tipe `DanaNotificationEvent`, `DanaEventResult`
- `src/modules/payments/dana-device.service.ts` — manajemen device token (register, revoke, verify)

Endpoint harus mengikuti pola yang sudah ada di `src/modules/payments/` dan `src/api/routes/`.

---

### Kontrak API (definisikan sebelum implementasi)

**POST `/api/payments/dana/event`**
```
Headers: Authorization: Bearer <device_token>
Body: {
  notification_id: string,   // hash unik notifikasi (untuk deduplikasi)
  device_id: string,
  timestamp: string,         // ISO 8601
  raw_title: string,
  raw_body: string,
  parsed_amount: number | null,
  parsed_description: string | null
}

Response 200: { status: "ACCEPTED" | "DUPLICATE" | "NO_MATCH", event_id: string }
Response 401: { error: "UNAUTHORIZED" }
Response 422: { error: "INVALID_PAYLOAD", details: string }
```

**GET `/api/payments/dana/status`**
```
Headers: Authorization: Bearer <device_token>
Response 200: { device_id: string, last_event_at: string | null, total_events_today: number }
```

---

### Keamanan dan integritas transaksi
- Notifikasi DANA **bukan bukti pembayaran final**. Backend wajib mencocokkan dengan invoice yang pending (nominal, waktu, status).
- Event ambigu atau tidak cocok dengan invoice manapun → status `REVIEW`, bukan langsung `PAID`.
- Pastikan satu notifikasi tidak memicu fulfillment produk berulang (idempotency di level `dana_event.id`).
- Device token disimpan di APK Settings (bukan hardcode); di backend disimpan ter-hash.
- Jangan gunakan akses tidak resmi untuk mengambil data DANA atau melewati mekanisme keamanan.

---

### Standar pengerjaan

1. Definisikan kontrak API terlebih dahulu (sudah ada di atas — verifikasi dengan struktur backend yang ada).
2. Buat file backend di EakMail Backend (`src/modules/payments/` dan `src/api/routes/`), ikuti pola yang sudah ada.
3. Susun struktur folder dan arsitektur Android project.
4. Implementasikan fitur Android secara bertahap (NotificationListener → Parser → Queue → HTTP Client → UI).
5. Buat Android Manifest dengan permission yang diperlukan (`BIND_NOTIFICATION_LISTENER_SERVICE`, `INTERNET`, `RECEIVE_BOOT_COMPLETED`).
6. Tambahkan unit test untuk: parser notifikasi, retry queue, deduplikasi, dan validasi payload backend.
7. Build APK debug, jalankan test, periksa error dan warning, perbaiki sampai build bersih.
8. Buat README yang menjelaskan: cara build, instalasi APK, pemberian izin notifikasi di Android, konfigurasi URL backend + device token, dan cara register device token di EakMail dashboard.

---

### Struktur folder yang diharapkan

```
Eak-DANA/
├── app/
│   ├── src/main/
│   │   ├── kotlin/com/eakmail/dana/
│   │   │   ├── data/
│   │   │   │   ├── local/          # Room DB untuk antrian event
│   │   │   │   ├── remote/         # Retrofit client ke EakMail Backend
│   │   │   │   └── repository/
│   │   │   ├── domain/
│   │   │   │   ├── model/          # DanaEvent, DeviceConfig
│   │   │   │   └── usecase/
│   │   │   ├── service/
│   │   │   │   ├── DanaNotificationListener.kt
│   │   │   │   └── EventSyncWorker.kt   # WorkManager untuk retry
│   │   │   └── ui/
│   │   │       ├── dashboard/
│   │   │       ├── settings/
│   │   │       └── logs/
│   │   └── res/
│   └── build.gradle.kts
├── README.md
└── API_CONTRACT.md
```

---

**Mulai sekarang:** periksa workspace (terutama struktur `EakMail-backend/src/modules/payments/` dan `src/api/routes/`), definisikan kontrak API final, buat file backend terlebih dahulu mengikuti pola yang sudah ada, lalu buat Android project di `Eak-DANA/`. Implementasikan sampai APK debug berhasil di-build. Laporkan hasil build, test, file yang dibuat, dan keterbatasan yang masih ada secara jujur.
