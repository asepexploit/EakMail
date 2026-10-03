import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Monitor, X } from 'lucide-react';
import type {
  ExecutionStepDto,
  UpsertWorkflowRequest,
  WorkflowGraph,
  WorkflowNode,
  WorkflowValidationResult,
} from '@eakmail/shared-types';
import { strings } from '@/lib/strings';
import { useExecutionStream } from '@/lib/useExecutionStream';
import { ConfirmDialog } from '@/components/ui';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { useToasts } from '@/features/shared/useToasts';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useSuppliers } from '@/features/suppliers/api/useSuppliers';
import {
  useRollbackWorkflow,
  useSaveWorkflow,
  useValidateWorkflow,
  useWorkflow,
} from '@/features/workflows/api/useWorkflows';
import { useRunTest, usePollingExecution } from '@/features/monitoring/api/useExecutions';
import { WsEventType, StepStatus, type WsEvent, type StepStatus as StepStatusType } from '@eakmail/shared-types';
import type { NodeType as NodeTypeValue } from '@eakmail/shared-types';
import { emptyGraph } from '@/features/workflows/graph-adapter';
import { DEFAULT_NODE_CONFIG } from '@/features/workflows/node-catalog';
import { nodeSeverityMap } from '@/features/workflows/validation-map';
import { WorkflowCanvas } from '@/features/workflows/canvas/WorkflowCanvas';
import { NodePalette } from '@/features/workflows/canvas/NodePalette';
import { ReadOnlyCanvas } from '@/features/workflows/canvas/ReadOnlyCanvas';
import { NodeConfigPanel } from '@/features/workflows/config-panel/NodeConfigPanel';
import { BuilderToolbar } from '@/features/workflows/components/BuilderToolbar';
import { ValidationPanel } from '@/features/workflows/components/ValidationPanel';
import { ExecutionEventLog } from '@/features/monitoring/components/ExecutionEventLog';
import { ExecutionControls } from '@/features/monitoring/components/ExecutionControls';

