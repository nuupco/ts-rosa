/**
 * FormEvaluator — Slice 3.1 skeleton + Slice 3.4 cascade engine + Slice 3.5 Condition/relevance.
 *
 * Responsibilities:
 *   - Evaluate XPath expressions over an InstanceTree via InstanceEvaluator
 *   - Manage reactive cascade (triggerTriggerables) via TriggerableDag
 *   - Manage NodeState per bound node (Slice 3.5)
 *   - Wire answerQuestion + validate()
 *
 * Slice 3.5 adds:
 *   - NodeState map keyed by refToString(genericize(ref))
 *   - OpaqueReactiveObjectFactory injection (default: identity)
 *   - Condition evaluation in initializeInstance and triggerTriggerables
 *   - isEffectivelyRelevant(ref): ancestor walk
 *   - relevanceOf closure injected into adapter via setActiveRelevanceCheck
 */

import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import type { InstanceNode } from '../model/instance/InstanceNode.ts';
import {
  makeInstanceDocumentNode,
  wrapInstanceNode,
  setActiveRelevanceCheck,
} from '../xpath/adapter/instance/InstanceNodeXPathAdapter.ts';
import type {
  InstanceDocumentNode,
  InstanceXPathNode,
} from '../xpath/adapter/instance/InstanceXPathNode.ts';
import {
  instanceEvaluator,
  type InstanceEvaluationContext,
} from '../xpath/evaluator/InstanceEvaluator.ts';
import { XPATH_EVALUATION_RESULT } from '../xpath/vendor/xpath/evaluator/result/XPathEvaluationResult.ts';
import type { CompiledInstanceExpression } from '../xpath/seam/XPathSeam.ts';
import type { TriggerableDag } from '../eval/TriggerableDag.ts';
import type { Triggerable } from '../eval/Triggerable.ts';
import type { TreeReference } from '../model/instance/TreeReference.ts';
import { genericize, refToString, parentOf, parseAbsoluteRef } from '../model/instance/TreeReference.ts';
import { resolveReference } from '../model/instance/InstanceTree.ts';
import { cast } from '../model/data/codecs.ts';
import type { AnswerValue } from '../model/data/AnswerValue.ts';
import { type NodeState, defaultNodeState } from '../model/state/NodeState.ts';
import {
  type OpaqueReactiveObjectFactory,
  identityReactiveFactory,
} from '../platform/ReactiveObjectFactory.ts';
import type { CompiledBinding } from '../parse/bindProcessor2.ts';
import { AnswerResult } from './AnswerResult.ts';

// ---------------------------------------------------------------------------
// ValidateOutcome — internal engine type (not Scenario harness type)
// ---------------------------------------------------------------------------

/**
 * Result of a full-form validation sweep.
 * Mirrors JavaRosa ValidateOutcome — null means the form is valid.
 */
export interface ValidateOutcome {
  /** The absolute path (nodeset) of the first field that failed validation. */
  readonly failedNodeset: string;
  /** The reason for failure. */
  readonly status: AnswerResult.REQUIRED_BUT_EMPTY | AnswerResult.CONSTRAINT_VIOLATED;
}

export class FormEvaluator {
  private readonly tree: InstanceTree;
  private readonly docNode: InstanceDocumentNode;
  /** Reactive DAG — set by initializeInstance; null until a form with bindings is loaded. */
  private dag: TriggerableDag | null = null;

  /** NodeState per bound node — keyed by refToString(genericize(ref)). */
  private readonly nodeStates: Map<string, NodeState> = new Map();

  /** Factory for creating reactive node state objects (default: identity). */
  private readonly factory: OpaqueReactiveObjectFactory;

  /**
   * Compiled constraint expressions, keyed by nodeset string (e.g. "/data/a").
   * Set by initializeInstance from the FormDefinition.constraintBindings.
   */
  private constraintBindings: ReadonlyMap<string, CompiledBinding> = new Map();

  constructor(tree: InstanceTree, factory?: OpaqueReactiveObjectFactory) {
    this.tree = tree;
    this.docNode = makeInstanceDocumentNode(tree);
    this.factory = factory ?? identityReactiveFactory;
  }

  // ---------------------------------------------------------------------------
  // NodeState management
  // ---------------------------------------------------------------------------

