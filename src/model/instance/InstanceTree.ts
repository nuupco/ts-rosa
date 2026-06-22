import { type InstanceNode, childrenNamed } from './InstanceNode';
import { INDEX_TEMPLATE, INDEX_UNBOUND, DEFAULT_MULTIPLICITY } from './multiplicity';
import type { TreeReference } from './TreeReference';

export type InstanceTree = {
  readonly root: InstanceNode;
  readonly name: string | null;
};

/**
 * Resolves an absolute TreeReference to an InstanceNode.
 *
 * Resolution rules (per design §3 / resolveReference flow):
 * - Walk tree.root level-by-level matching level.name.
 * - TEMPLATE nodes are skipped (filtered out before index selection).
 * - INDEX_UNBOUND (-1) → use DEFAULT_MULTIPLICITY (0) = first instance.
 * - Concrete index >= 0 → pick that positional same-name sibling.
 * - Returns null if any level fails to match.
 */
export function resolveReference(tree: InstanceTree, ref: TreeReference): InstanceNode | null {
  if (ref.levels.length === 0) return tree.root;

  const [firstLevel, ...restLevels] = ref.levels;
  if (firstLevel === undefined) return tree.root;

  // The first level matches the root node itself by name
  if (tree.root.name !== firstLevel.name && firstLevel.name !== '*') return null;
  let node: InstanceNode = tree.root;

  for (const lvl of restLevels) {
    const candidates = childrenNamed(node, lvl.name).filter(
      (c) => c.multiplicity !== INDEX_TEMPLATE,
    );
    const idx = lvl.multiplicity === INDEX_UNBOUND ? DEFAULT_MULTIPLICITY : lvl.multiplicity;
    const next = candidates[idx] ?? null;
    if (next === null) return null;
    node = next;
  }

  return node;
}

/**
 * Returns all matching InstanceNodes for the given reference.
 * When multiplicity is INDEX_UNBOUND, returns ALL same-name children (wildcard expansion).
 */
export function resolveAll(tree: InstanceTree, ref: TreeReference): InstanceNode[] {
  if (ref.levels.length === 0) return [tree.root];

  const [firstLevel, ...restLevels] = ref.levels;
  if (firstLevel === undefined) return [tree.root];

  // The first level matches the root node itself
  if (tree.root.name !== firstLevel.name && firstLevel.name !== '*') return [];
  let currentNodes: InstanceNode[] = [tree.root];

  for (const lvl of restLevels) {
    const nextNodes: InstanceNode[] = [];
    for (const node of currentNodes) {
      const candidates = childrenNamed(node, lvl.name).filter(
        (c) => c.multiplicity !== INDEX_TEMPLATE,
      );
      if (lvl.multiplicity === INDEX_UNBOUND) {
        // Wildcard — collect all matching children
        nextNodes.push(...candidates);
      } else {
        const match = candidates[lvl.multiplicity] ?? null;
        if (match !== null) nextNodes.push(match);
      }
    }
    currentNodes = nextNodes;
  }

  return currentNodes;
}
