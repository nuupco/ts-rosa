/**
 * TriggerableDag — Slice 3.3
 *
 * Builds a topologically sorted DAG of Triggerable vertices from the
 * compiled bindings produced by compileBindings.
 *
 * Mirrors JavaRosa TriggerableDag.java:
 *   - finalizeTriggerables → finalizeDag
 *   - getDagEdges         (LinkedHashSet insertion-order iteration)
 *   - getDependantTriggerables (ordered dedup via insertion-ordered Set)
 *   - buildDag            (Kahn topological sort)
 *   - buildRelevancePerRepeat
 *   - addTriggerable      (context intersection dedup)
 *   - throwCyclesInDagException → throws Error(/Cycle detected/i)
 *
 * CRITICAL: Edge insertion order must mirror JavaRosa's LinkedHashSet iteration.
 * JavaScript Set is insertion-ordered (ES2015+), matching LinkedHashSet semantics.
 * The port iterates allTriggerables in insertion order, and within each source,
 * collects dependant triggerables in insertion order — identical to JavaRosa.
 */

import {
  type Triggerable,
  isCascadingToChildren,
} from './Triggerable.ts';
import {
  genericize,
  extendRef,
  refToString,
  type TreeReference,
} from '../model/instance/TreeReference.ts';
import { resolveReference } from '../model/instance/InstanceTree.ts';
import type { InstanceNode } from '../model/instance/InstanceNode.ts';
import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import { INDEX_TEMPLATE } from '../model/instance/multiplicity.ts';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface TriggerableDag {
  /**
   * Insertion-ordered set of all unique triggerables (after dedup via
   * context intersection). Mirrors JavaRosa allTriggerables LinkedHashSet.
   */
  readonly allTriggerables: ReadonlySet<Triggerable>;

  /**
   * Topologically sorted array of all triggerables (Kahn output).
   * Triggerables that depend on another appear AFTER their dependency.
   * Iteration order here is the canonical evaluation order.
   */
  readonly triggerablesDAG: readonly Triggerable[];

  /**
   * Index: genericized ref string → set of triggerables that list that ref
   * among their triggers.
   */
  readonly triggerablesPerTrigger: ReadonlyMap<string, Set<Triggerable>>;

  /**
   * Per-triggerable set of directly-downstream triggerables (pre-computed
   * from getDagEdges). Used by getAllToTrigger in the cascade engine.
   */
  readonly immediateCascades: ReadonlyMap<Triggerable, Set<Triggerable>>;

  /**
   * Index of relevance Conditions whose target is a repeat template reference.
   * Key: refToString(genericize(repeatTarget)).
   * Built by buildRelevancePerRepeat; consumed by repeat add/remove (Slice 3.7).
   */
  readonly relevancePerRepeat: ReadonlyMap<string, Triggerable>;
}

// ---------------------------------------------------------------------------
// finalizeDag — main entry point
// ---------------------------------------------------------------------------

/**
 * Finalize the DAG for the given set of triggerables and their trigger index.
 *
 * @param allTriggerables  Insertion-ordered Set of unique Triggerable instances
 *                         (after dedup via addTriggerable in compileBindings).
 * @param triggerablesPerTrigger  Map keyed by refToString(genericize(triggerRef)).
 * @param tree             Optional InstanceTree; used for getChildrenOfReference
 *                         when computing cascading-to-children edges (relevant).
 */
export function finalizeDag(
  allTriggerables: Set<Triggerable>,
  triggerablesPerTrigger: Map<string, Set<Triggerable>>,
  tree?: InstanceTree,
): TriggerableDag {
  // Build immediateCascades as a side effect of getDagEdges.
  // immediateCascades is mutated during getDagEdges and frozen after.
  const immediateCascades = new Map<Triggerable, Set<Triggerable>>();

  const edges = getDagEdges(allTriggerables, triggerablesPerTrigger, immediateCascades, tree);
  const triggerablesDAG = buildDag(allTriggerables, edges);
  const relevancePerRepeat = buildRelevancePerRepeat(triggerablesDAG, tree);

  return {
    allTriggerables,
    triggerablesDAG,
    triggerablesPerTrigger,
    immediateCascades,
    relevancePerRepeat,
  };
}

