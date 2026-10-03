import { useState } from 'react';
import { Send } from 'lucide-react';
import type { CreateBroadcastRequest } from '@eakmail/shared-types';
import { Button, Card, ConfirmDialog, Input, Textarea } from '@/components/ui';
import { featureStrings } from '@/features/shared/feature-strings';

export interface BroadcastComposeProps {
  onSend: (body: CreateBroadcastRequest) => Promise<unknown>;
  isSending: boolean;
}

/**
 * Compose card for a customer broadcast: message + optional image URL, guarded by a
 * confirmation dialog because it fans out to every customer. Business logic (targeting,
 * sending) lives in the backend; this component only collects and validates input shape.
 */
export function BroadcastCompose({ onSend, isSending }: BroadcastComposeProps) {
  const copy = featureStrings.broadcast;
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const trimmedMessage = message.trim();
  const trimmedImage = imageUrl.trim();

  function isValidHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  const imageUrlError =
    trimmedImage.length > 0 && !isValidHttpUrl(trimmedImage)
      ? copy.invalidImageUrl ?? 'URL gambar tidak valid.'
      : undefined;

  const canSend = trimmedMessage.length > 0 && !imageUrlError && !isSending;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (trimmedMessage.length === 0) {
      setError(copy.emptyMessage);
      return;
    }
    if (imageUrlError) return;
    setError(undefined);
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    const trimmedImage = imageUrl.trim();
    await onSend({
      message: trimmedMessage,
      imageUrl: trimmedImage.length > 0 ? trimmedImage : null,
    });
    setConfirmOpen(false);
    setMessage('');
    setImageUrl('');
  }

  return (
    <Card title={copy.composeTitle}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Textarea
          label={copy.message}
          placeholder={copy.messagePlaceholder}
          rows={5}
          value={message}
          error={error}
          onChange={(event) => {
            setMessage(event.target.value);
            if (error) setError(undefined);
          }}
        />
        <Input
          label={copy.imageUrl}
          placeholder={copy.imageUrlPlaceholder}
          value={imageUrl}
          error={imageUrlError}
          onChange={(event) => setImageUrl(event.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={!canSend} isLoading={isSending}>
            <Send className="h-4 w-4" aria-hidden />
            {copy.send}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        message={copy.sendConfirm}
        confirmLabel={copy.send}
        isLoading={isSending}
      />
    </Card>
  );
}
