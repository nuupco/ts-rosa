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
 * Returns all matching InstanceNodes for the given reference, starting the
 * BFS from `subtreeRoot` instead of tree.root.
 *
 * `subtreeRoot` must correspond to a prefix of `ref.levels`. The function
 * computes the depth of `subtreeRoot` (by walking its parent chain) and uses
 * the remaining ref levels (the suffix) to expand within the subtree only.
 *
 * This avoids the full-tree BFS of resolveAll() when we only need nodes inside
 * a single concrete repeat instance. Returns the same nodes as resolveAll()
 * would, but restricted to descendants of subtreeRoot.
 *
 * Used by applyRecalculate in initializeRepeatInstance (Fix B: scope resolveAll
 * to subtreeRoot so the global walk is eliminated during repeat-instance init).
 */
export function resolveAllWithin(subtreeRoot: InstanceNode, ref: TreeReference): InstanceNode[] {
  // Compute depth of subtreeRoot from tree root (count parent hops)
  let depth = 0;
  let cur: InstanceNode | null = subtreeRoot;
  while (cur.parent !== null) { depth++; cur = cur.parent; }
  // depth == number of parent hops == index into ref.levels of subtreeRoot itself
  // The levels below subtreeRoot start at index (depth + 1)

  // Invariant guards — fall back to empty (caller already scoped to a subtree,
  // so an invariant violation means this ref simply does not resolve within it):
  //   (a) ref must have enough levels to include depth (i.e. it references the subtree)
  //   (b) subtreeRoot name must match ref.levels[depth] — otherwise wrong subtree
  //   (c) the anchor prefix levels (0..depth) in ref must NOT be concrete (INDEX_UNBOUND)
  //       — a concrete index in the ref itself means the ref is already fully resolved
  //       to a specific instance and does not need subtree-relative expansion.
  if (ref.levels.length <= depth) return [];
  const anchorLevel = ref.levels[depth]!;
  if (anchorLevel.name !== subtreeRoot.name && anchorLevel.name !== '*') return [];
  for (let i = 0; i < depth; i++) {
    const rl = ref.levels[i]!;
    // If ref has a concrete multiplicity in the anchor prefix that doesn't match the
    // actual path of subtreeRoot, we'd be resolving against the wrong instance.
    // Guard: if the ref is pinned to a specific concrete index in the prefix, verify
    // it matches the subtreeRoot's own multiplicity chain. Rather than walking the
    // full chain, take the conservative path: if any prefix level is concrete (not
    // INDEX_UNBOUND), we cannot guarantee it matches this subtreeRoot without walking
    // the parent chain — so fall back to resolveAll from the tree root (safe, slower).
    if (rl.multiplicity !== INDEX_UNBOUND) return [];
  }

  const suffixLevels = ref.levels.slice(depth + 1);
  if (suffixLevels.length === 0) {
    // ref points at the subtreeRoot itself
    return [subtreeRoot];
  }
  let currentNodes: InstanceNode[] = [subtreeRoot];
  for (const lvl of suffixLevels) {
    const nextNodes: InstanceNode[] = [];
    for (const node of currentNodes) {
      const candidates = childrenNamed(node, lvl.name).filter(
        (c) => c.multiplicity !== INDEX_TEMPLATE,
      );
      if (lvl.multiplicity === INDEX_UNBOUND) {
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
 * Resolve `ref` (which may have wildcard levels) scoped to the deepest concrete
 * ancestor shared with `changedRef`.
 *
 * This mirrors JavaRosa's Triggerable.contextualize: given a changed ref like
 * /data/household[9]/consent and a generic target like /data/household/child_repeat/field,
 * find the longest common concrete prefix (/data/household[9]), then expand only
 * the suffix (child_repeat/field) from that concrete ancestor node.
 *
 * Result is always a strict subset of what resolveAll(tree, ref) returns — only the
 * instances that share the same repeat-instance ancestors as changedRef. This is the
 * key to breaking the O(N²) cost in triggerTriggerables: instead of resolving ALL 108
 * child instances when answering a household-level field, we resolve only the 6 children
 * of the changed household.
 *
 * Falls back to full resolveAll when changedRef and ref share no concrete prefix
 * (e.g. the target is completely unrelated to the changed node's path).
 *
 * @param tree        The instance tree
 * @param ref         Generic target ref (the triggerable's target)
 * @param changedRef  Concrete changed ref (the trigger that fired the cascade)
 */
export function resolveAllContextualized(
  tree: InstanceTree,
  ref: TreeReference,
  changedRef: TreeReference,
): InstanceNode[] {
  // Find the deepest level index where ref and changedRef share the same name
  // AND changedRef has a concrete (non-wildcard) multiplicity.
  // At that point, the changedRef's concrete node IS the scope anchor.
  const refLevels = ref.levels;
  const changedLevels = changedRef.levels;
  const minLen = Math.min(refLevels.length, changedLevels.length);

  let anchorDepth = -1; // -1 means no shared concrete prefix found
  for (let i = 0; i < minLen; i++) {
    const rl = refLevels[i]!;
    const cl = changedLevels[i]!;
    if (rl.name !== cl.name) break;
    // changedRef is concrete at this level (specific index)
    if (cl.multiplicity !== INDEX_UNBOUND) {
      anchorDepth = i;
    }
  }

  if (anchorDepth < 0) {
    // No shared concrete prefix — fall back to full resolve
    return resolveAll(tree, ref);
  }

  // Invariant guards — fall back to global resolveAll when assumptions break:
  //   (c) anchor-prefix levels of changedRef (1..anchorDepth) must be concrete.
  //       Level 0 is the root and is conventionally INDEX_UNBOUND (there is only one
  //       root node, so the root is always "concrete" even though its multiplicity
  //       is stored as INDEX_UNBOUND). Skip i=0.
  for (let i = 1; i <= anchorDepth; i++) {
    if (changedLevels[i]!.multiplicity === INDEX_UNBOUND) {
      return resolveAll(tree, ref);
    }
  }
  //   (d) ref levels at/below the anchor depth should be generic (INDEX_UNBOUND)
  //       — a concrete multiplicity in `ref` (above level 0 root) means the ref is
  //       already fully pinned to a specific instance and contextualization is nonsensical.
  //       Skip i=0 (root is always INDEX_UNBOUND in generic refs too).
  for (let i = 1; i <= anchorDepth; i++) {
    if (i < refLevels.length && refLevels[i]!.multiplicity !== INDEX_UNBOUND) {
      return resolveAll(tree, ref);
    }
  }

  // Navigate to the anchor node using the concrete changedRef prefix
  // (levels 0..anchorDepth inclusive, all concrete from changedRef)
  const anchorLevels = changedLevels.slice(0, anchorDepth + 1);
  let anchorNode: InstanceNode | null = tree.root;
  // First level is root
  if (anchorLevels.length === 0) {
    anchorNode = tree.root;
  } else {
    const [first, ...rest] = anchorLevels;
    if (first === undefined || (tree.root.name !== first.name && first.name !== '*')) {
      return resolveAll(tree, ref);
    }
    anchorNode = tree.root;
    for (const lvl of rest) {
      const cur = anchorNode;
      const candidates: InstanceNode[] = childrenNamed(cur, lvl.name).filter(
        (c) => c.multiplicity !== INDEX_TEMPLATE,
      );
      const idx = lvl.multiplicity === INDEX_UNBOUND ? DEFAULT_MULTIPLICITY : lvl.multiplicity;
      const next = candidates[idx] ?? null;
      if (next === null) return [];
      anchorNode = next;
    }
  }

  if (anchorNode === null) return resolveAll(tree, ref);

  // anchorNode is at depth anchorDepth. The remaining suffix levels of ref
  // (levels anchorDepth+1 onward) define what to resolve within the anchor subtree.
  const suffixLevels = refLevels.slice(anchorDepth + 1);
  if (suffixLevels.length === 0) {
    return [anchorNode];
  }

  let currentNodes: InstanceNode[] = [anchorNode];
  for (const lvl of suffixLevels) {
    const nextNodes: InstanceNode[] = [];
    for (const node of currentNodes) {
      const candidates = childrenNamed(node, lvl.name).filter(
        (c) => c.multiplicity !== INDEX_TEMPLATE,
      );
      if (lvl.multiplicity === INDEX_UNBOUND) {
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
  let parent = resolveReference(tree, parentRef);
  if (parent === null && parentRef.levels.length > 0) {
    const gpRef = { ...parentRef, levels: parentRef.levels.slice(0, -1) };
    const gp = resolveReference(tree, gpRef);
    if (gp !== null) {
      const parentName = parentRef.levels[parentRef.levels.length - 1]!.name;
      const candidates = gp.children.filter(
        (c) => c.name === parentName && c.multiplicity !== INDEX_TEMPLATE,
      );
      parent = candidates[0] ?? null; // FIRST matching parent
    }
  }
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
