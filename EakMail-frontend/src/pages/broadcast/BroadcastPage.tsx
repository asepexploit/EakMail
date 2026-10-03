import { PageHeader } from '@/components/layout/PageHeader';
import { strings } from '@/lib/strings';
import { featureStrings } from '@/features/shared/feature-strings';
import { useBroadcasts, useCreateBroadcast } from '@/features/broadcast/api/useBroadcast';
import { BroadcastCompose } from '@/features/broadcast/components/BroadcastCompose';
import { BroadcastHistory } from '@/features/broadcast/components/BroadcastHistory';

/** Broadcast page — compose a message to all customers + polled send history (F: Broadcast). */
export function BroadcastPage() {
  const { data, isLoading, isError, refetch } = useBroadcasts();
  const createBroadcast = useCreateBroadcast();

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.broadcast} description={featureStrings.broadcast.subtitle} />

      <BroadcastCompose
        onSend={(body) => createBroadcast.mutateAsync(body)}
        isSending={createBroadcast.isPending}
      />

      <BroadcastHistory
        rows={data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />
    </div>
  );
}
