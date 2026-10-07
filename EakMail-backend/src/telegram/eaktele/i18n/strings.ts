/** Semua copy Bahasa Indonesia untuk bot EakTele. Tidak ada string hardcoded di handler. */

export const S = {
  WELCOME: (brand: string) =>
    `👋 Selamat datang di *${brand}*!\n\nToko akun Telegram terpercaya — beli, login, dan dapatkan OTP langsung di sini.\n\nPilih menu:`,

  MENU_BUY: '📱 Beli Akun',
  MENU_ORDERS: '📋 Pesanan Saya',
  MENU_BALANCE: '💰 Saldo',
  MENU_HELP: '💬 Bantuan',

  // Katalog
  CATALOG_TITLE: '📱 *Pilih Paket Akun Telegram*\n\nPilih paket yang kamu inginkan:',
  CATALOG_ITEM: (name: string, price: number, stock: number) =>
    `*${name}*\nRp ${price.toLocaleString('id-ID')} / akun · Stok: ${stock} tersedia`,
  CATALOG_SOLD_OUT: (name: string) => `*${name}*\n⚠️ Stok habis sementara`,
  CATALOG_EMPTY: '😔 Belum ada paket tersedia saat ini.\nCoba lagi nanti ya.',
  BTN_BUY_ACCOUNT: (name: string, price: number) =>
    `🛒 Beli 1 Akun — Rp ${price.toLocaleString('id-ID')}`,
  BTN_BACK: '⬅️ Kembali',
  BTN_BACK_MENU: '⬅️ Menu Utama',

  // Order
  ORDER_CONFIRM: (name: string, price: number, balance: number) =>
    `🛒 *Konfirmasi Pesanan*\n\nProduk : ${name}\nJumlah : 1 akun\nTotal  : Rp ${price.toLocaleString('id-ID')}\nSaldo  : Rp ${balance.toLocaleString('id-ID')}\n\nPilih metode bayar:`,
  ORDER_INSUFFICIENT: (price: number, balance: number) =>
    `❌ Saldo tidak cukup.\n\nTotal  : Rp ${price.toLocaleString('id-ID')}\nSaldo  : Rp ${balance.toLocaleString('id-ID')}\n\nSilakan top up saldo terlebih dahulu.`,
  ORDER_NO_STOCK: '😔 Stok akun habis untuk paket ini.\nCoba lagi nanti.',
  BTN_PAY_BALANCE: '💰 Bayar dengan Saldo',
  BTN_PAY_QRIS: '📷 Bayar via QRIS',
  BTN_CANCEL: '❌ Batal',

  // Delivery
  DELIVERY_SUCCESS: (phone: string, pass2fa: string | null, orderId: string) =>
    `✅ *Pembelian Berhasil!*\n\n━━━━━━━━━━━━━━━━━━━━━\n📋 DETAIL AKUN TELEGRAM\n━━━━━━━━━━━━━━━━━━━━━\n📞 Nomor   : \`${phone}\`\n🔐 2FA/Pass: \`${pass2fa ?? 'tidak ada'}\`\n\n━━━━━━━━━━━━━━━━━━━━━\n⚠️  *PENTING — Baca sebelum login:*\nSetelah berhasil masuk di device kamu, wajib klik Logout Session Web agar sesi lama terhapus dan akun aman.\n━━━━━━━━━━━━━━━━━━━━━\n\nOrder ID: \`${orderId}\``,

  BTN_GET_OTP: '📲 Get OTP',
  BTN_LOGOUT_GUIDE: '📖 Panduan Logout',
  BTN_CONFIRM_LOGOUT: '✅ Saya Sudah Logout',

  // OTP
  OTP_RESULT: (phone: string, code: string, sentAt: string) =>
    `📲 *Kode OTP — ${phone}*\n\n┌─────────────────────┐\n│   *${code.split('').join(' ')}*   │\n└─────────────────────┘\n\n⏱ Dikirim: ${sentAt}\n📩 Dari: Telegram`,
  OTP_NOT_FOUND:
    '⏳ *Belum ada OTP masuk.*\n\nCoba login dulu ke akun Telegram-nya, lalu tekan Refresh setelah kode dikirim.',
  OTP_SESSION_INVALID:
    '❌ *Sesi akun tidak aktif.*\n\nSilakan hubungi CS untuk bantuan.',
  OTP_NO_SESSION:
    '⚠️ Session akun belum tersedia.\nHubungi CS.',
  BTN_REFRESH_OTP: '🔄 Refresh OTP',

  // Panduan logout
  LOGOUT_GUIDE:
    '📖 *Cara Logout Session Web*\n\n1. Buka Telegram di HP\n2. Masuk ke Settings → Privacy & Security\n3. Pilih Active Sessions\n4. Cari sesi "Web" atau sesi asing\n5. Tap sesi tersebut → Terminate\n\n✅ Setelah logout, akun aman dipakai.',
  LOGOUT_CONFIRMED: '✅ Terima kasih! Akun kamu sekarang aman.',

  // Pesanan
  ORDERS_TITLE: '📋 *Pesanan Aktif Kamu*\n\n',
  ORDERS_EMPTY: '📋 Kamu belum punya pesanan EakTele.',
  ORDER_ITEM: (i: number, phone: string, date: string) =>
    `${i}. \`${phone}\`\n   Dibeli: ${date}`,
  BTN_ORDER_DETAIL: (i: number) => `${i}️⃣ Lihat Detail`,

  // Saldo
  BALANCE_INFO: (balance: number) =>
    `💰 *Saldo Kamu*\n\nRp ${balance.toLocaleString('id-ID')}\n\n[Topup via bot EakMail utama]`,

  // Bantuan
  HELP:
    '💬 *Bantuan EakTele*\n\nKalau ada masalah dengan akun yang kamu beli, hubungi CS kami.\n\nPastikan kamu sudah:\n• Login ke akun\n• Logout semua session web lama\n• Ganti password 2FA ke yang kamu ingat',

  // Error
  ERROR_GENERIC: '❌ Terjadi kesalahan. Coba lagi.',
  ERROR_UNKNOWN_COMMAND: 'Gunakan menu di bawah atau ketik /start.',

  // Force join gate
  GATE_TITLE: '🔒 *Akses Terbatas*',
  GATE_BODY: (channels: string[]) =>
    `Untuk menggunakan bot ini, kamu wajib bergabung ke:\n\n${channels.map((c) => `• ${c}`).join('\n')}\n\nSetelah bergabung, tekan tombol di bawah.`,
  BTN_JOIN: (ch: string) => `🔗 Gabung ${ch}`,
  BTN_JOINED: '✅ Sudah Bergabung',
  GATE_NOT_YET: (channels: string[]) => `❌ Belum bergabung: ${channels.join(', ')}`,
  GATE_WELCOME: '✅ Berhasil! Selamat datang 🎉',
} as const;
