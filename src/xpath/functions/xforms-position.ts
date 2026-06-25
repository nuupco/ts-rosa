/**
 * Native `position()` XPath function for ts-rosa.
 *
 * Extends the standard XPath 1.0 `position()` with the JavaRosa extension
 * `position(nodeset)` which returns the 1-based position of the first node
 * in the nodeset within its parent's sibling list of same-named nodes.
 *
 * JR source: XPathFuncExpr.java:298-320
 *   position(nodeset) → 1 + refAt(0).getMultLast()
 *   position()        → 1 + evalContext.getContextPosition()
 *
 * Used in child_vaccination and other real-world forms:
 *   <bind calculate="position(..)" nodeset="/data/household/houseCount"/>
 *   <bind calculate="position(..)" nodeset="/data/household/child_repeat/count"/>
 *
 * Implementation strategy:
 *   - 0 args → standard XPath context position.
 *   - 1 arg  → evaluate the expression as a node-set, take the first node,
 *     try to read InstanceNode.multiplicity for O(1) position lookup,
 *     otherwise fall back to previous-sibling DOM traversal (same-name counting).
 *
 * Phase 7b — engine fix (REQ-7B-2: navigation reaches waypoints).
 */

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { NumberFunction } from '../vendor/xpath/evaluator/functions/NumberFunction.ts';

export const position = new NumberFunction(
  'position',
  [{ arityType: 'optional' }],
  <T extends XPathNode>(
    context: LocationPathEvaluation<T>,
    [expression]: readonly EvaluableArgument[]
  ): number => {
    if (expression == null) {
      // Standard XPath: current context position (1-based)
      return context.contextPosition();
    }

    // JR extension: position(nodeset) → 1-based position of first node in nodeset
    const results = expression.evaluate(context);

    // Must be a node-set (LocationPathEvaluation). Use duck-typing via values() method.
    if (typeof (results as unknown as { values?: unknown }).values !== 'function') {
      // Not a node-set — fall back to context position
      return context.contextPosition();
    }

    // Cast: at runtime this is LocationPathEvaluation<T>
    const nodeSet = results as unknown as LocationPathEvaluation<T>;
    const [first] = nodeSet.values() as unknown as Array<{ value: T } | undefined>;

    if (first == null) {
      // JR: 1 + INDEX_UNBOUND(-1) = 0 for empty nodeset
      return 0;
    }

    const node = first.value as unknown as { kind?: string; node?: { multiplicity?: number } };

    // Fast path: InstanceElementNode carries 0-indexed multiplicity
    if (node != null && node.kind === 'element' && node.node != null) {
      const mult = node.node.multiplicity;
      if (typeof mult === 'number' && mult >= 0) {
        return mult + 1;
      }
    }

    // Fallback: DOM sibling traversal (count previous same-named siblings)
    const { domProvider } = context;
    const rawNode = first.value;
    if (domProvider.isQualifiedNamedNode(rawNode)) {
      const nodeName = domProvider.getQualifiedName(rawNode);
      let currentNode = rawNode;
      let result = 0;
      do {
        result += 1;
        const previousNode = domProvider.getPreviousSiblingElement(currentNode);
        if (previousNode == null) break;
        currentNode = previousNode;
      } while (domProvider.getQualifiedName(currentNode) === nodeName);
      return result;
    }

    return context.contextPosition();
  }
);
