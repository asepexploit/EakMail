/** Semua copy Bahasa Indonesia untuk bot EakTele. Tidak ada string hardcoded di handler. */

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export const S = {
  WELCOME: (brand: string) =>
    `👋 Selamat datang di *${brand}*!\n\nToko akun Telegram terpercaya — beli, login, dan dapatkan OTP langsung di sini.\n\nPilih menu:`,

  MENU_BUY: '📱 Beli Akun',
  MENU_ORDERS: '📋 Pesanan Saya',
  MENU_BALANCE: '💰 Saldo',
  MENU_HELP: '💬 Bantuan',

  // ── Katalog ──────────────────────────────────────────────────────────────
  CATALOG_TITLE: (productCount: number, totalStock: number) =>
    `🛒 *Pilih Akun Telegram*\n\n` +
    `${productCount} jenis tersedia · Total stok: *${totalStock} akun*\n\n` +
    `Pilih negara / jenis akun:`,

  CATALOG_EMPTY: '😔 Belum ada stok akun tersedia saat ini.\nCoba lagi nanti ya.',

  PRODUCT_DETAIL: (displayName: string, price: number, available: number) =>
    `✅ *Kamu memilih:*\n${displayName}\n\n` +
    `💰 Harga  : *${formatRp(price)}* / akun\n` +
    `🏢 Stok   : *${available} akun*\n\n` +
    `❗ Pastikan kamu membaca instruksi setelah membeli agar akun aman dan tidak direbut kembali.`,

  // ── Order ────────────────────────────────────────────────────────────────
  ORDER_QTY_PROMPT: (displayName: string, price: number, available: number) =>
    `🛒 *Masukkan jumlah yang ingin dibeli*\n\n` +
    `📦 Produk : ${displayName}\n` +
    `💰 Harga  : *${formatRp(price)}* / akun\n` +
    `🏢 Stok   : *${available} akun*\n\n` +
    `Ketik jumlah (contoh: *1*) lalu kirim.\n` +
    `Ketik /cancel untuk batal.`,

  ORDER_QTY_INVALID: '❌ Masukkan angka yang valid (minimal 1).',

  ORDER_QTY_EXCEED: (max: number) =>
    `❌ Stok tersisa hanya *${max} akun*. Masukkan jumlah yang tidak melebihi stok.`,

  ORDER_INSUFFICIENT: (displayName: string, price: number, qty: number, balance: number) => {
    const total = price * qty;
    const needed = total - balance;
    return (
      `📦 *${displayName}*\n` +
      `💰 Harga  : ${formatRp(price)} / akun\n` +
      `🛍️ Jumlah : ${qty} akun\n` +
      `💳 Total  : ${formatRp(total)}\n\n` +
      `⚠️ *Saldo tidak mencukupi!*\n` +
      `💳 Saldo kamu : ${formatRp(balance)}\n` +
      `💸 Dibutuhkan : ${formatRp(needed)}\n\n` +
      `Silakan deposit terlebih dahulu.`
    );
  },

  ORDER_PAYMENT_SELECT: (displayName: string, price: number, qty: number, total: number) =>
    `💳 *Pilih Metode Pembayaran*\n\n` +
    `📦 Produk : ${displayName}\n` +
    `💰 Harga  : *${formatRp(price)}* / akun\n` +
    `🛍️ Jumlah : *${qty} akun*\n` +
    `💵 Total  : *${formatRp(total)}*\n\n` +
    `Pilih metode pembayaran:`,

  ORDER_PROCESSING: '⏳ *Memproses pesanan...*\n\nMohon tunggu sebentar.',

  ORDER_QRIS_COMING_SOON:
    '📷 *QRIS Coming Soon*\n\nPembayaran via QRIS belum tersedia.\nGunakan saldo untuk sekarang.',

  ORDER_NO_STOCK: '😔 Stok akun habis untuk paket ini.\nCoba lagi nanti.',

  ORDER_CANCELLED: '❌ Pembelian dibatalkan.',

  // Delivery
  DELIVERY_SUCCESS: (phone: string, pass2fa: string | null, orderId: string) =>
    `✅ *Pembelian Berhasil!*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 DETAIL AKUN TELEGRAM\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📞 Nomor   : \`${phone}\`\n` +
    `🔐 2FA/Pass: \`${pass2fa ?? 'tidak ada'}\`\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️  *PENTING — Baca sebelum login:*\n` +
    `Setelah berhasil masuk, wajib klik *Terminate All Other Sessions* agar sesi lama terhapus dan akun aman.\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Order ID: \`${orderId}\``,

  BTN_BUY: '🛍️ Buy',
  BTN_INSTRUCTION_SHORT: '📖 Instruction',
  BTN_BACK: '◀️ Back',
  BTN_HOME: '🏠 Home',
  BTN_DEPOSIT: '💳 Deposit',
  BTN_CANCEL: '❌ Batal',
  BTN_PAY_BALANCE: '💰 Bayar dengan Saldo',
  BTN_PAY_QRIS: '📷 Bayar via QRIS',
  BTN_GET_OTP: '📲 Get OTP',
  BTN_LOGOUT_GUIDE: '📖 Panduan Logout',
  BTN_CONFIRM_LOGOUT: '✅ Saya Sudah Logout',
  BTN_REFRESH_OTP: '🔄 Refresh OTP',

  // ── Instruksi ─────────────────────────────────────────────────────────────
  INSTRUCTION:
    '📖 *Cara Beli & Gunakan Akun di EakTele*\n\n' +
    '*Step 1 — Beli Akun*\n' +
    '1. Tap *Beli Akun* dari menu utama\n' +
    '2. Pilih negara/jenis akun yang diinginkan\n' +
    '3. Tap 🛍️ *Buy* → ketik jumlah → bayar dengan saldo\n' +
    '4. Detail akun (nomor HP + password 2FA) dikirim langsung di sini\n\n' +
    '*Step 2 — Dapatkan Kode OTP*\n' +
    '1. Buka Telegram di HP → tambah akun baru\n' +
    '2. Masukkan nomor HP yang kamu terima\n' +
    '3. Saat Telegram minta kode OTP → kembali ke bot ini\n' +
    '4. Tap 📲 *Get OTP* → salin kode → masukkan di Telegram\n' +
    '5. Jika ada 2FA → masukkan password yang sudah dikirim bersama akun\n\n' +
    '*Step 3 — Amankan Akun (WAJIB)*\n' +
    '1. Settings → Privacy & Security → Active Sessions\n' +
    '2. Tap *"Terminate All Other Sessions"*\n' +
    '3. Ganti password 2FA ke yang kamu ingat\n\n' +
    '⚠️ *Jangan skip Step 3* — agar akun tidak bisa direbut kembali.',

  // ── OTP ──────────────────────────────────────────────────────────────────
  OTP_RESULT: (phone: string, code: string, sentAt: string, messageText: string) =>
    `📲 *Kode OTP — ${phone}*\n\n` +
    `┌─────────────────────┐\n` +
    `│   *${code.split('').join(' ')}*   │\n` +
    `└─────────────────────┘\n\n` +
    `⏱ Dikirim: ${sentAt}\n` +
    `📩 Dari: Telegram\n\n` +
    `📄 *Pesan asli:*\n${messageText}`,

  OTP_NOT_FOUND:
    '⏳ *Belum ada OTP masuk.*\n\nCoba login dulu ke akun Telegram-nya, lalu tekan Refresh setelah kode dikirim.',
  OTP_SESSION_INVALID: '❌ *Sesi akun tidak aktif.*\n\nSilakan hubungi CS untuk bantuan.',
  OTP_NO_SESSION: '⚠️ Session akun belum tersedia.\nHubungi CS.',

  // ── Panduan logout ────────────────────────────────────────────────────────
  LOGOUT_GUIDE:
    '📖 *Cara Logout Session Web*\n\n' +
    '1. Buka Telegram di HP\n' +
    '2. Masuk ke Settings → Privacy & Security\n' +
    '3. Pilih Active Sessions\n' +
    '4. Cari sesi "Web" atau sesi asing\n' +
    '5. Tap sesi tersebut → Terminate\n\n' +
    '✅ Setelah logout, akun aman dipakai.',
  LOGOUT_CONFIRMED: '✅ Terima kasih! Akun kamu sekarang aman.',

  // ── Deposit ───────────────────────────────────────────────────────────────
  DEPOSIT_INFO: (balance: number) =>
    `💳 *Top Up Saldo*\n\n` +
    `Saldo kamu saat ini: *${formatRp(balance)}*\n\n` +
    `Untuk deposit, silakan hubungi CS kami atau gunakan fitur Top Up di bot EakMail utama.`,

  // ── Pesanan ───────────────────────────────────────────────────────────────
  ORDERS_TITLE: '📋 *Pesanan Aktif Kamu*\n\n',
  ORDERS_EMPTY: '📋 Kamu belum punya pesanan EakTele.',
  ORDER_ITEM: (i: number, phone: string, date: string) =>
    `${i}. \`${phone}\`\n   Dibeli: ${date}`,
  BTN_ORDER_DETAIL: (i: number) => `${i}️⃣ Lihat Detail`,

  // ── Saldo ─────────────────────────────────────────────────────────────────
  BALANCE_INFO: (balance: number) =>
    `💰 *Saldo Kamu*\n\n*${formatRp(balance)}*\n\n[Topup via bot EakMail utama]`,

  // ── Bantuan ───────────────────────────────────────────────────────────────
  HELP:
    '💬 *Bantuan EakTele*\n\nKalau ada masalah dengan akun yang kamu beli, hubungi CS kami.\n\nPastikan kamu sudah:\n• Login ke akun\n• Logout semua session web lama\n• Ganti password 2FA ke yang kamu ingat',

  // ── Error ─────────────────────────────────────────────────────────────────
  ERROR_GENERIC: '❌ Terjadi kesalahan. Coba lagi.',
  ERROR_UNKNOWN_COMMAND: 'Gunakan menu di bawah atau ketik /start.',

  // ── Force join gate ───────────────────────────────────────────────────────
  GATE_TITLE: '🔒 *Akses Terbatas*',
  GATE_BODY: (channels: string[]) =>
    `Untuk menggunakan bot ini, kamu wajib bergabung ke:\n\n${channels.map((c) => `• ${c}`).join('\n')}\n\nSetelah bergabung, tekan tombol di bawah.`,
  BTN_JOIN: (ch: string) => `🔗 Gabung ${ch}`,
  BTN_JOINED: '✅ Sudah Bergabung',
  GATE_NOT_YET: (channels: string[]) => `❌ Belum bergabung: ${channels.join(', ')}`,
  GATE_WELCOME: '✅ Berhasil! Selamat datang 🎉',
} as const;
