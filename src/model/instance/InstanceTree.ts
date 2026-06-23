import { type InstanceNode, childrenNamed, cloneNode } from './InstanceNode';
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

/**
 * Add a new repeat instance by cloning the template node (or first instance)
 * at the given path. Updates sibling multiplicities.
 *
 * Returns the newly added InstanceNode, or null if the path doesn't resolve.
 */
export function addRepeatInstance(tree: InstanceTree, ref: TreeReference): InstanceNode | null {
  // Navigate to the parent of the repeat path
  if (ref.levels.length === 0) return null;

  const parentRef = { ...ref, levels: ref.levels.slice(0, -1) };
  const lastLevel = ref.levels[ref.levels.length - 1]!;

  // Resolve parent
  const parent = resolveReference(tree, parentRef);
  if (parent === null) return null;

  // Find template or use first non-template instance as source
  const templateNode = parent.children.find(
    (c) => c.name === lastLevel.name && c.multiplicity === INDEX_TEMPLATE,
  ) ?? null;

  // Find existing non-template instances (for count/multiplicity)
  const instances = parent.children.filter(
    (c) => c.name === lastLevel.name && c.multiplicity !== INDEX_TEMPLATE,
  );

  const source = templateNode ?? instances[0];
  if (source === undefined) return null;

  // Clone source, assign next multiplicity
  const clone = cloneNode(source);
  clone.multiplicity = instances.length;
  clone.parent = parent;

  // Clear all child values to null (new instance starts empty)
  clearValues(clone);

  parent.children.push(clone);
  return clone;
}

/**
 * Recursively clear values on a node subtree (for new repeat instances).
 */
function clearValues(node: InstanceNode): void {
  node.value = null;
  for (const child of node.children) {
    clearValues(child);
  }
}

/**
 * Remove a specific repeat instance (identified by concrete positional ref).
 * Re-indexes remaining instances. Returns removed node or null if not found.
 */
export function removeRepeatInstance(tree: InstanceTree, ref: TreeReference): InstanceNode | null {
  if (ref.levels.length === 0) return null;

  const parentRef = { ...ref, levels: ref.levels.slice(0, -1) };
  const lastLevel = ref.levels[ref.levels.length - 1]!;
  const targetMultiplicity = lastLevel.multiplicity;

  const parent = resolveReference(tree, parentRef);
  if (parent === null) return null;

  // Find non-template instances
  const instances = parent.children.filter(
    (c) => c.name === lastLevel.name && c.multiplicity !== INDEX_TEMPLATE,
  );

  const target = targetMultiplicity >= 0 ? instances[targetMultiplicity] : null;
  if (target === null || target === undefined) return null;

  // Remove from parent.children array
  const childIdx = parent.children.indexOf(target);
  if (childIdx === -1) return null;
  parent.children.splice(childIdx, 1);
  target.parent = null;

  // Re-index remaining instances
  let idx = 0;
  for (const child of parent.children) {
    if (child.name === lastLevel.name && child.multiplicity !== INDEX_TEMPLATE) {
      child.multiplicity = idx++;
    }
  }

  return target;
}

/**
 * Count non-template repeat instances at the given path.
 */
export function countRepeatInstances(tree: InstanceTree, ref: TreeReference): number {
  if (ref.levels.length === 0) return 0;

  const parentRef = { ...ref, levels: ref.levels.slice(0, -1) };
  const lastLevel = ref.levels[ref.levels.length - 1]!;

  const parent = resolveReference(tree, parentRef);
  if (parent === null) return 0;

  return parent.children.filter(
    (c) => c.name === lastLevel.name && c.multiplicity !== INDEX_TEMPLATE,
  ).length;
}
