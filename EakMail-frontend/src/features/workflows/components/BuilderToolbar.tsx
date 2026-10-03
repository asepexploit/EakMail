import { CheckCircle2, History, PlayCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { featureStrings } from '@/features/shared/feature-strings';

export interface BuilderToolbarProps {
  name: string;
  onNameChange: (name: string) => void;
  supplierId: string;
  onSupplierChange: (id: string) => void;
  supplierOptions: SelectOption[];
  accountId: string;
  onAccountChange: (id: string) => void;
  accountOptions: SelectOption[];
  onSave: () => void;
  onValidate: () => void;
  onTest: () => void;
  isSaving: boolean;
  isValidating: boolean;
  isTesting: boolean;
  /** Current stored version (undefined for an unsaved draft). */
  version?: number;
  /** Roll back to the previous version; hidden when there is no prior version. */
  onRollback?: () => void;
  isRollingBack?: boolean;
}

/** Builder toolbar: name/supplier/account + Save / Validate / Test (DESIGN_SYSTEM.md §8.1). */
export function BuilderToolbar({
  name,
  onNameChange,
  supplierId,
  onSupplierChange,
  supplierOptions,
  accountId,
  onAccountChange,
  accountOptions,
  onSave,
  onValidate,
  onTest,
  isSaving,
  isValidating,
  isTesting,
  version,
  onRollback,
  isRollingBack,
}: BuilderToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border bg-surface px-4 py-2.5">
      <div className="w-56">
        <Input
          value={name}
          placeholder={featureStrings.workflows.builder.untitled}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
      <div className="w-44">
        <Select
          options={supplierOptions}
          value={supplierId}
          placeholder={featureStrings.workflows.supplier}
          onChange={(e) => onSupplierChange(e.target.value)}
        />
      </div>
      <div className="w-44">
        <Select
          options={accountOptions}
          value={accountId}
          placeholder={featureStrings.workflows.builder.account}
          onChange={(e) => onAccountChange(e.target.value)}
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {typeof version === 'number' && (
          <span className="rounded-sm bg-surface-2 px-2 py-1 text-xs text-text-muted">
            {featureStrings.workflows.version} {version}
          </span>
        )}
        {onRollback && typeof version === 'number' && version > 1 && (
          <Button variant="ghost" onClick={onRollback} isLoading={isRollingBack}>
            <History className="h-4 w-4" />
            {featureStrings.workflows.builder.rollback}
          </Button>
        )}
        <Button variant="secondary" onClick={onValidate} isLoading={isValidating}>
          <CheckCircle2 className="h-4 w-4" />
          {featureStrings.workflows.builder.validate}
        </Button>
        <Button variant="secondary" onClick={onTest} isLoading={isTesting}>
          <PlayCircle className="h-4 w-4" />
          {featureStrings.workflows.builder.test}
        </Button>
        <Button onClick={onSave} isLoading={isSaving}>
          <Save className="h-4 w-4" />
          {featureStrings.workflows.builder.save}
        </Button>
      </div>
    </div>
  );
}
