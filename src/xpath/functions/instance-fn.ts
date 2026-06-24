/**
 * Native `instance()` XPath function for ts-rosa.
 *
 * Reads per-form secondary instance data from the evaluation context's
 * document node (context.contextDocument.secondaryInstances), NOT from a
 * global evaluator state. This design avoids the circular-import cycle that
 * exists in the vendored xforms/node-set.ts (which calls
 * XFormsXPathEvaluator.getSecondaryInstance()).
 *
 * Mirror of src/xpath/functions/xforms-indexed-repeat.ts precedent.
 *
 * Returns: the root InstanceXPathNode for the named secondary instance, or
 * an empty node-set when the id is not found.
 */

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { NodeSetFunction } from '../vendor/xpath/evaluator/functions/NodeSetFunction.ts';
import type { InstanceDocumentNode } from '../adapter/instance/InstanceXPathNode.ts';

export const instance = new NodeSetFunction(
  'instance',
  [{ arityType: 'required', typeHint: 'string' }],
  <T extends XPathNode>(context: LocationPathEvaluation<T>, [idExpr]: readonly EvaluableArgument[]): readonly T[] => {
    const id = idExpr!.evaluate(context).toString();
    const doc = context.contextDocument as unknown as InstanceDocumentNode;
    const secondaryRoot = doc.secondaryInstances?.get(id) ?? null;
    // Safe cast: this function is only registered for InstanceXPathNode evaluations.
    return secondaryRoot == null ? [] : [secondaryRoot as unknown as T];
  },
);
