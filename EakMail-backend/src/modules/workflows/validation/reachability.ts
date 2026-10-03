/**
 * Reachability analysis over the graph: which nodes can be reached from START
 * by following edges. Used to flag dangling (unreachable) nodes.
 */
import type { GraphIndex } from './graph-index.js';

/** BFS from `startId`, returning the set of reachable node ids (including start). */
export function reachableFrom(startId: string, index: GraphIndex): Set<string> {
  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of index.outgoing.get(current) ?? []) {
      if (!visited.has(edge.to) && index.nodesById.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  return visited;
}
