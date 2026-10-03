import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { strings } from '@/lib/strings';
import { ApiError } from '@/lib/api-error';
import { Dialog } from '@/components/ui';
import { featureStrings } from '@/features/shared/feature-strings';
import { useToasts } from '@/features/shared/useToasts';
import { useStartAccountLogin, useSubmitAccountCode } from '@/features/accounts/api/useAccounts';

export interface AccountLoginDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'phone' | 'code' | 'password';

/**
 * Multi-step Telegram account login (DESIGN_SYSTEM.md §7.3): phone → code → optional 2FA.
 * The session is created and stored server-side only; nothing sensitive is held here.
 */
export function AccountLoginDialog({ open, onClose }: AccountLoginDialogProps) {
  const [step, setStep] = useState<Step>('phone');
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [loginId, setLoginId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startLogin = useStartAccountLogin();
  const submitCode = useSubmitAccountCode();
  const toast = useToasts();

  useEffect(() => {
    if (open) {
      setStep('phone');
      setLabel('');
      setPhone('');
      setLoginId('');
      setCode('');
      setPassword('');
      setError(null);
    }
  }, [open]);

  // Clear stale error whenever the user advances to a new step.
  useEffect(() => {
    setError(null);
  }, [step]);

  function toMessage(err: unknown): string {
    return err instanceof ApiError ? err.message : strings.common.error;
  }

  async function handleStart() {
    setError(null);
    try {
      const result = await startLogin.mutateAsync({ label, phone });
      setLoginId(result.loginId);
      setStep('code');
    } catch (err) {
      setError(toMessage(err));
    }
  }

  async function handleCode(withPassword = false) {
    setError(null);
    try {
      const result = await submitCode.mutateAsync({
        loginId,
        code,
        password: withPassword ? password : undefined,
      });
      if (result.needsPassword && !withPassword) {
        setStep('password');
        return;
      }
      if (result.done) {
        toast.success(featureStrings.accounts.login.success);
        onClose();
      }
    } catch (err) {
      setError(toMessage(err));
    }
  }

  const stepTitle =
    step === 'phone'
      ? featureStrings.accounts.login.stepPhone
      : step === 'code'
        ? featureStrings.accounts.login.stepCode
        : featureStrings.accounts.login.stepPassword;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${featureStrings.accounts.login.title} — ${stepTitle}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {strings.actions.cancel}
          </Button>
          {step === 'phone' && (
            <Button
              onClick={handleStart}
              isLoading={startLogin.isPending}
              disabled={!label.trim() || !phone.trim()}
            >
              {featureStrings.accounts.login.sendCode}
            </Button>
          )}
          {step === 'code' && (
            <Button onClick={() => handleCode(false)} isLoading={submitCode.isPending} disabled={!code.trim()}>
              {featureStrings.accounts.login.submit}
            </Button>
          )}
          {step === 'password' && (
            <Button
              onClick={() => handleCode(true)}
              isLoading={submitCode.isPending}
              disabled={!password.trim()}
            >
              {featureStrings.accounts.login.submit}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {step === 'phone' && (
          <>
            <Input
              label={featureStrings.accounts.label}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Input
              label={featureStrings.accounts.phone}
              value={phone}
              mono
              helperText={featureStrings.accounts.login.phoneHelper}
              onChange={(e) => setPhone(e.target.value)}
            />
          </>
        )}
        {step === 'code' && (
          <Input
            label={featureStrings.accounts.login.code}
            value={code}
            mono
            helperText={featureStrings.accounts.login.codeHelper}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
          />
        )}
        {step === 'password' && (
          <Input
            label={featureStrings.accounts.login.password}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
          />
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
