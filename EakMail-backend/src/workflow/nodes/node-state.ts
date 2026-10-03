/**
 * Per-node iteration/attempt state stored inside the execution variables under a
 * reserved `__nodeState` namespace. Kept out of the user-visible variable space and
 * checkpointed with the rest of `variables`, so LOOP/RETRY/TIMEOUT survive resume.
 */
const NS = '__nodeState';

interface NodeStateBag {
  [nodeId: string]: Record<string, number> | undefined;
}

function bag(vars: Record<string, unknown>): NodeStateBag {
  let ns = vars[NS] as NodeStateBag | undefined;
  if (!ns || typeof ns !== 'object') {
    ns = {};
    vars[NS] = ns;
  }
  return ns;
}

export function getNodeCounter(
  vars: Record<string, unknown>,
  nodeId: string,
  key: string,
): number {
  return bag(vars)[nodeId]?.[key] ?? 0;
}

export function setNodeCounter(
  vars: Record<string, unknown>,
  nodeId: string,
  key: string,
  value: number,
): void {
  const ns = bag(vars);
  const node = ns[nodeId] ?? (ns[nodeId] = {});
  node[key] = value;
}

export function resetNodeState(vars: Record<string, unknown>, nodeId: string): void {
  const ns = bag(vars);
  delete ns[nodeId];
}