/** Workflow builder canvas page (DESIGN_SYSTEM.md §8). Editing requires a large screen (§11). */
export function WorkflowBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const workflowQuery = useWorkflow(isNew ? null : (id as string));

  const suppliersQuery = useSuppliers({ pageSize: 100 });
  const accountsQuery = useAccounts();
  const saveWorkflow = useSaveWorkflow();
  const validateWorkflow = useValidateWorkflow();
  const rollbackWorkflow = useRollbackWorkflow();
  const runTest = useRunTest();
  const toast = useToasts();

  const [name, setName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [graph, setGraph] = useState<WorkflowGraph>(emptyGraph());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validation, setValidation] = useState<WorkflowValidationResult | null>(null);
  const [testExecutionId, setTestExecutionId] = useState<string | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);

  // Load an existing workflow into local draft state once. The canvas reseeds itself when the
  // graph's structure changes, so no explicit remount key is needed.
  useEffect(() => {
    if (workflowQuery.data) {
      setName(workflowQuery.data.name);
      setSupplierId(workflowQuery.data.supplierId ?? '');
      setGraph(workflowQuery.data.graph);
    }
  }, [workflowQuery.data]);

  const stream = useExecutionStream(testExecutionId);
  // Persisted fallback: a fast test run can finish before the WS subscription attaches, so we
  // also poll the execution and derive log lines + node status from its stored steps.
  const persisted = usePollingExecution(testExecutionId);
  const persistedEvents = useMemo<WsEvent[]>(
    () => stepsToEvents(persisted.data?.steps ?? []),
    [persisted.data],
  );
  const persistedNodeStatus = useMemo<Record<string, StepStatusType>>(
    () => stepsToNodeStatus(persisted.data?.steps ?? []),
    [persisted.data],
  );
  // Prefer live events (richer: messages/vars); fall back to persisted steps when live is empty.
  const drawerEvents = stream.events.length > 0 ? stream.events : persistedEvents;
  const canvasNodeStatus =
    Object.keys(stream.nodeStatus).length > 0 ? stream.nodeStatus : persistedNodeStatus;

  const supplierOptions = useMemo(
    () => [
      { value: '', label: featureStrings.workflows.supplier },
      ...(suppliersQuery.data?.items ?? []).map((s) => ({ value: s.id, label: s.name })),
    ],
    [suppliersQuery.data],
  );
  const accountOptions = useMemo(
    () => [
      { value: '', label: featureStrings.workflows.builder.account },
      ...(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.label })),
    ],
    [accountsQuery.data],
  );

  const selectedNode: WorkflowNode | null =
    graph.nodes.find((node) => node.id === selectedNodeId) ?? null;

  const nodeSeverity = useMemo(() => nodeSeverityMap(validation), [validation]);

  function buildRequest(): UpsertWorkflowRequest {
    return {
      name: name || featureStrings.workflows.builder.untitled,
      supplierId: supplierId || null,
      graph,
      isActive: workflowQuery.data?.isActive,
    };
  }

  async function handleSave() {
    const saved = await saveWorkflow.mutateAsync({
      id: isNew ? undefined : (id as string),
      body: buildRequest(),
    });
    if (isNew) navigate(`/workflows/${saved.id}`, { replace: true });
  }

  async function handleValidate() {
    const result = await validateWorkflow.mutateAsync(buildRequest());
    setValidation(result);
  }

  async function handleTest() {
    if (!accountId) {
      toast.warning(featureStrings.workflows.builder.selectAccountFirst);
      return;
    }
    const targetId = isNew ? null : (id as string);
    if (!targetId) {
      // Persist first so the engine has a workflow to run.
      const saved = await saveWorkflow.mutateAsync({ body: buildRequest() });
      navigate(`/workflows/${saved.id}`, { replace: true });
      const execution = await runTest.mutateAsync({ workflowId: saved.id, accountId });
      setTestExecutionId(execution.id);
    } else {
      const execution = await runTest.mutateAsync({ workflowId: targetId, accountId });
      setTestExecutionId(execution.id);
    }
    toast.info(featureStrings.workflows.builder.testStarted);
  }

  // Keyboard/click alternative to palette drag-drop: append a node and reseed the canvas.
  function addNode(type: NodeTypeValue) {
    const id = `${type.toLowerCase()}-${Date.now().toString(36)}`;
    const offset = graph.nodes.length * 40;
    const node: WorkflowNode = {
      id,
      type,
      config: structuredClone(DEFAULT_NODE_CONFIG[type]),
      position: { x: 260 + offset, y: 120 + offset },
    };
    setGraph((prev) => ({ ...prev, nodes: [...prev.nodes, node] }));
    setSelectedNodeId(id);
  }

  function updateNode(node: WorkflowNode) {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === node.id ? node : n)),
    }));
  }

  function deleteNode(nodeId: string) {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    }));
    setSelectedNodeId(null);
  }

  return (
    <QueryBoundary
      isLoading={!isNew && workflowQuery.isLoading}
      isError={!isNew && workflowQuery.isError}
      onRetry={workflowQuery.refetch}
    >
      {/* Small-screen notice — canvas editing needs space (DESIGN_SYSTEM.md §11). */}
      <div className="flex h-[70vh] flex-col items-center justify-center gap-2 rounded-md border border-border bg-surface p-6 text-center xl:hidden">
        <Monitor className="h-8 w-8 text-text-muted" aria-hidden />
        <p className="text-sm font-medium text-text">
          {featureStrings.workflows.builder.smallScreen}
        </p>
        <p className="text-xs text-text-muted">
          {featureStrings.workflows.builder.smallScreenHint}
        </p>
      </div>

      <div className="hidden h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-md border border-border xl:flex">
        <BuilderToolbar
          name={name}
          onNameChange={setName}
          supplierId={supplierId}
          onSupplierChange={setSupplierId}
          supplierOptions={supplierOptions}
          accountId={accountId}
          onAccountChange={setAccountId}
          accountOptions={accountOptions}
          onSave={handleSave}
          onValidate={handleValidate}
          onTest={handleTest}
          isSaving={saveWorkflow.isPending}
          isValidating={validateWorkflow.isPending}
          isTesting={runTest.isPending}
          version={workflowQuery.data?.version}
          onRollback={() => setConfirmRollback(true)}
          isRollingBack={rollbackWorkflow.isPending}
        />

        {validation && (
          <div className="border-b border-border bg-surface px-4 py-2">
            <ValidationPanel result={validation} onSelectNode={setSelectedNodeId} />
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <NodePalette onAddNode={testExecutionId ? undefined : addNode} />
          <div className="relative min-w-0 flex-1 bg-surface-2">
            {testExecutionId ? (
              <ReadOnlyCanvas
                graph={graph}
                nodeStatus={canvasNodeStatus}
                activeNodeId={stream.activeNodeId}
              />
            ) : (
              // The canvas reactively reseeds when the graph's structure changes
              // (load / rollback / add / delete), so no key-based remount is needed.
              <WorkflowCanvas
                graph={graph}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onGraphChange={setGraph}
                nodeSeverity={nodeSeverity}
              />
            )}
          </div>
          {!testExecutionId && (
            <NodeConfigPanel node={selectedNode} onChange={updateNode} onDelete={deleteNode} />
          )}
        </div>

        {/* Test-mode execution drawer streams node/message/var events (DESIGN_SYSTEM.md §8.4). */}
        {testExecutionId && (
          <div className="border-t border-border bg-surface">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm font-semibold text-text">
                {featureStrings.workflows.builder.executionDrawer}
              </span>
              <div className="flex items-center gap-3">
                {stream.state && (
                  <ExecutionControls executionId={testExecutionId} state={stream.state} />
                )}
                <button
                  type="button"
                  onClick={() => setTestExecutionId(null)}
                  aria-label={strings.actions.close}
                  className="focus-ring rounded-sm p-1 text-text-muted hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <ExecutionEventLog events={drawerEvents} height={200} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRollback}
        onClose={() => setConfirmRollback(false)}
        isLoading={rollbackWorkflow.isPending}
        onConfirm={async () => {
          const current = workflowQuery.data;
          if (!current || current.version <= 1) {
            setConfirmRollback(false);
            return;
          }
          const restored = await rollbackWorkflow.mutateAsync({
            id: current.id,
            version: current.version - 1,
          });
          // Reload the restored graph into the draft.
          setName(restored.name);
          setSupplierId(restored.supplierId ?? '');
          setGraph(restored.graph);
          setSelectedNodeId(null);
          setConfirmRollback(false);
        }}
        message={featureStrings.workflows.builder.rollbackConfirm}
      />
    </QueryBoundary>
  );
}

/** Rebuild WS-shaped log events from persisted execution steps (fallback when live is missed). */
function stepsToEvents(steps: ExecutionStepDto[]): WsEvent[] {
  const events: WsEvent[] = [];
  for (const step of steps) {
    const ts = Date.parse(step.ts) || 0;
    if (step.status === StepStatus.RUNNING) {
      events.push({
        type: WsEventType.STEP_ENTERED,
        executionId: '',
        ts,
        nodeId: step.nodeId,
        nodeType: step.nodeType,
        input: step.input,
      });
    } else {
      events.push({
        type: WsEventType.STEP_EXITED,
        executionId: '',
        ts,
        nodeId: step.nodeId,
        nodeType: step.nodeType,
        status: step.status,
        output: step.output,
        error: step.error,
        outPort: null,
        durationMs: 0,
      });
    }
  }
  return events;
}

/** Latest status per node from persisted steps, for lighting up the read-only canvas. */
function stepsToNodeStatus(steps: ExecutionStepDto[]): Record<string, StepStatusType> {
  const status: Record<string, StepStatusType> = {};
  for (const step of steps) status[step.nodeId] = step.status;
  return status;
}