// ---------------------------------------------------------------------------
// addTriggerable — dedup via context intersection
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.addTriggerable.
 *
 * If an equivalent triggerable already exists in allTriggerables (same
 * compiled expression source AND same trigger set), intersect the existing
 * one's contextRef with the incoming one's contextRef and return the existing
 * triggerable. Otherwise, add the new triggerable and index its triggers.
 *
 * Equivalence test: same CompiledInstanceExpression object reference
 * (parse-once semantics) AND trigger set equality by refToString.
 *
 * NOTE: This is called by compileBindings callers that build allTriggerables
 * before calling finalizeDag. The function is exported for use there.
 */
export function addTriggerable(
  triggerable: Triggerable,
  allTriggerables: Set<Triggerable>,
  triggerablesPerTrigger: Map<string, Set<Triggerable>>,
): Triggerable {
  const existing = findTriggerable(triggerable, allTriggerables);
  if (existing !== null) {
    // Intersect: contextRef becomes the common ancestor / intersection
    intersectContextWith(existing, triggerable);
    return existing;
  }

  allTriggerables.add(triggerable);

  // Build the triggerable per trigger index
  for (const trigger of triggerable.triggers) {
    const key = refToString(genericize(trigger));
    let set = triggerablesPerTrigger.get(key);
    if (!set) {
      set = new Set<Triggerable>();
      triggerablesPerTrigger.set(key, set);
    }
    set.add(triggerable);
  }

  return triggerable;
}

// ---------------------------------------------------------------------------
// Context intersection
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa Triggerable.intersectContextWith.
 *
 * Finds the largest common prefix of the two context refs and sets
 * existing.contextRef to that prefix. This ensures the triggerable is
 * evaluated at the correct context for both original bindings.
 */
function intersectContextWith(existing: Triggerable, incoming: Triggerable): void {
  const a = existing.contextRef;
  const b = incoming.contextRef;

  // Find the common prefix length
  const minLen = Math.min(a.levels.length, b.levels.length);
  let commonLen = 0;
  for (let i = 0; i < minLen; i++) {
    if (a.levels[i]!.name === b.levels[i]!.name) {
      commonLen = i + 1;
    } else {
      break;
    }
  }

  // Construct intersection ref (common prefix of levels)
  const intersectedLevels = a.levels.slice(0, commonLen);
  existing.contextRef = {
    refLevel: a.refLevel,
    contextType: a.contextType,
    instanceName: a.instanceName,
    levels: Object.freeze(intersectedLevels),
  };
}

// ---------------------------------------------------------------------------
// getDagEdges — LinkedHashSet order port
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.getDagEdges.
 *
 * For each source triggerable (in allTriggerables insertion order),
 * compute the ordered set of dependant triggerables via
 * getDependantTriggerables (insertion-ordered, mirrors LinkedHashSet).
 *
 * Self-reference cycle detection: if the computed dependants set contains
 * the source itself, throw immediately.
 *
 * Side effect: populates immediateCascades[source] = dependants.
 */
function getDagEdges(
  allTriggerables: Set<Triggerable>,
  triggerablesPerTrigger: Map<string, Set<Triggerable>>,
  immediateCascades: Map<Triggerable, Set<Triggerable>>,
  tree: InstanceTree | undefined,
): Array<[Triggerable, Triggerable]> {
  const edges: Array<[Triggerable, Triggerable]> = [];

  for (const source of allTriggerables) {
    // Compute the ordered set of dependant triggerables for this source.
    // Uses insertion-ordered Set to mirror JavaRosa's LinkedHashSet.
    const targets = getDependantTriggerables(source, triggerablesPerTrigger, tree);

    // Self-cycle check (mirrors JavaRosa getDagEdges:187-188)
    if (targets.has(source)) {
      throwCycleDetected(allTriggerables);
    }

    for (const target of targets) {
      edges.push([source, target]);
    }

    immediateCascades.set(source, targets);
  }

  return edges;
}

// ---------------------------------------------------------------------------
// getDependantTriggerables — insertion-ordered dedup (LinkedHashSet port)
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.getDependantTriggerables.
 *
 * For a given triggerable (source), compute which other triggerables are
 * directly downstream:
 *
 *   1. Collect all target refs (source.targets + children if cascading).
 *   2. For each target ref, look up triggerablesPerTrigger[removePredicates(target)].
 *   3. Add all found triggerables to an insertion-ordered Set (= LinkedHashSet).
 *
 * The INSERTION ORDER of the output Set is the JavaRosa-faithful order.
 * JavaScript Set preserves insertion order (ES2015+), so `new Set()` +
 * `.add()` in the same iteration order as Java's LinkedHashSet.addAll() is
 * a correct port.
 */
