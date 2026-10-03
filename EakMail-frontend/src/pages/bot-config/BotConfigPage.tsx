import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  Language,
  type BotConfigDto,
  type BotMenuButton,
  type Language as LanguageType,
  type UpdateBotConfigRequest,
} from '@eakmail/shared-types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SecretField } from '@/components/ui/SecretField';
import { strings } from '@/lib/strings';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { useBotConfig, useUpdateBotConfig } from '@/features/bot-config/api/useBotConfig';
import { BotTextEditor } from '@/features/bot-config/components/BotTextEditor';
import { BotMenuBuilder } from '@/features/bot-config/components/BotMenuBuilder';
import { BotPreview } from '@/features/bot-config/components/BotPreview';

type TabId = 'branding' | 'text' | 'menu' | 'token';

interface Draft {
  brandName: string;
  logoUrl: string;
  startPhotoUrl: string;
  supportContact: string;
  menu: BotMenuButton[];
  texts: Record<LanguageType, Record<string, string>>;
  botToken: string;
}

function toDraft(config: BotConfigDto): Draft {
  return {
    brandName: config.brandName,
    logoUrl: config.logoUrl ?? '',
    startPhotoUrl: config.startPhotoUrl ?? '',
    supportContact: config.texts[DEFAULT_LANGUAGE]?.supportContact ?? '',
    menu: config.menu,
    texts: {
      [Language.ID]: { ...(config.texts[Language.ID] ?? {}) },
      [Language.EN]: { ...(config.texts[Language.EN] ?? {}) },
    },
    botToken: '',
  };
}

/** Bot Config (Pengaturan Bot) page — F17 (DESIGN_SYSTEM.md §7.4b). */
export function BotConfigPage() {
  const { data, isLoading, isError, refetch } = useBotConfig();
  const updateConfig = useUpdateBotConfig();

  const [tab, setTab] = useState<TabId>('branding');
  const [locale, setLocale] = useState<LanguageType>(DEFAULT_LANGUAGE);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (data) setDraft(toDraft(data));
  }, [data]);

  const tabs = useMemo(
    () => [
      { value: 'branding' as const, label: featureStrings.botConfig.tabs.branding },
      { value: 'text' as const, label: featureStrings.botConfig.tabs.text },
      { value: 'menu' as const, label: featureStrings.botConfig.tabs.menu },
      { value: 'token' as const, label: featureStrings.botConfig.tabs.token },
    ],
    [],
  );

  function save() {
    if (!draft) return;
    const body: UpdateBotConfigRequest = {
      brandName: draft.brandName,
      logoUrl: draft.logoUrl || null,
      startPhotoUrl: draft.startPhotoUrl || null,
      menu: draft.menu,
      texts: draft.texts,
    };
    // Only send the token when the admin actually typed a new one (write-only).
    if (draft.botToken.trim() !== '') body.botToken = draft.botToken.trim();
    void updateConfig.mutate(body, { onSuccess: () => setDraft((d) => (d ? { ...d, botToken: '' } : d)) });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={strings.nav.botConfig}
        description={featureStrings.botConfig.subtitle}
        actions={
          <Button onClick={save} isLoading={updateConfig.isPending} disabled={!draft}>
            {strings.actions.save}
          </Button>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        {data && draft && (
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              <Tabs tabs={tabs} value={tab} onChange={(value) => setTab(value as TabId)} />

              {tab === 'branding' && (
                <Card>
                  <div className="space-y-4">
                    <Input
                      label={featureStrings.botConfig.brandName}
                      value={draft.brandName}
                      onChange={(e) => setDraft({ ...draft, brandName: e.target.value })}
                    />
                    <Input
                      label={featureStrings.botConfig.logoUrl}
                      value={draft.logoUrl}
                      mono
                      onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
                    />
                    <Input
                      label="Foto /start (URL gambar — muncul di atas pesan selamat datang)"
                      value={draft.startPhotoUrl}
                      mono
                      onChange={(e) => setDraft({ ...draft, startPhotoUrl: e.target.value })}
                    />
                    <Input
                      label={featureStrings.botConfig.supportContact}
                      value={draft.supportContact}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          supportContact: e.target.value,
                          texts: {
                            ...draft.texts,
                            [DEFAULT_LANGUAGE]: {
                              ...draft.texts[DEFAULT_LANGUAGE],
                              supportContact: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </Card>
              )}

              {tab === 'text' && (
                <Card>
                  <BotTextEditor
                    texts={draft.texts}
                    activeLocale={locale}
                    onLocaleChange={setLocale}
                    onTextChange={(loc, key, value) =>
                      setDraft({
                        ...draft,
                        texts: {
                          ...draft.texts,
                          [loc]: { ...draft.texts[loc], [key]: value },
                        },
                      })
                    }
                  />
                </Card>
              )}

              {tab === 'menu' && (
                <Card>
                  <BotMenuBuilder
                    menu={draft.menu}
                    onChange={(menu) => setDraft({ ...draft, menu })}
                  />
                </Card>
              )}

              {tab === 'token' && (
                <Card>
                  <SecretField
                    label={featureStrings.botConfig.botToken}
                    isSet={data.botTokenSet}
                    value={draft.botToken}
                    onValueChange={(value) => setDraft({ ...draft, botToken: value })}
                    helperText={featureStrings.botConfig.botTokenHelper}
                  />
                </Card>
              )}
            </div>

            <Card title={featureStrings.botConfig.preview}>
              <BotPreview
                brandName={draft.brandName}
                welcome={draft.texts[locale]?.welcome ?? ''}
                startPhotoUrl={draft.startPhotoUrl || undefined}
                menu={draft.menu}
                locale={locale}
              />
            </Card>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
