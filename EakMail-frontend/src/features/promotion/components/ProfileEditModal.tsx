import { useEffect, useState } from 'react';
import { UserPen, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  useAccountProfile,
  useUpdateAccountProfile,
} from '@/features/promotion/api/usePromotionAccounts';

interface Props {
  accountId: string;
  accountLabel: string;
  open: boolean;
  onClose: () => void;
}

export function ProfileEditModal({ accountId, accountLabel, open, onClose }: Props) {
  const { data: current, isLoading: profileLoading, error: profileError } = useAccountProfile(
    open ? accountId : null,
  );
  const update = useUpdateAccountProfile(accountId);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [about, setAbout] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Pre-fill fields when current profile loads.
  useEffect(() => {
    if (current) {
      setFirstName(current.firstName ?? '');
      setLastName(current.lastName ?? '');
      setUsername(current.username ?? '');
      setAbout(current.about ?? '');
      setPhotoUrl('');
    }
  }, [current]);

  function handleClose() {
    setError('');
    setSuccess(false);
    onClose();
  }

  async function handleSave() {
    setError('');
    setSuccess(false);

    const body: Record<string, string | null | undefined> = {};

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedUsername = username.trim();
    const trimmedAbout = about.trim();
    const trimmedPhoto = photoUrl.trim();

    if (trimmedFirst !== (current?.firstName ?? '')) body.firstName = trimmedFirst || undefined;
    if (trimmedLast !== (current?.lastName ?? '')) body.lastName = trimmedLast;
    if (trimmedUsername !== (current?.username ?? '')) body.username = trimmedUsername;
    if (trimmedAbout !== (current?.about ?? '')) body.about = trimmedAbout;
    if (trimmedPhoto) body.photoUrl = trimmedPhoto;

    if (Object.keys(body).length === 0) {
      setError('Tidak ada perubahan yang perlu disimpan.');
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
      {profileLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Mengambil data profil...</span>
        </div>
      ) : profileError ? (
        <div className="py-6 text-center text-sm text-danger">
          Gagal mengambil profil Telegram. Pastikan sesi masih aktif.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Current profile info */}
          {current && (
            <div className="rounded-lg border border-border bg-surface/60 px-3 py-2.5 text-xs text-text-muted space-y-0.5">
              <p className="font-medium text-text-muted/80 mb-1">Profil saat ini</p>
              <p>
                <span className="text-text-muted/60">Nama: </span>
                <span className="text-text">
                  {[current.firstName, current.lastName].filter(Boolean).join(' ') || '—'}
                </span>
              </p>
              <p>
                <span className="text-text-muted/60">Username: </span>
                <span className="text-text">{current.username ? `@${current.username}` : '—'}</span>
              </p>
              <p>
                <span className="text-text-muted/60">Bio: </span>
                <span className="text-text">{current.about || '—'}</span>
              </p>
            </div>
          )}

          <p className="text-xs text-text-muted">
            Field sudah diisi dengan nilai saat ini. Ubah yang perlu diperbarui, lalu simpan.
          </p>

          <Input
            label="Nama depan"
            placeholder="Nama pertama"
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
            label="Username"
            placeholder="contoh: myusername (tanpa @)"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
            maxLength={32}
          />
          <Input
            label="Bio / Tentang"
            placeholder="Deskripsi singkat (maks 70 karakter)"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={70}
          />
          <Input
            label="URL foto profil baru"
            placeholder="https://... (biarkan kosong jika tidak diubah)"
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
              Simpan Perubahan
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