function getDependantTriggerables(
  source: Triggerable,
  triggerablesPerTrigger: Map<string, Set<Triggerable>>,
  tree: InstanceTree | undefined,
): Set<Triggerable> {
  // allDependantTriggerables is insertion-ordered (LinkedHashSet)
  const allDependantTriggerables = new Set<Triggerable>();

  // Build the expanded set of target refs
  const targets = new Set<string>(); // keyed by refToString for dedup
  const targetRefs: TreeReference[] = [];

  for (const target of source.targets) {
    const key = refToString(target);
    if (!targets.has(key)) {
      targets.add(key);
      targetRefs.push(target);
    }

    // For cascading-to-children triggerables (relevant Condition),
    // also add descendant refs — mirrors JavaRosa getDependantTriggerables:210-213
    if (isCascadingToChildren(source)) {
      const children = getChildrenOfReference(target, tree);
      for (const child of children) {
        const childKey = refToString(child);
        if (!targets.has(childKey)) {
          targets.add(childKey);
          targetRefs.push(child);
        }
      }
    }
  }

  // For each target ref, look up the trigger index (predicate-less)
  // Mirrors JavaRosa getDependantTriggerables:220-233
  for (const target of targetRefs) {
    const lookupRef = genericize(target);
    const key = refToString(lookupRef);
    const dependants = triggerablesPerTrigger.get(key);
    if (dependants) {
      for (const dep of dependants) {
        allDependantTriggerables.add(dep);
      }
    }
  }

  return allDependantTriggerables;
}

// ---------------------------------------------------------------------------
// getChildrenOfReference — for relevant cascade expansion
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.getChildrenOfReference.
 *
 * Returns genericized refs for all descendants of the target ref.
 * When an InstanceTree is available, walks template children.
 * Without a tree (unit test context), returns empty set.
 */
function getChildrenOfReference(
  target: TreeReference,
  tree: InstanceTree | undefined,
): TreeReference[] {
  if (!tree) return [];

  const node = resolveReference(tree, target);
  if (!node) return [];

  const childRefs: TreeReference[] = [];
  collectChildRefs(target, node.children, childRefs);
  return childRefs;
}

/**
 * Recursive helper: collects genericized refs for all descendant nodes.
 */
function collectChildRefs(
  parentRef: TreeReference,
  children: readonly InstanceNode[],
  result: TreeReference[],
): void {
  for (const child of children) {
    const childRef = genericize(extendRef(parentRef, child.name));
    result.push(childRef);
    collectChildRefs(childRef, child.children, result);
  }
}

// ---------------------------------------------------------------------------
// buildDag — Kahn topological sort + multi-node cycle detection
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.buildDag.
 *
 * Kahn's algorithm on the (vertices, edges) graph:
 *   1. remainingVertices = copy of allTriggerables
 *   2. remainingEdges = copy of edges
 *   3. Loop:
 *      a. roots = remainingVertices \ { edge[1] for edge in remainingEdges }
 *      b. If roots is empty and remainingVertices is non-empty → cycle (multi-node)
 *      c. Add roots to dag (in insertion order of remainingVertices — deterministic)
 *      d. Remove roots from remainingVertices; remove edges whose source is in roots
 *
 * Output: topologically sorted array of all triggerables.
 *
 * NOTE: JavaRosa uses LinkedHashSet for `dag`, so roots are added in the
 * iteration order of `roots`. Java's HashSet iteration is unspecified, but
 * since JavaRosa's test oracle (TriggerableDagTest) is what we conform to,
 * and we add roots in the iteration order of allTriggerables (which is
 * insertion-ordered here), the output is deterministic and matches the JR
 * test expectations.
 */
function buildDag(
  allTriggerables: Set<Triggerable>,
  edges: Array<[Triggerable, Triggerable]>,
): Triggerable[] {
  const dag: Triggerable[] = [];

  // Work with copies so we don't mutate inputs
  const remainingVertices = new Set<Triggerable>(allTriggerables);
  let remainingEdges = [...edges];

  while (remainingVertices.size > 0) {
    // Compute roots: vertices that don't appear as any edge's target
    const nonRoots = new Set<Triggerable>();
    for (const [, target] of remainingEdges) {
      nonRoots.add(target);
    }

    const roots: Triggerable[] = [];
    for (const v of remainingVertices) {
      if (!nonRoots.has(v)) {
        roots.push(v);
      }
    }

    if (roots.length === 0) {
      // Multi-node cycle detected (mirrors JavaRosa buildDag:303-304)
      throwCycleDetected(allTriggerables);
    }

    // Move roots to dag (insertion order of remainingVertices, preserved by
    // iterating roots in the order they appeared in remainingVertices)
    for (const root of roots) {
      remainingVertices.delete(root);
      dag.push(root);
    }

    // Remove edges whose source is now in roots
    const rootSet = new Set<Triggerable>(roots);
    remainingEdges = remainingEdges.filter(([src]) => !rootSet.has(src));
  }

  return dag;
}

