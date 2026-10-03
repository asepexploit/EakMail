import { useState } from 'react';
import { Ban, Pause, Play, RefreshCw, StepForward } from 'lucide-react';
import { ExecutionCommand, ExecutionState, type ExecutionState as ExecutionStateType } from '@eakmail/shared-types';
import { Button } from '@/components/ui/Button';
import { executionCommandLabel } from '@/features/shared/enum-labels';
import { useExecutionCommand } from '@/features/monitoring/api/useExecutions';

export interface ExecutionControlsProps {
  executionId: string;
  state: ExecutionStateType;
}

const TERMINAL: ExecutionStateType[] = [
  ExecutionState.SUCCEEDED,
  ExecutionState.FAILED,
  ExecutionState.CANCELLED,
  ExecutionState.TIMED_OUT,
];

/** Live controls per execution (DESIGN_SYSTEM.md §9.1, BLUEPRINT.md §10.3). */
export function ExecutionControls({ executionId, state }: ExecutionControlsProps) {
  const command = useExecutionCommand();
  const [pendingCmd, setPendingCmd] = useState<ExecutionCommand | null>(null);
  const isTerminal = TERMINAL.includes(state);
  const isRunning = state === ExecutionState.RUNNING;
  const isPaused = state === ExecutionState.PAUSED;

  function send(cmd: ExecutionCommand) {
    setPendingCmd(cmd);
    command.mutate(
      { id: executionId, command: cmd },
      { onSettled: () => setPendingCmd(null) },
    );
  }

  const anyPending = command.isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={!isRunning || anyPending}
        isLoading={pendingCmd === ExecutionCommand.PAUSE}
        onClick={() => send(ExecutionCommand.PAUSE)}
      >
        {pendingCmd !== ExecutionCommand.PAUSE && <Pause className="h-3.5 w-3.5" />}
        {executionCommandLabel[ExecutionCommand.PAUSE]}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={!isPaused || anyPending}
        isLoading={pendingCmd === ExecutionCommand.RESUME}
        onClick={() => send(ExecutionCommand.RESUME)}
      >
        {pendingCmd !== ExecutionCommand.RESUME && <Play className="h-3.5 w-3.5" />}
        {executionCommandLabel[ExecutionCommand.RESUME]}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={!isPaused || anyPending}
        isLoading={pendingCmd === ExecutionCommand.STEP}
        onClick={() => send(ExecutionCommand.STEP)}
      >
        {pendingCmd !== ExecutionCommand.STEP && <StepForward className="h-3.5 w-3.5" />}
        {executionCommandLabel[ExecutionCommand.STEP]}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={anyPending}
        isLoading={pendingCmd === ExecutionCommand.RETRY_FROM_FAILED}
        onClick={() => send(ExecutionCommand.RETRY_FROM_FAILED)}
      >
        {pendingCmd !== ExecutionCommand.RETRY_FROM_FAILED && <RefreshCw className="h-3.5 w-3.5" />}
        {executionCommandLabel[ExecutionCommand.RETRY_FROM_FAILED]}
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={isTerminal || anyPending}
        isLoading={pendingCmd === ExecutionCommand.CANCEL}
        onClick={() => send(ExecutionCommand.CANCEL)}
      >
        {pendingCmd !== ExecutionCommand.CANCEL && <Ban className="h-3.5 w-3.5" />}
        {executionCommandLabel[ExecutionCommand.CANCEL]}
      </Button>
    </div>
  );
}
