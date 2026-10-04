import { useState } from 'react';
import { UserPen } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUpdateAccountProfile } from '@/features/promotion/api/usePromotionAccounts';

interface Props {
  accountId: string;
  accountLabel: string;
  open: boolean;
  onClose: () => void;
}

export function ProfileEditModal({ accountId, accountLabel, open, onClose }: Props) {
  const update = useUpdateAccountProfile(accountId);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [about, setAbout] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleClose() {
    setError('');
    setSuccess(false);
    onClose();
  }

  async function handleSave() {
    setError('');
    setSuccess(false);

    const body: Record<string, string | null | undefined> = {};
    if (firstName.trim()) body.firstName = firstName.trim();
    if (lastName.trim() !== '') body.lastName = lastName.trim();
    if (about.trim() !== '') body.about = about.trim();
    if (photoUrl.trim()) body.photoUrl = photoUrl.trim();

    if (Object.keys(body).length === 0) {
      setError('Isi setidaknya satu field sebelum menyimpan.');
      return;
    }

    try {
      await update.mutateAsync(body);
      setSuccess(true);
      setTimeout(handleClose, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memperbarui profil');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2">
          <UserPen className="h-4 w-4 text-primary" />
          Edit Profil Telegram — {accountLabel}
        </span>
      }
      size="sm"
    >
      <div className="space-y-3">
        <p className="text-xs text-text-muted">
          Kosongkan field yang tidak ingin diubah. Field yang diisi akan diperbarui ke Telegram.
        </p>

        <Input
          label="Nama depan"
          placeholder="Nama pertama akun Telegram"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          maxLength={64}
        />
        <Input
          label="Nama belakang"
          placeholder="(opsional)"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          maxLength={64}
        />
        <Input
          label="Bio / Tentang"
          placeholder="Deskripsi singkat profil (maks 70 karakter)"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={70}
        />
        <Input
          label="URL foto profil"
          placeholder="https://... (jpg/png)"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
        />

        {error && <p className="text-xs text-danger">{error}</p>}
        {success && <p className="text-xs text-success">✓ Profil berhasil diperbarui!</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={handleClose} disabled={update.isPending}>
            Batal
          </Button>
          <Button onClick={handleSave} isLoading={update.isPending}>
            Simpan Profil
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
