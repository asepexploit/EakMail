import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { useAddEakTeleStock, useBulkImportEakTele, useEakTeleLoginStart } from '../api/useEakTeleStock';
import { useProducts } from '@/features/products/api/useProducts';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { useToasts } from '@/features/shared/useToasts';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-selected product ID. User bisa ganti di dalam dialog. */
  defaultProductId?: string;
}

type TabId = 'paste' | 'otp' | 'bulk';
type OtpStep = 'phone' | 'code' | 'password2fa';

export function AddStockDialog({ open, onClose, defaultProductId }: Props) {
  const [tab, setTab] = useState<TabId>('paste');
  const [productId, setProductId] = useState(defaultProductId ?? '');

  // Paste session tab
  const [phone, setPhone] = useState('');
  const [session, setSession] = useState('');
  const [password2fa, setPassword2fa] = useState('');
  const [notes, setNotes] = useState('');

  // OTP tab
  const [otpStep, setOtpStep] = useState<OtpStep>('phone');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpNotes, setOtpNotes] = useState('');
  const [loginState, setLoginState] = useState<{ stockId: string; loginId: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Bulk tab
  const [bulkText, setBulkText] = useState('');

  const products = useProducts({ pageSize: 100 });
  const eakTeleProducts = (products.data?.items ?? []).filter((p) => p.isEakTele);
  const productOptions = eakTeleProducts.map((p) => ({ value: p.id, label: p.name }));
  const selectedProductName = eakTeleProducts.find((p) => p.id === productId)?.name ?? '';

  const addStock = useAddEakTeleStock();
  const bulkImport = useBulkImportEakTele();
  const loginStart = useEakTeleLoginStart();
  const queryClient = useQueryClient();
  const toast = useToasts();

  function handleClose() {
    setPhone(''); setSession(''); setPassword2fa(''); setNotes('');
    setOtpPhone(''); setOtpNotes(''); setLoginState(null);
    setOtpCode(''); setTwoFaPassword(''); setOtpStep('phone');
    setBulkText('');
    onClose();
  }

  async function handlePasteSubmit() {
    if (!productId) return;
    await addStock.mutateAsync({ productId, phone, sessionString: session || undefined, password2fa: password2fa || undefined, notes: notes || undefined });
    handleClose();
  }

  async function handleOtpStart() {
    if (!productId) return;
    const res = await loginStart.mutateAsync({ productId, phone: otpPhone, notes: otpNotes || undefined });
    setLoginState({ stockId: res.stockId, loginId: res.loginId });
    setOtpStep('code');
  }

  async function handleOtpSubmit() {
    if (!loginState) return;
    setSubmitLoading(true);
    try {
      const res = await api.eaktele.loginSubmit({
        ...loginState,
        code: otpCode,
        password: twoFaPassword || undefined,
      });
      if (res.needsPassword) {
        setOtpStep('password2fa');
        setOtpCode('');
        return;
      }
      if (res.done) {
        toast.success('Akun berhasil login, sesi aktif!');
        void queryClient.invalidateQueries({ queryKey: queryKeys.eaktele.all });
        handleClose();
      }
    } catch {
      toast.error('Kode OTP salah, coba lagi');
      setOtpCode('');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleSubmit2fa() {
    if (!loginState || !twoFaPassword) return;
    setSubmitLoading(true);
    try {
      const res = await api.eaktele.loginSubmit({
        ...loginState,
        code: '',
        password: twoFaPassword,
      });
      if (res.done) {
        toast.success('Akun berhasil login, sesi aktif!');
        void queryClient.invalidateQueries({ queryKey: queryKeys.eaktele.all });
        handleClose();
      } else {
        toast.error('Password 2FA salah, coba lagi');
        setTwoFaPassword('');
      }
    } catch {
      toast.error('Password 2FA salah, coba lagi');
      setTwoFaPassword('');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleBulkSubmit() {
    if (!productId) return;
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    await bulkImport.mutateAsync({ productId, lines });
    handleClose();
  }

  const tabs: TabItem[] = [
    { value: 'paste', label: 'Paste Session' },
    { value: 'otp', label: 'Login OTP' },
    { value: 'bulk', label: 'Bulk CSV' },
  ];

  function renderOtpFooter() {
    if (otpStep === 'phone') {
      return (
        <Button onClick={handleOtpStart} isLoading={loginStart.isPending} disabled={!otpPhone || !productId}>
          Kirim OTP
        </Button>
      );
    }
    if (otpStep === 'code') {
      return (
        <Button onClick={handleOtpSubmit} isLoading={submitLoading} disabled={!otpCode}>
          Verifikasi Kode OTP
        </Button>
      );
    }
    return (
      <Button onClick={handleSubmit2fa} isLoading={submitLoading} disabled={!twoFaPassword}>
        Konfirmasi Password 2FA
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Tambah Stok Akun Telegram"
      size="lg"
      footer={
        tab === 'paste' ? (
          <Button onClick={handlePasteSubmit} isLoading={addStock.isPending} disabled={!phone || !productId}>
            Simpan
          </Button>
        ) : tab === 'otp' ? renderOtpFooter() : (
          <Button onClick={handleBulkSubmit} isLoading={bulkImport.isPending} disabled={!bulkText.trim() || !productId}>
            Import
          </Button>
        )
      }
    >
      {/* Product selector — selalu tampil di atas */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-text mb-1.5">Produk</label>
        {products.isLoading ? (
          <p className="text-sm text-text-muted">Memuat produk...</p>
        ) : eakTeleProducts.length === 0 ? (
          <p className="text-sm text-danger">Belum ada produk EakTele. Buat produk dulu di halaman Produk EakTele.</p>
        ) : (
          <Select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            options={productOptions}
            placeholder="— Pilih produk —"
            className="w-full"
          />
        )}
        {productId && selectedProductName && (
          <p className="text-xs text-text-muted mt-1">Stok akan masuk ke: <strong>{selectedProductName}</strong></p>
        )}
      </div>

      <Tabs tabs={tabs} value={tab} onChange={(v) => setTab(v as TabId)} className="mb-5" />

      {tab === 'paste' && (
        <div className="space-y-3">
          <Input label="Nomor HP" placeholder="+628xxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Session String" placeholder="Tempel session string GramJS / Telethon di sini" value={session} onChange={(e) => setSession(e.target.value)} />
          <Input label="Password 2FA (opsional)" type="password" placeholder="Kosongkan jika tidak ada" value={password2fa} onChange={(e) => setPassword2fa(e.target.value)} />
          <Input label="Catatan (opsional)" placeholder="Misal: reg UK, created 2024" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}

      {tab === 'otp' && (
        <div className="space-y-3">
          {otpStep === 'phone' && (
            <>
              <Input label="Nomor HP" placeholder="+628xxx" value={otpPhone} onChange={(e) => setOtpPhone(e.target.value)} />
              <Input label="Catatan (opsional)" value={otpNotes} onChange={(e) => setOtpNotes(e.target.value)} />
              <p className="text-xs text-text-muted">Password 2FA akan diminta otomatis jika akun menggunakan 2FA.</p>
            </>
          )}
          {otpStep === 'code' && (
            <>
              <p className="text-sm text-text-muted">
                Kode OTP dikirim ke <strong className="text-text">{otpPhone}</strong>. Cek aplikasi Telegram atau SMS.
              </p>
              <Input label="Kode OTP" placeholder="12345" autoFocus value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
              <button type="button" className="text-xs text-brand hover:underline" onClick={() => { setOtpStep('phone'); setLoginState(null); setOtpCode(''); }}>
                Ganti nomor atau kirim ulang OTP
              </button>
            </>
          )}
          {otpStep === 'password2fa' && (
            <>
              <p className="text-sm text-text-muted">
                Akun <strong className="text-text">{otpPhone}</strong> menggunakan 2FA. Masukkan password 2FA Telegram.
              </p>
              <Input label="Password 2FA" type="password" placeholder="Password 2FA Telegram" autoFocus value={twoFaPassword} onChange={(e) => setTwoFaPassword(e.target.value)} />
            </>
          )}
        </div>
      )}

      {tab === 'bulk' && (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Format per baris: <code className="bg-muted px-1 rounded text-xs">nomor_hp|password_2fa|session_string</code><br />
            Contoh: <code className="bg-muted px-1 rounded text-xs">+628123456789||1BQANOTEuA...</code>
          </p>
          <Textarea
            label="Daftar akun"
            placeholder={"+628111111111|password123|1BQANOTEuA...\n+628222222222||1BQANOTEuB..."}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
          />
        </div>
      )}
    </Dialog>
  );
}