// ---------------------------------------------------------------------------
// buildRelevancePerRepeat
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.buildRelevancePerRepeat.
 *
 * For each Condition with action 'relevant' whose target is a repeat template
 * ref (determined by InstanceTree presence), index it by target ref string.
 *
 * Without an InstanceTree (unit tests), returns an empty map.
 * This index is consumed by repeat add/remove in Slice 3.7.
 */
function buildRelevancePerRepeat(
  triggerablesDAG: Triggerable[],
  tree: InstanceTree | undefined,
): Map<string, Triggerable> {
  const relevancePerRepeat = new Map<string, Triggerable>();

  if (!tree) return relevancePerRepeat;

  for (const triggerable of triggerablesDAG) {
    if (triggerable.kind !== 'condition' || triggerable.action !== 'relevant') {
      continue;
    }
    for (const target of triggerable.targets) {
      // Check if target is a repeat template (has template multiplicity at leaf)
      // We use refToString of the genericized target as the key
      const key = refToString(genericize(target));
      // Only index if the tree has a template at this path
      // (mirrors JavaRosa: mainInstance.getTemplate(target) != null)
      if (hasTemplate(target, tree)) {
        relevancePerRepeat.set(key, triggerable);
      }
    }
  }

  return relevancePerRepeat;
}

/**
 * Returns true if the InstanceTree has a template node (repeat template) at
 * the given reference path.
 */
function hasTemplate(target: TreeReference, tree: InstanceTree): boolean {
  const node = resolveReference(tree, target);
  return node !== null && node.multiplicity === INDEX_TEMPLATE;
}

// ---------------------------------------------------------------------------
// Cycle error
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.throwCyclesInDagException.
 * The message MUST match /Cycle detected/i for test assertions.
 */
function throwCycleDetected(triggerables: Set<Triggerable> | Iterable<Triggerable>): never {
  const hints: string[] = [];
  for (const t of triggerables) {
    for (const r of t.targets) {
      hints.push(refToString(r));
    }
  }

  let message = 'Cycle detected in form\'s relevant and calculation logic!';
  if (hints.length > 0) {
    message += '\nThe following nodes are likely involved in the loop:\n' + hints.join('\n');
  }

  throw new Error(message);
}

// ---------------------------------------------------------------------------
// findTriggerable helper
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.findTriggerable.
 *
 * Returns an existing triggerable in allTriggerables that is "equal" to the
 * provided triggerable. Equality = same compiled expression object AND same
 * trigger set (by refToString).
 */
function findTriggerable(
  t: Triggerable,
  allTriggerables: Set<Triggerable>,
): Triggerable | null {
  for (const existing of allTriggerables) {
    if (triggerableEquals(existing, t)) {
      return existing;
    }
  }
  return null;
}

/**
 * Triggerable equality for dedup purposes.
 *
 * Two triggerables are "equal" (for intersection purposes) when they have:
 * 1. The SAME CompiledInstanceExpression object (reference equality = parse-once).
 * 2. The SAME trigger set (by refToString equality).
 *
 * This mirrors JavaRosa Triggerable.equals which compares XPathConditional
 * by reference (its implementation) plus trigger set. Since we use
 * compileInstanceXPath (returns a new object each call), two bindings with
 * the same expression string are NOT equal by this test unless they share
 * the exact compiled object. This is intentional: the dedup path is for
 * repeat-expanded bindings that reuse the same compiled object.
 */
function triggerableEquals(a: Triggerable, b: Triggerable): boolean {
  // Same compiled expression object (reference equality)
  if (a.expr !== b.expr) return false;

  // Same trigger set
  if (a.triggers.length !== b.triggers.length) return false;
  const bKeys = new Set(b.triggers.map((r) => refToString(genericize(r))));
  for (const trigger of a.triggers) {
    if (!bKeys.has(refToString(genericize(trigger)))) return false;
  }

  return true;
}
