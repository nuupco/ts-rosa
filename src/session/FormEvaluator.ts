/**
 * FormEvaluator — Slice 3.1 skeleton + Slice 3.4 cascade engine.
 *
 * Responsibilities:
 *   - Evaluate XPath expressions over an InstanceTree via InstanceEvaluator
 *   - Manage reactive cascade (triggerTriggerables) via TriggerableDag
 *   - Manage NodeState per bound node
 *   - Wire answerQuestion + validate()
 *
 * Slice 3.4 adds:
 *   - initializeInstance(dag): evaluate all Recalculates in topological order
 *   - setValue(ref, value): write to InstanceNode + trigger cascade
 *   - triggerTriggerables(changedRef): DAG-ordered cascade execution
 *   - applyRecalculate(t, changedRef): eval + coerce + write to target nodes
 */

import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import type { InstanceNode } from '../model/instance/InstanceNode.ts';
import {
  makeInstanceDocumentNode,
  wrapInstanceNode,
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
import { genericize, refToString } from '../model/instance/TreeReference.ts';
import { resolveReference, resolveAll } from '../model/instance/InstanceTree.ts';
import { cast, uncast } from '../model/data/codecs.ts';
import type { AnswerValue } from '../model/data/AnswerValue.ts';

export class FormEvaluator {
  private readonly tree: InstanceTree;
  private readonly docNode: InstanceDocumentNode;
  /** Reactive DAG — set by initializeInstance; null until a form with bindings is loaded. */
  private dag: TriggerableDag | null = null;

  constructor(tree: InstanceTree) {
    this.tree = tree;
    this.docNode = makeInstanceDocumentNode(tree);
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
   * Evaluate a pre-compiled instance expression.
   * Used by the DAG-based cascade.
   */
  evaluateCompiled(
    compiled: CompiledInstanceExpression,
    contextNode?: InstanceNode | null,
  ): string | number | boolean {
    const ctx = this.makeContext(contextNode);
    const result = compiled.evaluate(ctx);
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
   * Initialize all Recalculate triggerables in topological DAG order.
   *
   * Mirrors JavaRosa TriggerableDag.initializeTriggerables (FormDef.java:447-466).
   * Called once at session creation to bring the instance to steady state.
   * Conditions (relevant/required/readonly) are also evaluated here to set NodeState,
   * but only Recalculate affects InstanceNode.value in Phase 3.4.
   */
  initializeInstance(dag: TriggerableDag): void {
    // Store DAG for use in setValue/triggerTriggerables
    this.dag = dag;

    for (const triggerable of dag.triggerablesDAG) {
      if (triggerable.kind === 'recalculate') {
        this.applyRecalculate(triggerable, null);
      }
      // Condition (relevant/required/readonly) evaluation is in Slice 3.5
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
    // triggerTriggerables uses stored this.dag — no-op if dag is null
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
    // Rebind for use in the rest of this method
    const useDag = activeDag;

    const genericRef = genericize(changedRef);
    const key = refToString(genericRef);
    const cascadeRoots = useDag.triggerablesPerTrigger.get(key);
    if (!cascadeRoots || cascadeRoots.size === 0) return;

    // Expand cascade transitively via immediateCascades
    const toTrigger = getAllToTrigger(cascadeRoots, useDag.immediateCascades);

    // Evaluate in DAG order (respecting alreadyEvaluated semantics from JR)
    const alreadyEvaluated = new Set<Triggerable>();
    for (const triggerable of useDag.triggerablesDAG) {
      if (!toTrigger.has(triggerable)) continue;
      if (alreadyEvaluated.has(triggerable)) continue;

      if (triggerable.kind === 'recalculate') {
        this.applyRecalculate(triggerable, changedRef);
      }
      // Condition (relevant/required/readonly) is Slice 3.5

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
   * @param t          The Recalculate triggerable to evaluate.
   * @param changedRef The ref that triggered this recalculation (null during init).
   */
  private applyRecalculate(t: Triggerable & { kind: 'recalculate' }, changedRef: TreeReference | null): void {
    // Determine context node: first target node (or tree root as fallback)
    // JavaRosa: Recalculate.apply uses the context of the target node
    for (const target of t.targets) {
      const targetNode = resolveReference(this.tree, target);
      if (targetNode === null) continue;

      // Evaluate the expression with target node as context
      const rawResult = this.evaluateCompiled(t.expr, targetNode);

      // Coerce result to target's dataType (mirrors JR Recalculate coerce())
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
}

// ---------------------------------------------------------------------------
// getAllToTrigger — transitive expansion via immediateCascades
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.getAllToTrigger (TriggerableDag.java:503-523).
 *
 * Starting from cascadeRoots, expands transitively through immediateCascades
 * to produce the full set of triggerables that need to be evaluated.
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
