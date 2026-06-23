/**
 * FormEvaluator — skeleton for Slice 3.1 (Phase 3).
 *
 * Responsibilities of the FULL evaluator (Slices 3.1–3.7):
 *   - Evaluate XPath expressions over an InstanceTree via InstanceEvaluator
 *   - Manage reactive cascade (triggerTriggerables) via TriggerableDag
 *   - Manage NodeState per bound node
 *   - Wire answerQuestion + validate()
 *
 * In this slice (3.1) the skeleton only provides:
 *   - evaluateOnInstance(expr, contextNode?) — entry point used by tests
 *   - The InstanceDocumentNode is built once at construction from tree.root
 *   - All DAG/NodeState/cascade features are NOT implemented yet (Slices 3.2–3.7)
 *
 * Later slices MODIFY this file without changing the constructor signature or
 * evaluateOnInstance entry point.
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

export class FormEvaluator {
  private readonly tree: InstanceTree;
  private readonly docNode: InstanceDocumentNode;

  constructor(tree: InstanceTree) {
    this.tree = tree;
    this.docNode = makeInstanceDocumentNode(tree);
  }

  /**
   * Build an InstanceEvaluationContext for a given context InstanceNode.
   * When contextNode is null the document root is used.
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
   *
   * @param expr - XPath 1.0 / XForms expression string.
   * @param contextNode - Optional context InstanceNode. Defaults to tree.root.
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
   * Used by the DAG-based cascade in later slices.
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
}