  /**
   * Get or create NodeState for a genericized ref key.
   */
  private getOrCreateState(key: string): NodeState {
    let state = this.nodeStates.get(key);
    if (state === undefined) {
      state = this.factory(defaultNodeState());
      this.nodeStates.set(key, state);
    }
    return state;
  }

  /**
   * Return the effective relevance of a ref: own relevant AND all ancestors relevant.
   *
   * Mirrors JavaRosa TriggerableDag isEffectivelyRelevant — walks the ref's
   * parent chain consulting own NodeState.relevant for each ancestor.
   */
  isEffectivelyRelevant(ref: TreeReference): boolean {
    // Walk from the ref upward, checking NodeState.relevant at each level
    let current: TreeReference = ref;
    while (current.levels.length > 0) {
      const key = refToString(genericize(current));
      const state = this.nodeStates.get(key);
      // If no state exists, assume relevant (no binding = no relevance expression)
      if (state !== undefined && !state.relevant) {
        return false;
      }
      current = parentOf(current);
    }
    return true;
  }

  /**
   * Get the NodeState for a ref (by genericized key). Returns undefined if not found.
   */
  getNodeState(ref: TreeReference): NodeState | undefined {
    return this.nodeStates.get(refToString(genericize(ref)));
  }

  // ---------------------------------------------------------------------------
  // Slice 3.1 — XPath evaluation primitives
  // ---------------------------------------------------------------------------

  /**
   * Build an InstanceEvaluationContext for a given context InstanceNode.
   * When contextNode is null/undefined the document root is used.
   */
  private makeContext(
    contextNode?: InstanceNode | null,
  ): InstanceEvaluationContext {
    const ctxWrapper: InstanceXPathNode =
      contextNode != null
        ? wrapInstanceNode(contextNode, this.docNode)
        : wrapInstanceNode(this.tree.root, this.docNode);

    return {
      instanceRoot: this.docNode,
      contextNode: ctxWrapper,
    };
  }

  /**
   * Evaluate an XPath expression string over the InstanceTree.
   *
   * Returns a primitive (string | number | boolean) or the first node's
   * string-value when the result is a nodeset.
   */
  evaluateOnInstance(
    expr: string,
    contextNode?: InstanceNode | null,
  ): string | number | boolean {
    const ctx = this.makeContext(contextNode);
    const result = instanceEvaluator.evaluate(
      expr,
      ctx.contextNode,
      null,
      XPATH_EVALUATION_RESULT.ANY_TYPE,
    );

    switch (result.resultType) {
      case XPATH_EVALUATION_RESULT.BOOLEAN_TYPE:
        return result.booleanValue;
      case XPATH_EVALUATION_RESULT.NUMBER_TYPE:
        return result.numberValue;
      case XPATH_EVALUATION_RESULT.STRING_TYPE:
        return result.stringValue;
      default: {
        // Nodeset: return first node's string-value or empty string
        const first = result.iterateNext();
        if (first === null) return '';
        return instanceEvaluator.evaluate(
          'string(.)',
          first,
          null,
          XPATH_EVALUATION_RESULT.STRING_TYPE,
        ).stringValue;
      }
    }
  }

