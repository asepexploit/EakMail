/**
 * Centralized Bahasa Indonesia UI copy (DESIGN_SYSTEM.md §14).
 *
 * All user-visible dashboard text lives here so it stays consistent and future
 * EN support is cheap. Never hardcode Indonesian text inline in components.
 * Code identifiers stay English (.claude/rules/naming-conventions.md §5).
 */

export const strings = {
  /** Brand / product. */
  brand: {
    name: 'EakMail',
    tagline: 'Panel Operasi',
  },

  /** Navigation — grouped sidebar labels (DESIGN_SYSTEM.md §13.3). */
  nav: {
    groups: {
      operasional: 'OPERASIONAL',
      katalog: 'KATALOG',
      bot: 'BOT',
      promosi: 'PROMOSI',
      monitor: 'MONITOR GRUP',
      builder: 'BUILDER',
      sistem: 'SISTEM',
    },
    overview: 'Ringkasan',
    orders: 'Pesanan',
    customers: 'Pelanggan',
    monitoring: 'Monitoring',
    logs: 'Log',
    products: 'Produk',
    stock: 'Stok',
    suppliers: 'Supplier',
    accounts: 'Akun',
    botConfig: 'Pengaturan Bot',
    broadcast: 'Broadcast',
    workflowBuilder: 'Workflow Builder',
    docs: 'Dokumentasi',
    payments: 'Pembayaran',
    settings: 'Pengaturan',
    promotionAccounts: 'Akun Promosi',
    promotionCampaigns: 'Kampanye',
    promotionLogs: 'Riwayat Kirim',
    monitorAccounts: 'Akun Monitor',
    monitorGroups: 'Grup & Channel',
    monitorActivity: 'Aktivitas Live',
    monitorMessages: 'Log Pesan',
  },

  /** Reusable action labels. */
  actions: {
    save: 'Simpan',
    cancel: 'Batal',
    delete: 'Hapus',
    edit: 'Ubah',
    add: 'Tambah',
    create: 'Buat',
    close: 'Tutup',
    confirm: 'Konfirmasi',
    retry: 'Coba Lagi',
    refund: 'Refund',
    refresh: 'Muat Ulang',
    search: 'Cari',
    filter: 'Filter',
    apply: 'Terapkan',
    reset: 'Atur Ulang',
    test: 'Uji',
    copy: 'Salin',
    copied: 'Tersalin',
    set: 'Set',
    view: 'Lihat',
    export: 'Ekspor',
  },

  /** Generic state words. */
  common: {
    active: 'Aktif',
    inactive: 'Nonaktif',
    enabled: 'Aktif',
    disabled: 'Nonaktif',
    loading: 'Memuat...',
    empty: 'Tidak ada data',
    error: 'Terjadi kesalahan',
    all: 'Semua',
    none: 'Tidak ada',
    yes: 'Ya',
    no: 'Tidak',
    optional: 'opsional',
    required: 'wajib',
    unknown: 'Tidak diketahui',
    connecting: 'Menghubungkan...',
    connected: 'Terhubung',
    disconnected: 'Terputus',
  },

  /** Topbar / navbar. */
  navbar: {
    searchPlaceholder: 'Cari perintah, pesanan, produk...',
    toggleSidebar: 'Buka/tutup sidebar',
    toggleTheme: 'Ganti tema',
    notifications: 'Notifikasi',
    health: 'Kesehatan sistem',
    account: 'Akun admin',
  },

  /** Status bar (bottom). */
  statusBar: {
    queueDepth: 'Antrian',
    activeExecutions: 'Eksekusi aktif',
    worker: 'Worker',
    websocket: 'WS',
    online: 'Online',
    offline: 'Offline',
    reconnecting: 'Menyambung ulang...',
  },

  /** DataTable chrome. */
  table: {
    empty: 'Belum ada data untuk ditampilkan',
    emptyHint: 'Data akan muncul di sini setelah tersedia.',
    rowsPerPage: 'Baris per halaman',
    page: 'Halaman',
    of: 'dari',
    previous: 'Sebelumnya',
    next: 'Berikutnya',
    rowCount: (count: number) => `${count} baris`,
    sortAscending: 'Urut naik',
    sortDescending: 'Urut turun',
  },

  /** Confirm dialog defaults (destructive actions). */
  confirm: {
    title: 'Konfirmasi tindakan',
    message: 'Tindakan ini tidak dapat dibatalkan. Lanjutkan?',
    confirmLabel: 'Ya, lanjutkan',
    cancelLabel: 'Batal',
  },

  /** Secret / write-only fields. */
  secret: {
    placeholderSet: '••••••••••••',
    setLabel: 'Set nilai',
    replaceHint: 'Nilai tersimpan tidak ditampilkan. Isi untuk mengganti.',
    storedBadge: 'Tersimpan',
    notSetBadge: 'Belum diatur',
    show: 'Tampilkan',
    hide: 'Sembunyikan',
  },

  /** Toast fallbacks. */
  toast: {
    saved: 'Perubahan tersimpan',
    deleted: 'Data dihapus',
    failed: 'Gagal memproses',
    copied: 'Disalin ke clipboard',
  },

  /** Placeholder route content until feature pages are wired in. */
  placeholder: {
    title: 'Halaman dalam pengembangan',
    body: 'Konten halaman ini akan tersedia setelah modul terkait selesai.',
  },

  /** Login page + auth guard. */
  auth: {
    title: 'Masuk',
    subtitle: 'Panel admin EakMail',
    emailLabel: 'Email',
    emailPlaceholder: 'admin@eakmail.local',
    passwordLabel: 'Kata sandi',
    passwordPlaceholder: '••••••••',
    totpLabel: 'Kode 2FA',
    totpPlaceholder: '6 digit (jika aktif)',
    submit: 'Masuk',
    submitting: 'Memproses…',
    logout: 'Keluar',
    invalid: 'Email atau kata sandi salah.',
    genericError: 'Gagal masuk. Coba lagi.',
    checking: 'Memeriksa sesi…',
    localOnly: 'Akses lokal — 127.0.0.1',
  },
} as const;

export type Strings = typeof strings;
