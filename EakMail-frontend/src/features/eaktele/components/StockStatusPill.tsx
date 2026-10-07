import { StatusPill } from '@/components/ui/StatusPill';
import type { EakTeleStockStatus } from '@/lib/api';
import { eakTeleStockStatusTone } from '@/lib/status-tokens';

const label: Record<EakTeleStockStatus, string> = {
  AVAILABLE: 'Tersedia',
  RESERVED: 'Dipesan',
  SOLD: 'Terjual',
  INVALID: 'Tidak Valid',
  NO_SESSION: 'Belum Login',
};

export function StockStatusPill({ status }: { status: EakTeleStockStatus }) {
  return (
    <StatusPill
      tone={eakTeleStockStatusTone(status)}
      label={label[status] ?? status}
      pulse={status === 'RESERVED'}
    />
  );
}
