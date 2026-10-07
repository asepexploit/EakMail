import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { useAddEakTeleStock, useBulkImportEakTele, useEakTeleLoginStart, useEakTeleLoginSubmit } from '../api/useEakTeleStock';

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}

type TabId = 'paste' | 'otp' | 'bulk';

export function AddStockDialog({ open, onClose, productId, productName }: Props) {
  const [tab, setTab] = useState<TabId>('paste');

  // Paste session tab state
  const [phone, setPhone] = useState('');
  const [session, setSession] = useState('');
  const [password2fa, setPassword2fa] = useState('');
  const [notes, setNotes] = useState('');

  // OTP login tab state
  const [otpPhone, setOtpPhone] = useState('');
  const [otpPassword, setOtpPassword] = useState('');
  const [otpNotes, setOtpNotes] = useState('');
  const [loginState, setLoginState] = useState<{ stockId: string; loginId: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');

  // Bulk tab state
  const [bulkText, setBulkText] = useState('');

  const addStock = useAddEakTeleStock();
  const bulkImport = useBulkImportEakTele();
  const loginStart = useEakTeleLoginStart();
  const loginSubmit = useEakTeleLoginSubmit();

  function handleClose() {
    setPhone(''); setSession(''); setPassword2fa(''); setNotes('');
    setOtpPhone(''); setOtpPassword(''); setOtpNotes(''); setLoginState(null); setOtpCode('');
    setBulkText('');
    onClose();
  }

  async function handlePasteSubmit() {
    await addStock.mutateAsync({ productId, phone, sessionString: session || undefined, password2fa: password2fa || undefined, notes: notes || undefined });
    handleClose();
  }

  async function handleOtpStart() {
    const res = await loginStart.mutateAsync({ productId, phone: otpPhone, password2fa: otpPassword || undefined, notes: otpNotes || undefined });
    setLoginState({ stockId: res.stockId, loginId: res.loginId });
  }

  async function handleOtpSubmit() {
    if (!loginState) return;
    await loginSubmit.mutateAsync({ ...loginState, code: otpCode });
    handleClose();
  }

  async function handleBulkSubmit() {
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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={`Tambah Stok Akun — ${productName}`}
      size="lg"
      footer={
        tab === 'paste' ? (
          <Button onClick={handlePasteSubmit} isLoading={addStock.isPending} disabled={!phone}>
            Simpan
          </Button>
        ) : tab === 'otp' ? (
          loginState ? (
            <Button onClick={handleOtpSubmit} isLoading={loginSubmit.isPending} disabled={!otpCode}>
              Verifikasi Kode OTP
            </Button>
          ) : (
            <Button onClick={handleOtpStart} isLoading={loginStart.isPending} disabled={!otpPhone}>
              Kirim OTP
            </Button>
          )
        ) : (
          <Button onClick={handleBulkSubmit} isLoading={bulkImport.isPending} disabled={!bulkText.trim()}>
            Import
          </Button>
        )
      }
    >
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
          {!loginState ? (
            <>
              <Input label="Nomor HP" placeholder="+628xxx" value={otpPhone} onChange={(e) => setOtpPhone(e.target.value)} />
              <Input label="Password 2FA (opsional)" type="password" placeholder="Kosongkan jika tidak ada" value={otpPassword} onChange={(e) => setOtpPassword(e.target.value)} />
              <Input label="Catatan (opsional)" value={otpNotes} onChange={(e) => setOtpNotes(e.target.value)} />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                OTP dikirim ke <strong>{otpPhone}</strong>. Masukkan kode dari aplikasi Telegram.
              </p>
              <Input label="Kode OTP" placeholder="12345" autoFocus value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
            </>
          )}
        </div>
      )}

      {tab === 'bulk' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Format per baris: <code className="bg-muted px-1 rounded text-xs">nomor_hp|password_2fa|session_string</code><br />
            Password 2FA dan session bisa dikosongkan. Contoh: <code className="bg-muted px-1 rounded text-xs">+628123456789||1BQANOTEuA...</code>
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
