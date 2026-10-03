/**
 * Workflow Builder documentation content (Bahasa Indonesia).
 *
 * Single source of the docs copy so the page stays a thin renderer. Node facts here mirror the
 * frozen contract (@eakmail/shared-types: NodeType, NODE_OUTPUT_PORTS, config shapes) and the
 * engine behaviour — keep them in sync when the node system changes.
 */
import type { NodeType } from '@eakmail/shared-types';

/** A block of documentation content — rendered by DocsSection. */
export type DocBlock =
  | { kind: 'p'; text: string }
  | { kind: 'code'; text: string; caption?: string }
  | { kind: 'note'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

export interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

/** One documented node. `ports` are the real output ports from NODE_OUTPUT_PORTS. */
export interface NodeDoc {
  type: NodeType;
  when: string;
  config: string;
  ports: string;
}

/** Node reference table, grouped by category (mirrors BLUEPRINT.md §8 / the palette). */
export const NODE_DOCS: { category: string; nodes: NodeDoc[] }[] = [
  {
    category: 'Trigger',
    nodes: [
      {
        type: 'START',
        when: 'Titik masuk. Setiap workflow punya tepat satu node ini.',
        config: '—',
        ports: 'next',
      },
    ],
  },
  {
    category: 'Action (mengirim ke bot supplier)',
    nodes: [
      {
        type: 'SEND_MESSAGE',
        when: 'Kirim teks bebas ke bot supplier.',
        config: 'Teks (mendukung {{variabel}})',
        ports: 'next',
      },
      {
        type: 'SEND_COMMAND',
        when: 'Kirim perintah seperti /beli atau /produk.',
        config: 'Perintah (mis. /produk), Argumen (opsional)',
        ports: 'next',
      },
      {
        type: 'CLICK_BUTTON',
        when: 'Tekan tombol inline pada pesan bot (mis. pilih kategori/varian).',
        config: 'Strategi (label/regex/index/position), Nilai',
        ports: 'clicked · not-found',
      },
    ],
  },
  {
    category: 'Wait (menunggu balasan)',
    nodes: [
      {
        type: 'WAIT_MESSAGE',
        when: 'Tunggu pesan berikutnya dari bot (apa pun isinya).',
        config: 'Timeout (ms)',
        ports: 'received · timeout',
      },
      {
        type: 'WAIT_RESPONSE',
        when: 'Tunggu pesan yang cocok dengan pola (mis. setelah klik).',
        config: 'Mode (contains/regex/equals), Pola, Timeout',
        ports: 'received · timeout',
      },
      {
        type: 'WAIT_BUTTON',
        when: 'Tunggu sampai muncul pesan yang punya tombol inline.',
        config: 'Timeout',
        ports: 'received · timeout',
      },
      {
        type: 'DELAY',
        when: 'Jeda sejenak (meniru jeda manusia).',
        config: 'ms, Jitter (ms)',
        ports: 'next',
      },
    ],
  },
  {
    category: 'Logic (percabangan)',
    nodes: [
      {
        type: 'MATCH_TEXT',
        when: 'Cek teks pesan terakhir terhadap pola; bercabang.',
        config: 'Mode (contains/regex/equals), Pola',
        ports: 'matched · no-match',
      },
      {
        type: 'CONDITION',
        when: 'Percabangan benar/salah dari ekspresi atas variabel.',
        config: 'Ekspresi (mis. {{stok}} > 0)',
        ports: 'true · false',
      },
      {
        type: 'SWITCH',
        when: 'Percabangan banyak arah berdasarkan sebuah nilai.',
        config: 'Berdasarkan (ekspresi), daftar Case',
        ports: 'default · case:<nilai> (satu per case)',
      },
    ],
  },
  {
    category: 'Data (mengolah hasil)',
    nodes: [
      {
        type: 'EXTRACT_DATA',
        when: 'Ambil data dari teks pakai regex (mis. email & password).',
        config: 'Regex (grup bernama), Mode (baris pertama / semua baris), Simpan ke',
        ports: 'extracted · no-match',
      },
      {
        type: 'SET_VARIABLE',
        when: 'Simpan/hitung sebuah nilai ke variabel.',
        config: 'Nama, Nilai (literal atau {{ekspresi}})',
        ports: 'next',
      },
      {
        type: 'TRANSFORM',
        when: 'Ubah bentuk nilai (trim, split, replace, template).',
        config: 'Input, Output, daftar Operasi',
        ports: 'next',
      },
    ],
  },
  {
    category: 'Control (kendali alur)',
    nodes: [
      {
        type: 'RETRY',
        when: 'Ulangi bagian alur saat gagal.',
        config: 'Percobaan Maks, Backoff, Delay',
        ports: 'next · exhausted',
      },
      {
        type: 'TIMEOUT',
        when: 'Batasi durasi maksimum sebuah bagian alur.',
        config: 'ms',
        ports: 'next · timeout',
      },
      {
        type: 'LOOP',
        when: 'Ulangi sebuah cabang (mis. menelusuri menu).',
        config: 'Mode (while/count), Ekspresi/Jumlah, Iterasi Maks',
        ports: 'body · done',
      },
    ],
  },
  {
    category: 'Terminal (akhir workflow)',
    nodes: [
      {
        type: 'SUCCESS',
        when: 'Akhiri workflow sukses, bawa payload hasil.',
        config: 'Payload (mis. {{account}})',
        ports: '—',
      },
      {
        type: 'FAIL',
        when: 'Akhiri workflow gagal (memicu jalur refund).',
        config: 'Alasan, Refund (bool)',
        ports: '—',
      },
      {
        type: 'DELIVER_TO_CUSTOMER',
        when: 'Kirim hasil ke pembeli lewat bot toko; catat pengiriman.',
        config: 'Template pesan (mendukung {{variabel}})',
        ports: '—',
      },
    ],
  },
];

/** Narrative sections (concepts, regex guide, examples). */
export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'konsep',
    title: 'Konsep Dasar',
    blocks: [
      {
        kind: 'p',
        text: 'Workflow adalah rangkaian node yang menjalankan interaksi ke bot supplier secara otomatis, persis seperti yang Anda lakukan manual: kirim perintah, tunggu balasan, klik tombol, ambil data akun, lalu kirim ke pembeli.',
      },
      {
        kind: 'p',
        text: 'Node dihubungkan lewat "port". Node bercabang punya lebih dari satu port keluar — mis. MATCH_TEXT punya "matched" dan "no-match". Tarik garis dari port keluar sebuah node ke port masuk node berikutnya.',
      },
      {
        kind: 'p',
        text: 'Alur khas: START → Kirim Perintah → Tunggu Respons → Klik Tombol → Tunggu Respons → Ekstrak Data → Sukses → Kirim ke Pelanggan.',
      },
      {
        kind: 'note',
        text: 'Selalu akhiri setiap cabang dengan node Terminal (Sukses / Gagal / Kirim ke Pelanggan). Validasi akan menolak workflow tanpa terminal.',
      },
    ],
  },
  {
    id: 'variabel',
    title: 'Variabel & Templating',
    blocks: [
      {
        kind: 'p',
        text: 'Nilai yang ditangkap (mis. dari Ekstrak Data) tersimpan sebagai variabel dan bisa dipakai di node berikutnya dengan sintaks {{namaVariabel}}.',
      },
      {
        kind: 'code',
        caption: 'Contoh: node Kirim ke Pelanggan',
        text: '✅ Pesanan selesai!\n\nEmail: {{email}}\nPassword: {{password}}',
      },
      {
        kind: 'p',
        text: 'Sumber variabel: data hasil ekstraksi ({{email}}), opsi produk dari order, dan node Set Variabel. Ekspresi sederhana didukung di Kondisi/Switch/Loop (mis. {{stok}} > 0).',
      },
      {
        kind: 'p',
        text: 'Timeout & Retry: node Action/Wait bisa diberi batas waktu dan pengulangan otomatis saat gagal, langsung di panel konfigurasinya.',
      },
    ],
  },
  {
    id: 'regex-tombol',
    title: 'Klik Tombol Dinamis (regex)',
    blocks: [
      {
        kind: 'p',
        text: 'Banyak supplier memakai tombol dengan harga & stok yang berubah, mis. "GMAIL-BEKAS — Rp 3.000 (0)" atau "GMAIL-OLD(2FA) — Rp 7.000 (203)". Strategi "label" (cocok persis) TIDAK akan menemukannya. Pakai strategi "regex" yang mencocokkan sebagian teks.',
      },
      {
        kind: 'table',
        head: ['Tombol yang dituju', 'Strategi', 'Nilai'],
        rows: [
          ['GMAIL-BEKAS (apa pun harga/stok)', 'regex', 'GMAIL-BEKAS'],
          ['GMAIL-OLD(2FA)', 'regex', 'GMAIL-OLD'],
          ['GMAIL-FRESH', 'regex', 'GMAIL-FRESH'],
        ],
      },
      {
        kind: 'note',
        text: 'Karakter khusus regex — ( ) . + * ? [ ] — harus di-escape dengan \\. Contoh: OLD\\(2FA\\). Lebih mudah, pakai bagian teks polos yang sudah unik seperti "GMAIL-OLD".',
      },
      {
        kind: 'p',
        text: 'Alternatif: strategi "index" (posisi tombol tetap, mulai dari 0) atau "position" (baris,kolom, mis. 2,0).',
      },
    ],
  },
  {
    id: 'regex-ekstrak',
    title: 'Ekstrak Banyak Akun',
    blocks: [
      {
        kind: 'p',
        text: 'Bila supplier mengirim banyak akun sekaligus (banyak baris email|password), pakai node Ekstrak Data dengan Mode "Semua baris". Node akan menangkap SEMUA baris, bukan hanya yang pertama.',
      },
      {
        kind: 'code',
        caption: 'Regex (grup bernama, per baris)',
        text: '^(?<email>\\S+@\\S+?)\\|(?<pass>\\S+)$',
      },
      {
        kind: 'steps',
        items: [
          'Node Tunggu Respons → Mode: contains, Pola: @gmail.com (atau teks yang pasti muncul).',
          'Node Ekstrak Data → tempel regex di atas, Mode: "Semua baris", Simpan ke: accounts.',
          'Node Kirim ke Pelanggan → template berisi {{accounts}} (seluruh daftar akun).',
        ],
      },
      {
        kind: 'note',
        text: 'Mode "Semua baris" otomatis mengaktifkan pencocokan per-baris, jadi anchor ^ dan $ bekerja tiap baris. Baris header (mis. "🎁 GMAIL-FRESH") otomatis diabaikan karena tidak cocok pola.',
      },
    ],
  },
  {
    id: 'contoh-1-akun',
    title: 'Contoh: Beli 1 Akun',
    blocks: [
      {
        kind: 'steps',
        items: [
          'START',
          'Kirim Perintah — /produk',
          'Tunggu Respons — contains: "PILIH PRODUK"',
          'Klik Tombol — strategi: regex, nilai: GMAIL',
          'Tunggu Respons — contains: "GMAIL"',
          'Klik Tombol — strategi: regex, nilai: GMAIL-FRESH',
          'Tunggu Respons — contains: "@gmail.com"',
          'Ekstrak Data — regex: Email:\\s*(?<account>\\S+)\\s+Pass:\\s*(?<password>\\S+)',
          'Sukses',
          'Kirim ke Pelanggan — "Akun: {{account}} | Pass: {{password}}"',
        ],
      },
    ],
  },
  {
    id: 'contoh-banyak-akun',
    title: 'Contoh: Beli Banyak Akun',
    blocks: [
      {
        kind: 'steps',
        items: [
          'START',
          'Kirim Perintah — /produk',
          'Klik Tombol — regex: GMAIL',
          'Klik Tombol — regex: GMAIL-FRESH',
          'Tunggu Respons — contains: "@gmail.com"',
          'Ekstrak Data — Mode: Semua baris, regex: ^(?<email>\\S+@\\S+?)\\|(?<pass>\\S+)$, Simpan ke: accounts',
          'Sukses',
          'Kirim ke Pelanggan — "Berikut akun Anda:\\n\\n{{accounts}}"',
        ],
      },
      {
        kind: 'note',
        text: 'Gunakan tombol Uji di builder untuk menjalankan workflow terhadap akun yang dipilih dan melihat setiap langkah menyala + log di panel "Aliran Eksekusi".',
      },
    ],
  },
  {
    id: 'test-mode',
    title: 'Uji & Pemecahan Masalah',
    blocks: [
      {
        kind: 'steps',
        items: [
          'Pilih Akun di toolbar, lalu klik Uji.',
          'Panel "Aliran Eksekusi" menampilkan tiap node: pesan terkirim, respons diterima, variabel yang diekstrak, dan error.',
          'Kontrol: Jeda / Lanjutkan / Langkah / Ulang dari Node Gagal / Batalkan.',
        ],
      },
      {
        kind: 'table',
        head: ['Gejala', 'Kemungkinan sebab & solusi'],
        rows: [
          ['Button not found', 'Strategi "label" pada tombol dinamis → ganti ke "regex".'],
          ['Ekstrak no-match', 'Regex tidak cocok. Cek pola; untuk banyak baris pakai Mode "Semua baris".'],
          ['Timeout di Tunggu Respons', 'Pola tidak muncul / balasan lama → longgarkan pola atau naikkan timeout.'],
          ['Node tidak jalan', 'Ada cabang menggantung / tanpa terminal → jalankan Validasi.'],
        ],
      },
    ],
  },
];
