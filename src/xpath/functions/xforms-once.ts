/**
 * Native `once()` XPath function for ts-rosa.
 *
 * Semantics (mirror vendor xforms/node-set.ts:250-269, no XFormsXPathEvaluator import):
 *   - If the context node's current string value is non-empty → return it as-is
 *     (the argument expression is NOT evaluated — freeze-on-first-write semantics).
 *   - If the context node's current string value is empty → evaluate the argument
 *     expression and return its string value.
 *
 * The context value is read via `context.domProvider.getNodeValue(contextNode)`,
 * the same path the vendor uses. ts-rosa's InstanceNodeXPathAdapter.getNodeValue
 * returns answerValueToXPathString(node.value) for leaf element nodes, which
 * yields '' for null values — matching the empty-string gate intended by JavaRosa.
 *
 * Phase 6, Slice 6b (REQ-6B-1, REQ-6B-2, REQ-6B-6, REQ-X-3).
 */

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { StringFunction } from '../vendor/xpath/evaluator/functions/StringFunction.ts';

export const once = new StringFunction(
  'once',
  [{ arityType: 'required' }],
  <T extends XPathNode>(
    context: LocationPathEvaluation<T>,
    [expression]: readonly EvaluableArgument[]
  ): string => {
    const [contextNode] = context.contextNodes;

    if (contextNode == null) {
      throw new Error('No context node available for the once function.');
    }

    const current = context.domProvider.getNodeValue(contextNode);

    if (current === '') {
      return expression!.evaluate(context).toString();
    }

    return current;
  }
);