  /**
   * Evaluate a pre-compiled instance expression with the active relevance closure.
   * Used by the DAG-based cascade.
   */
  evaluateCompiled(
    compiled: CompiledInstanceExpression,
    contextNode?: InstanceNode | null,
  ): string | number | boolean {
    const ctx = this.makeContext(contextNode);

    // Inject the relevance closure into the adapter so non-relevant nodes return ''
    setActiveRelevanceCheck((node: InstanceXPathNode) => {
      if (node.kind !== 'element') return true;
      // Build a minimal ref for this node by walking parents
      const nodeRef = this.nodeToRef(node);
      if (nodeRef === null) return true;
      return this.isEffectivelyRelevant(nodeRef);
    });

    let result: ReturnType<typeof compiled.evaluate>;
    try {
      result = compiled.evaluate(ctx);
    } finally {
      setActiveRelevanceCheck(null);
    }

    if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
      return result;
    }
    // Nodeset
    const nodes = result as readonly InstanceXPathNode[];
    if (nodes.length === 0) return '';
    const first = nodes[0];
    if (first === undefined) return '';
    return instanceEvaluator.evaluate(
      'string(.)',
      first,
      null,
      XPATH_EVALUATION_RESULT.STRING_TYPE,
    ).stringValue;
  }

  /**
   * Derive a TreeReference from an InstanceXPathNode by walking its parent chain.
   * Returns null if the node cannot be mapped (e.g. document node).
   */
  private nodeToRef(node: InstanceXPathNode): TreeReference | null {
    if (node.kind !== 'element') return null;
    // Build path segments from root down to this node
    const segments: string[] = [];
    let current: InstanceNode | null = node.node;
    while (current !== null) {
      segments.unshift(current.name);
      current = current.parent;
    }
    // segments[0] is the root name; build absolute TreeReference
    return parseAbsoluteRef('/' + segments.join('/'));
  }

  /** Expose the document node for callers that need to build their own contexts. */
  getDocumentNode(): InstanceDocumentNode {
    return this.docNode;
  }

  /** Wrap an InstanceNode into an InstanceXPathNode for use in evaluations. */
  wrap(node: InstanceNode): InstanceXPathNode {
    return wrapInstanceNode(node, this.docNode);
  }

  // ---------------------------------------------------------------------------
  // Slice 3.4 — reactive cascade engine
  // ---------------------------------------------------------------------------

  /**
   * Initialize all triggerables in topological DAG order.
   *
   * Mirrors JavaRosa TriggerableDag.initializeTriggerables (FormDef.java:447-466).
   * Called once at session creation to bring the instance to steady state.
   *
   * Slice 3.5: also initializes NodeState for all bound nodes, and evaluates
   * all Conditions (relevant/required/readonly) to set initial NodeState.
   */
  initializeInstance(dag: TriggerableDag, constraintBindings?: ReadonlyMap<string, CompiledBinding>): void {
    this.dag = dag;
    if (constraintBindings !== undefined) {
      this.constraintBindings = constraintBindings;
    }

    // Pre-create NodeState for all targets in the DAG
    for (const triggerable of dag.triggerablesDAG) {
      for (const target of triggerable.targets) {
        const key = refToString(genericize(target));
        this.getOrCreateState(key);
      }
    }

    // Evaluate all triggerables in topological order
    for (const triggerable of dag.triggerablesDAG) {
      if (triggerable.kind === 'recalculate') {
        this.applyRecalculate(triggerable, null);
      } else if (triggerable.kind === 'condition') {
        this.applyCondition(triggerable, null);
      }
    }
  }

  /**
   * Write a value to the InstanceNode at ref, then trigger the reactive cascade.
   *
   * Mirrors JavaRosa FormDef.setValue + triggerTriggerables.
   * Option A: there is NO parallel DOM — the InstanceTree is the sole data store.
   */
  setValue(ref: TreeReference, value: AnswerValue | null): void {
    const node = resolveReference(this.tree, ref);
    if (node !== null) {
      node.value = value;
    }
  }

  /**
   * Trigger the cascade for a changed ref.
   *
   * Algorithm (mirrors JavaRosa TriggerableDag.triggerTriggerables):
   *   1. genericize changedRef → look up triggerablesPerTrigger
   *   2. Expand all downstream triggerables transitively via immediateCascades
   *   3. Iterate triggerablesDAG IN ORDER; evaluate only those in the toTrigger set
   *
   * @param changedRef  The ref that changed (used for lookup and context).
   * @param dag         Optional override dag. Defaults to the stored dag.
   */
  triggerTriggerables(changedRef: TreeReference, dag?: TriggerableDag | null): void {
    const activeDag = dag !== undefined ? dag : this.dag;
    if (activeDag === null) return;
    const useDag = activeDag;

    const genericRef = genericize(changedRef);
    const key = refToString(genericRef);
    const cascadeRoots = useDag.triggerablesPerTrigger.get(key);
    if (!cascadeRoots || cascadeRoots.size === 0) return;

    const toTrigger = getAllToTrigger(cascadeRoots, useDag.immediateCascades);

    const alreadyEvaluated = new Set<Triggerable>();
    for (const triggerable of useDag.triggerablesDAG) {
      if (!toTrigger.has(triggerable)) continue;
      if (alreadyEvaluated.has(triggerable)) continue;

      if (triggerable.kind === 'recalculate') {
        this.applyRecalculate(triggerable, changedRef);
      } else if (triggerable.kind === 'condition') {
        this.applyCondition(triggerable, changedRef);
      }

      alreadyEvaluated.add(triggerable);
    }
  }

  /**
   * Evaluate a Recalculate triggerable and write the result to its target nodes.
   *
   * Context selection mirrors JavaRosa Recalculate.apply:
   *   - contextNode = the target node (resolved from triggerable.originalContextRef
   *     contextualized against changedRef when provided).
   *   - Result is coerced to target node's dataType via cast(dataType, string(result)).
   *
   * Slice 3.5: if the target node's parent(s) are non-relevant, effective value
   * is '' — but we still compute and write (JavaRosa: calculates fire even inside
   * non-relevant groups; only descendant nodes that depend on a non-relevant node
   * see '' via the relevanceOf closure).
   */
  private applyRecalculate(t: Triggerable & { kind: 'recalculate' }, changedRef: TreeReference | null): void {
    for (const target of t.targets) {
      const targetNode = resolveReference(this.tree, target);
      if (targetNode === null) continue;

      const rawResult = this.evaluateCompiled(t.expr, targetNode);

      const rawString = typeof rawResult === 'string'
        ? rawResult
        : typeof rawResult === 'number'
          ? String(rawResult)
          : rawResult
            ? '1'
            : '0';

      const coerced = cast(targetNode.dataType, rawString);
      targetNode.value = coerced;
    }
  }

  /**
   * Evaluate a Condition triggerable and update NodeState for its target nodes.
   *
   * Mirrors JavaRosa Condition.apply (Condition.java).
   * Action semantics:
   *   relevant  → state.relevant = boolean(result); then propagate inherited relevance
   *   required  → state.required = boolean(result)
   *   readonly  → state.readonly = boolean(result); state.enabled = !state.readonly
   *
   * After updating own relevant, propagates inherited relevance to descendants
   * (ancestor walk semantics: a node is non-relevant if any ancestor is non-relevant).
   */
  private applyCondition(t: Triggerable & { kind: 'condition' }, changedRef: TreeReference | null): void {
    for (const target of t.targets) {
      const targetNode = resolveReference(this.tree, target);
      if (targetNode === null) continue;

      const rawResult = this.evaluateCompiled(t.expr, targetNode);
      const boolResult = toBoolean(rawResult);

      const key = refToString(genericize(target));
      const state = this.getOrCreateState(key);

      switch (t.action) {
        case 'relevant':
          state.relevant = boolResult;
          // Propagate inherited relevance through descendants
          this.propagateRelevanceToDescendants(targetNode);
          break;
        case 'required':
          state.required = boolResult;
          break;
        case 'readonly':
          state.readonly = boolResult;
          state.enabled = !boolResult;
          break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Slice 3.6 — Constraint validation + answerQuestion + validate()
  // ---------------------------------------------------------------------------

  /**
   * Answer a question with constraint checking.
   *
   * Algorithm (mirrors JavaRosa FormEntryController.answerQuestion):
   *   1. If value is non-null AND a constraint binding exists for ref:
   *      evaluate constraint in context of ref; if false → CONSTRAINT_VIOLATED (no commit).
   *   2. Empty/null value → constraint always satisfied (skip eval).
   *   3. setValue(ref, value) + triggerTriggerables(ref).
   *   4. Return OK.
   */
  answerQuestion(ref: TreeReference, value: AnswerValue | null): AnswerResult {
    const nodeset = refToString(ref);
    const constraintCb = this.constraintBindings.get(nodeset);

    // Non-null value with a constraint → evaluate constraint
    if (value !== null && constraintCb !== undefined) {
      const targetNode = resolveReference(this.tree, ref);
      if (targetNode !== null) {
        // Temporarily set value so "." evaluates to the candidate value
        const previousValue = targetNode.value;
        targetNode.value = value;
        let constraintResult: string | number | boolean;
        try {
          constraintResult = this.evaluateCompiled(constraintCb.expr, targetNode);
        } finally {
          // Restore previous value (we do NOT commit if constraint fails)
          targetNode.value = previousValue;
        }
        if (!toBoolean(constraintResult)) {
          return AnswerResult.CONSTRAINT_VIOLATED;
        }
      }
    }

    // Constraint satisfied (or empty value) → commit
    this.setValue(ref, value);
    this.triggerTriggerables(ref);
    return AnswerResult.OK;
  }

  /**
   * Full-form validation sweep.
   *
   * Mirrors JavaRosa TriggerableDag.validate() (TriggerableDag.java:409-439).
   * Iterates all bindings in the NodeState map order, checking:
   *   1. effectivelyRelevant && required && value empty → REQUIRED_BUT_EMPTY
   *   2. non-null value && constraint binding exists → eval constraint → CONSTRAINT_VIOLATED
   *
   * Returns the first failure, or null if the form is valid.
   */
  validate(
    allNodesets: readonly string[],
  ): ValidateOutcome | null {
    for (const nodeset of allNodesets) {
      const ref = parseAbsoluteRef(nodeset);
      const node = resolveReference(this.tree, ref);
      if (node === null) continue;

      const stateKey = refToString(genericize(ref));
      const state = this.nodeStates.get(stateKey);
      const isRelevant = this.isEffectivelyRelevant(ref);

      // Check required: effectively relevant + required + empty value
      if (isRelevant && state?.required === true && isAnswerEmpty(node.value)) {
        return { failedNodeset: nodeset, status: AnswerResult.REQUIRED_BUT_EMPTY };
      }

      // Check constraint: non-null, non-empty value with a constraint binding
      const constraintCb = this.constraintBindings.get(nodeset);
      if (constraintCb !== undefined && !isAnswerEmpty(node.value)) {
        const constraintResult = this.evaluateCompiled(constraintCb.expr, node);
        if (!toBoolean(constraintResult)) {
          return { failedNodeset: nodeset, status: AnswerResult.CONSTRAINT_VIOLATED };
        }
      }
    }
    return null;
  }

  /**
   * Walk all descendant InstanceNodes of a node and ensure their effective
   * relevance is consistent with the ancestor walk rule.
   *
   * This does NOT set state.relevant on descendants — only own NodeState.relevant
   * reflects the Condition expression result. Effective relevance is always
   * computed on-the-fly by isEffectivelyRelevant (ancestor walk).
   *
   * This method exists to trigger any downstream recalculates that depend on
   * nodes inside the subtree (via a future event system). For now it is a no-op
   * beyond the ancestor walk built into isEffectivelyRelevant.
   *
   * NOTE (spec S3.5): calculates inside a non-relevant group STILL fire — but
   * descendants that depend on a non-relevant node see '' via relevanceOf closure.
   */
  private propagateRelevanceToDescendants(_node: InstanceNode): void {
    // Effective relevance is computed lazily via isEffectivelyRelevant — no
    // explicit propagation needed. This method is a hook for future event emission.
  }
}

// ---------------------------------------------------------------------------
// getAllToTrigger — transitive expansion via immediateCascades
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.getAllToTrigger (TriggerableDag.java:503-523).
 */
function getAllToTrigger(
  cascadeRoots: ReadonlySet<Triggerable>,
  immediateCascades: ReadonlyMap<Triggerable, Set<Triggerable>>,
): Set<Triggerable> {
  const toTrigger = new Set<Triggerable>();
  const queue: Triggerable[] = [...cascadeRoots];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (toTrigger.has(current)) continue;
    toTrigger.add(current);

    const downstream = immediateCascades.get(current);
    if (downstream) {
      for (const dep of downstream) {
        if (!toTrigger.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  return toTrigger;
}

// ---------------------------------------------------------------------------
// isAnswerEmpty — null or empty-string AnswerValue is "empty" for required/constraint
// ---------------------------------------------------------------------------

/**
 * Returns true if an AnswerValue is considered empty for validation purposes.
 * Mirrors JavaRosa: null or empty string value = empty.
 */
function isAnswerEmpty(value: AnswerValue | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  // String-like types: empty if value === ''
  if (typeof value.value === 'string') return value.value === '';
  // Arrays (selectMulti, geoshape, geotrace): empty if length === 0
  if (Array.isArray(value.value)) return value.value.length === 0;
  // Numbers, booleans, Dates: never empty (0 and false are valid answers)
  return false;
}

// ---------------------------------------------------------------------------
// toBoolean — mirrors JavaRosa XPathFuncExpr.toBoolean / boolean() coercion
// ---------------------------------------------------------------------------

function toBoolean(value: string | number | boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  // string: 'true' or '1' are true; '' or '0' or 'false' are false (JavaRosa rules)
  const s = value.trim().toLowerCase();
  return s === 'true' || s === '1';
}
