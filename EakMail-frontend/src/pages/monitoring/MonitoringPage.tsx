import { useSearchParams } from 'react-router-dom';
import { ExecutionState } from '@eakmail/shared-types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';
import { formatDateTime } from '@/lib/format';
import { executionStateTone } from '@/lib/status-tokens';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { executionStateLabel } from '@/features/shared/enum-labels';
import { useExecutionStream } from '@/lib/useExecutionStream';
import { useExecution, useExecutions } from '@/features/monitoring/api/useExecutions';
import { ReadOnlyCanvas } from '@/features/workflows/canvas/ReadOnlyCanvas';
import { ExecutionControls } from '@/features/monitoring/components/ExecutionControls';
import { ExecutionEventLog } from '@/features/monitoring/components/ExecutionEventLog';
import { useWorkflow } from '@/features/workflows/api/useWorkflows';

/** Live Monitoring page (DESIGN_SYSTEM.md §9.1). */
export function MonitoringPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('execution');

  const listQuery = useExecutions({ pageSize: 50 });
  const detailQuery = useExecution(selectedId);
  const workflowQuery = useWorkflow(detailQuery.data?.workflowId ?? null);
  const stream = useExecutionStream(selectedId);

  const liveState = stream.state ?? detailQuery.data?.state ?? null;

  function select(id: string) {
    const next = new URLSearchParams(params);
    next.set('execution', id);
    setParams(next);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.monitoring} description={featureStrings.monitoring.subtitle} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={featureStrings.monitoring.activeList} noPadding className="xl:col-span-1">
          <QueryBoundary
            isLoading={listQuery.isLoading}
            isError={listQuery.isError}
            onRetry={listQuery.refetch}
          >
            <ul className="scroll-thin max-h-[70vh] divide-y divide-border/60 overflow-y-auto">
              {(listQuery.data?.items ?? []).length === 0 && (
                <li className="p-6 text-center text-sm text-text-muted">{strings.common.empty}</li>
              )}
              {(listQuery.data?.items ?? []).map((execution) => (
                <li key={execution.id}>
                  <button
                    type="button"
                    onClick={() => select(execution.id)}
                    className={cn(
                      'focus-ring flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-surface-2 active:bg-surface-2/80',
                      execution.id === selectedId && 'bg-surface-2',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px] text-text">
                        {execution.id}
                      </span>
                      <span className="text-xs text-text-muted">
                        {execution.startedAt ? formatDateTime(execution.startedAt) : '-'}
                      </span>
                    </span>
                    <StatusPill
                      tone={executionStateTone(execution.state)}
                      label={executionStateLabel[execution.state]}
                      pulse={execution.state === ExecutionState.RUNNING}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </QueryBoundary>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          {!selectedId ? (
            <Card>
              <p className="py-16 text-center text-sm text-text-muted">
                {featureStrings.monitoring.selectHint}
              </p>
            </Card>
          ) : (
            <>
              <Card
                title={featureStrings.monitoring.detail}
                actions={
                  liveState && <ExecutionControls executionId={selectedId} state={liveState} />
                }
              >
                <div className="mb-3 flex items-center gap-3 text-sm">
                  {liveState && (
                    <StatusPill
                      tone={executionStateTone(liveState)}
                      label={executionStateLabel[liveState]}
                      pulse={liveState === ExecutionState.RUNNING}
                    />
                  )}
                  <span className="text-xs text-text-muted">
                    {strings.statusBar.websocket}: {stream.connection}
                  </span>
                </div>
                <div className="h-[420px] overflow-hidden rounded-md border border-border bg-surface-2">
                  {workflowQuery.data ? (
                    <ReadOnlyCanvas
                      graph={workflowQuery.data.graph}
                      nodeStatus={stream.nodeStatus}
                      activeNodeId={stream.activeNodeId}
                    />
                  ) : (
                    <p className="flex h-full items-center justify-center text-sm text-text-muted">
                      {strings.common.loading}
                    </p>
                  )}
                </div>
              </Card>

              <Card
                title={featureStrings.monitoring.stream}
                noPadding
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stream.clear}
                    disabled={stream.events.length === 0}
                  >
                    {featureStrings.monitoring.clear}
                  </Button>
                }
              >
                <ExecutionEventLog
                  events={stream.events}
                  historySteps={detailQuery.data?.steps}
                  height={280}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
