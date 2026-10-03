import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { TelegramAccountDto } from '@eakmail/shared-types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { strings } from '@/lib/strings';
import { formatDateTime } from '@/lib/format';
import { accountStatusTone } from '@/lib/status-tokens';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { ConfirmDialog } from '@/components/ui';
import { accountStatusLabel } from '@/features/shared/enum-labels';
import { featureStrings } from '@/features/shared/feature-strings';
import { useAccounts, useDeleteAccount } from '@/features/accounts/api/useAccounts';
import { AccountLoginDialog } from '@/features/accounts/components/AccountLoginDialog';

/** Telegram Accounts (Akun) page — card grid + multi-step login (DESIGN_SYSTEM.md §7.3). */
export function AccountsPage() {
  const { data, isLoading, isError, refetch } = useAccounts();
  const deleteAccount = useDeleteAccount();
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TelegramAccountDto | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title={strings.nav.accounts}
        description={featureStrings.accounts.subtitle}
        actions={
          <Button onClick={() => setLoginOpen(true)}>
            <Plus className="h-4 w-4" />
            {featureStrings.accounts.add}
          </Button>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).length === 0 && (
            <Card className="sm:col-span-2 xl:col-span-3">
              <p className="py-8 text-center text-sm text-text-muted">{strings.common.empty}</p>
            </Card>
          )}
          {(data ?? []).map((account) => (
            <Card key={account.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{account.label}</p>
                  <p className="font-mono text-[13px] text-text-muted">{account.phoneMasked}</p>
                </div>
                <StatusPill
                  tone={accountStatusTone(account.status)}
                  label={accountStatusLabel[account.status]}
                  pulse={account.status === 'CONNECTED'}
                />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-text-muted">
                  {featureStrings.accounts.lastActivity}:{' '}
                  {account.lastActivityAt ? formatDateTime(account.lastActivityAt) : '-'}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingDelete(account)}
                  aria-label={strings.actions.delete}
                  className="focus-ring rounded-sm p-1 text-text-muted hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </QueryBoundary>

      <AccountLoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteAccount.mutateAsync(pendingDelete);
          setPendingDelete(null);
        }}
        message={featureStrings.accounts.deleteConfirm}
        isLoading={deleteAccount.isPending}
      />
    </div>
  );
}
