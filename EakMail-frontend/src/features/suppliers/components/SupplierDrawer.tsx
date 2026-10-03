import { useEffect, useState } from 'react';
import type { SupplierDto, UpsertSupplierRequest } from '@eakmail/shared-types';
import { SupplierType } from '@eakmail/shared-types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Drawer } from '@/components/ui';
import { strings } from '@/lib/strings';
import { featureStrings } from '@/features/shared/feature-strings';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useWorkflows } from '@/features/workflows/api/useWorkflows';

export interface SupplierDrawerProps {
  open: boolean;
  onClose: () => void;
  supplier: SupplierDto | null;
  onSubmit: (body: UpsertSupplierRequest) => void;
  isSubmitting: boolean;
}

const emptyForm: UpsertSupplierRequest = {
  name: '',
  supplierType: SupplierType.BOT,
  botUsername: '',
  accountIds: [],
  defaultWorkflowId: null,
  apiBaseUrl: null,
  apiKey: null,
  apiAuthHeader: null,
};

/** Create/edit supplier form — supports BOT and API types. */
export function SupplierDrawer({ open, onClose, supplier, onSubmit, isSubmitting }: SupplierDrawerProps) {
  const [form, setForm] = useState<UpsertSupplierRequest>(emptyForm);
  const accountsQuery = useAccounts();
  const workflowsQuery = useWorkflows({ pageSize: 100 });

  useEffect(() => {
    if (!open) return;
    setForm(
      supplier
        ? {
            name: supplier.name,
            supplierType: supplier.supplierType ?? SupplierType.BOT,
            botUsername: supplier.botUsername,
            accountIds: supplier.accountIds,
            defaultWorkflowId: supplier.defaultWorkflowId,
            apiBaseUrl: supplier.apiBaseUrl,
            // Never pre-fill apiKey — write-only; user must re-enter to change
            apiKey: null,
            apiAuthHeader: supplier.apiAuthHeader,
          }
        : emptyForm,
    );
  }, [open, supplier]);

  const workflowOptions = [
    { value: '', label: featureStrings.suppliers.noWorkflow },
    ...(workflowsQuery.data?.items ?? []).map((w) => ({ value: w.id, label: w.name })),
  ];

  const typeOptions = [
    { value: SupplierType.BOT, label: '🤖 Telegram Bot (MTProto)' },
    { value: SupplierType.API, label: '🌐 API Eksternal (REST)' },
  ];

  function toggleAccount(id: string) {
    setForm((prev) => ({
      ...prev,
      accountIds: (prev.accountIds ?? []).includes(id)
        ? (prev.accountIds ?? []).filter((a) => a !== id)
        : [...(prev.accountIds ?? []), id],
    }));
  }

  const isApi = form.supplierType === SupplierType.API;
  const canSubmit = form.name.trim() !== '' && (
    isApi
      ? Boolean(form.apiBaseUrl?.trim())
      : Boolean(form.botUsername?.trim())
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={supplier ? featureStrings.suppliers.edit : featureStrings.suppliers.add}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {strings.actions.cancel}
          </Button>
          <Button onClick={() => onSubmit(form)} isLoading={isSubmitting} disabled={!canSubmit}>
            {strings.actions.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={featureStrings.suppliers.name}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />

        <Select
          label="Tipe Supplier"
          options={typeOptions}
          value={form.supplierType ?? SupplierType.BOT}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, supplierType: e.target.value as SupplierType }))
          }
        />

        {isApi ? (
          // ---- API type fields ----
          <div className="space-y-3 rounded-md border border-border bg-surface-2 p-3">
            <p className="text-xs font-medium text-text-muted">Konfigurasi API Supplier</p>
            <Input
              label="Base URL"
              value={form.apiBaseUrl ?? ''}
              placeholder="https://store.example.com/api/v1"
              mono
              onChange={(e) => setForm((prev) => ({ ...prev, apiBaseUrl: e.target.value || null }))}
            />
            <Input
              label={supplier?.apiKeySet ? 'API Key (kosongkan = tidak berubah)' : 'API Key'}
              type="password"
              value={form.apiKey ?? ''}
              placeholder={supplier?.apiKeySet ? '••••••••••••••••' : 'res_xxxxx...'}
              mono
              onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value || null }))}
            />
            {form.apiBaseUrl?.includes('canboso.com') ? (
              <p className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">
                Canboso terdeteksi — header auth otomatis <code className="bg-success/20 px-1 rounded">x-buyer-key</code>, tidak perlu diisi.
              </p>
            ) : (
              <Input
                label="Nama Header Auth (default: X-API-Key)"
                value={form.apiAuthHeader ?? ''}
                placeholder="X-API-Key"
                mono
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, apiAuthHeader: e.target.value || null }))
                }
              />
            )}
            <Select
              label={featureStrings.suppliers.defaultWorkflow}
              options={workflowOptions}
              value={form.defaultWorkflowId ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, defaultWorkflowId: e.target.value || null }))
              }
            />
          </div>
        ) : (
          // ---- BOT type fields ----
          <>
            <Input
              label={featureStrings.suppliers.botUsername}
              value={form.botUsername ?? ''}
              mono
              startAdornment="@"
              onChange={(e) => setForm((prev) => ({ ...prev, botUsername: e.target.value }))}
            />
            <Select
              label={featureStrings.suppliers.defaultWorkflow}
              options={workflowOptions}
              value={form.defaultWorkflowId ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, defaultWorkflowId: e.target.value || null }))
              }
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">
                {featureStrings.suppliers.boundAccounts}
              </span>
              <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto rounded-sm border border-border p-2">
                {(accountsQuery.data ?? []).length === 0 && (
                  <p className="px-1 py-2 text-xs text-text-muted">{strings.common.empty}</p>
                )}
                {(accountsQuery.data ?? []).map((account) => (
                  <label
                    key={account.id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={(form.accountIds ?? []).includes(account.id)}
                      onChange={() => toggleAccount(account.id)}
                      className="accent-brand"
                    />
                    <span className="text-text">{account.label}</span>
                    <span className="ml-auto font-mono text-xs text-text-muted">
                      {account.phoneMasked}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
