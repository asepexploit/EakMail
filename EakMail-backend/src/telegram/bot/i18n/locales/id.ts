/**
 * Bahasa Indonesia catalog — the DEFAULT locale (PRD.md §5.9; DEFAULT_LANGUAGE = 'id').
 * Complete: every MessageKey has a value here so lookups never fall through.
 * `bot_config.texts.id` overrides individual keys at runtime.
 */
import { MessageKey } from '../keys.js';
import type { Catalog } from '../types.js';

const id: Catalog = {
  // Welcome / menu
  [MessageKey.WELCOME]:
    'Selamat datang di {{brandName}}! 👋\n\nKami menyediakan produk digital dengan pengiriman otomatis. Gunakan menu di bawah untuk mulai.',
  [MessageKey.MENU_TITLE]: 'Silakan pilih menu:',
  [MessageKey.MENU_BTN_CATALOG]: '🛍️ Katalog',
  [MessageKey.MENU_BTN_STATUS]: '📦 Status Pesanan',
  [MessageKey.MENU_BTN_LANGUAGE]: '🌐 Bahasa',

  // Catalog
  [MessageKey.CATALOG_TITLE]: '🛍️ Katalog Produk {{brandName}}',
  [MessageKey.CATALOG_EMPTY]: 'Belum ada produk yang tersedia saat ini. Silakan cek kembali nanti.',
  [MessageKey.CATALOG_ITEM]: '• {{name}} — Rp{{price}}\n  Beli: /order {{id}}',
  [MessageKey.CATALOG_BUY_HINT]:
    'Untuk memesan, ketik /order <id_produk> sesuai daftar di atas.',
  [MessageKey.CATALOG_SELECT_CATEGORY]: '📦 PILIH PRODUK\n\nSilakan pilih kategori di bawah.',
  [MessageKey.CATALOG_BACK]: '⬅️ Kembali',
  [MessageKey.CATALOG_PRODUCT_DETAIL]:
    '📦 Produk: {{name}}\n💵 Harga: Rp{{price}}\n\n{{description}}',
  [MessageKey.CATALOG_BUY_BTN]: '🛒 Beli {{name}}',
  [MessageKey.CATALOG_OUT_OF_STOCK]: '❌ Stok habis',
  [MessageKey.CATALOG_SELECT_QTY]: '📦 {{name}}\n💵 Harga: Rp{{price}}/pcs\n\nPilih jumlah:',
  [MessageKey.CATALOG_SELECT_OPTION]: 'Pilih opsi produk di bawah:',

  // Order flow
  [MessageKey.ORDER_USAGE]: 'Cara pesan: ketik /order <id_produk>.\nLihat daftar produk dengan /catalog.',
  [MessageKey.ORDER_PRODUCT_NOT_FOUND]: 'Produk tidak ditemukan. Cek daftar dengan /catalog.',
  [MessageKey.ORDER_PRODUCT_INACTIVE]: 'Maaf, produk ini sedang tidak tersedia.',
  [MessageKey.ORDER_OUT_OF_STOCK]: 'Maaf, stok produk ini sedang habis.',
  [MessageKey.ORDER_CREATED]:
    '✅ Pesanan dibuat!\n\nProduk: {{productName}}\nJumlah: Rp{{amount}}\nID Pesanan: {{orderId}}',
  [MessageKey.ORDER_CHOOSE_PAYMENT]: 'Silakan selesaikan pembayaran berikut:',
  [MessageKey.ORDER_DEMO_PAID]: '🧪 Mode demo — pembayaran dilewati.\nPesanan langsung diproses!',
  [MessageKey.ORDER_CHOOSE_PAYMENT_METHOD]:
    '🛒 *{{productName}}{{qty}}*\n\n💰 Total: *Rp{{amount}}*\nSaldo kamu: Rp{{balance}}\n\nPilih metode pembayaran:',
  [MessageKey.ORDER_PAY_BALANCE_BTN]: '💰 Bayar dengan Saldo (Rp{{balance}})',
  [MessageKey.ORDER_PAY_QRIS_BTN]: '📱 Bayar via QRIS / VA',
  [MessageKey.ORDER_BALANCE_INSUFFICIENT]:
    '❌ Saldo tidak cukup.\n\nSaldo kamu: Rp{{balance}}\nDibutuhkan: Rp{{amount}}\n\nGunakan tombol di bawah untuk topup via QRIS/VA, atau hubungi admin.',
  [MessageKey.ORDER_BALANCE_PAID]:
    '✅ Pembayaran dengan saldo berhasil!\n\nProduk: {{productName}}\nTotal: Rp{{amount}}\nSisa saldo: Rp{{newBalance}}',

  // Payment instructions
  [MessageKey.PAYMENT_QR]:
    '💳 Pembayaran QRIS\nScan kode QR berikut dengan aplikasi e-wallet atau mobile banking Anda:\n\n{{qrString}}',
  [MessageKey.PAYMENT_QR_LABEL]:
    '💳 *Pembayaran QRIS*\nScan gambar QR di atas dengan aplikasi e-wallet atau mobile banking kamu.',
  [MessageKey.PAYMENT_VA]:
    '💳 Virtual Account\nTransfer ke nomor VA berikut:\n\n{{vaNumber}}',
  [MessageKey.PAYMENT_LINK]:
    '💳 Link Pembayaran\nLanjutkan pembayaran melalui tautan berikut:\n\n{{paymentUrl}}',
  [MessageKey.PAYMENT_AMOUNT]: 'Total yang harus dibayar: Rp{{amount}}',
  [MessageKey.PAYMENT_EXPIRES]: '⏳ Bayar sebelum: {{expiresAt}}',
  [MessageKey.PAYMENT_PENDING_NOTE]:
    'Setelah pembayaran berhasil, produk akan dikirim otomatis. Cek status dengan /status {{orderId}}.',

  // Order status
  [MessageKey.STATUS_USAGE]: 'Cara cek status: ketik /status <id_pesanan>.',
  [MessageKey.STATUS_NOT_FOUND]: 'Pesanan tidak ditemukan. Pastikan ID pesanan benar.',
  [MessageKey.STATUS_LINE]: 'Status pesanan {{orderId}}: {{statusLabel}}',
  [MessageKey.STATUS_PENDING]: 'Menunggu pembayaran ⏳',
  [MessageKey.STATUS_PAID]: 'Sudah dibayar ✅',
  [MessageKey.STATUS_FULFILLING]: 'Sedang diproses ⚙️',
  [MessageKey.STATUS_DELIVERED]: 'Sudah dikirim 🎉',
  [MessageKey.STATUS_FAILED]: 'Gagal ❌',
  [MessageKey.STATUS_REFUND_PENDING]: 'Menunggu pengembalian dana 💸',
  [MessageKey.STATUS_REFUNDED]: 'Dana dikembalikan ↩️',
  [MessageKey.STATUS_EXPIRED]: 'Kedaluwarsa ⌛',

  // Fulfillment notice
  [MessageKey.FULFILLING_NOTICE]:
    '🔄 Sedang diproses — *{{productName}}*\n🆔 `{{orderId}}`',

  // Delivery wrapper — wraps the raw payload before sending to the customer
  [MessageKey.DELIVERY_WRAPPER]:
    '🎉 *Pesanan Berhasil Dikirim!*\n\nHei! Produk digitalmu sudah siap nih 🚀\n\n📦 *Berikut produkmu:*\n\n{{payload}}\n\n──────────────────────\n🆔 ID Pesanan: `{{orderId}}`\nSimpan pesan ini sebagai bukti ya!\n──────────────────────\n\nTerima kasih sudah belanja! ❤️',

  // Payment outcome notifications
  [MessageKey.TOPUP_SUCCESS]:
    '✅ *Top Up Berhasil!*\n\nSaldo kamu sudah berhasil ditambahkan 🎉\n\n💰 Nominal: *Rp {{amount}}*\n💳 Metode: QRIS\n\n──────────────────────\n💼 Saldo kamu sekarang: *Rp {{newBalance}}*\n──────────────────────\n\nSiap belanja? Ketik /catalog untuk lihat produk 🛍️',

  [MessageKey.PAYMENT_CONFIRMED]:
    '✅ *Pembayaran Diterima!*\n\nPembayaran kamu sudah kami konfirmasi 🎉\nPesanan sedang kami proses, ya...\n\n📦 Produk: *{{productName}}*\n💰 Total: *Rp {{amount}}*\n🆔 ID Pesanan: `{{orderId}}`\n\n──────────────────────\n_Kamu akan dapat notifikasi lagi saat produk siap dikirim_ 📬\n──────────────────────',

  [MessageKey.PAYMENT_EXPIRED]:
    '⏰ *Pembayaran Kadaluarsa*\n\nWaktu pembayaran untuk pesananmu sudah habis 😔\n\n📦 Produk: *{{productName}}*\n💰 Total: *Rp {{amount}}*\n🆔 ID Pesanan: `{{orderId}}`\n\n──────────────────────\nTenang, tidak ada biaya yang dikenakan.\n\nMau coba lagi? Ketik /catalog 🛍️\n──────────────────────',

  // Balance / top-up
  [MessageKey.BALANCE_INFO]:
    '💰 *Saldo Kamu*\n\n`Rp {{balance}}`\n\nPilih jumlah topup di bawah, atau ketik nominal sendiri setelah tekan "Nominal Lain".',
  [MessageKey.BALANCE_TOPUP_BTN]: '➕ Topup',
  [MessageKey.BALANCE_TOPUP_MANUAL_BTN]: '✏️ Nominal Lain',
  [MessageKey.TOPUP_AMOUNT_PROMPT]:
    '✏️ Ketik nominal topup kamu (minimal Rp5.000):\n\nContoh: `25000`',
  [MessageKey.TOPUP_AMOUNT_INVALID]:
    '❌ Nominal tidak valid. Minimal Rp5.000, contoh: `25000`',
  [MessageKey.TOPUP_QR_CAPTION]:
    '💳 *Topup Saldo Rp{{amount}}*\n\nScan kode QR di atas pakai e-wallet atau mobile banking kamu.\nBayar tepat *Rp{{amount}}* — saldo masuk otomatis setelah berhasil.\n\n⏳ Bayar sebelum: {{expiresAt}}',
  [MessageKey.TOPUP_PROCESSING]: '⏳ Membuat QRIS...',
  [MessageKey.TOPUP_CANCEL_BTN]: '❌ Batalkan',
  [MessageKey.TOPUP_CANCELLED]: '✅ Topup dibatalkan.',
  [MessageKey.TOPUP_CANCEL_NOT_FOUND]: 'Topup tidak ditemukan atau sudah selesai.',

  // Language
  [MessageKey.LANGUAGE_PROMPT]: 'Pilih bahasa / Choose your language:',
  [MessageKey.LANGUAGE_BTN_ID]: '🇮🇩 Bahasa Indonesia',
  [MessageKey.LANGUAGE_BTN_EN]: '🇬🇧 English',
  [MessageKey.LANGUAGE_SWITCHED]: 'Bahasa diubah ke Bahasa Indonesia. ✅',

  // Errors
  [MessageKey.ERROR_GENERIC]: 'Terjadi kesalahan. Silakan coba lagi nanti.',
  [MessageKey.ERROR_UNKNOWN_COMMAND]:
    'Perintah tidak dikenali. Ketik /start untuk melihat menu.',
};

export default id;
