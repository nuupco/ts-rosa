/**
 * Native `pulldata()` XPath function for ts-rosa.
 *
 * Rationale: the vendor pulldata implementation (xforms/string.ts) calls
 * `context.evaluator.evaluateString(expr)` without a contextNode option.
 * The vendored Evaluator singleton has no rootNode set, so that call throws:
 *   "Context node must be provided in options or as Evaluator constructor options.rootNode"
 *
 * Fix: build the same XPath expression the vendor builds, then evaluate it
 * directly via `context.evaluator.evaluate(expr, rootNode, ...)`, passing the
 * document root as the context node so that `instance('id')/root/...` paths
 * resolve against the correct secondary instance map.
 *
 * We use `context.evaluator` (the already-wired Evaluator from the current
 * LocationPathEvaluation) rather than importing `instanceEvaluator` directly —
 * that would introduce a circular import: index.ts → xforms-pulldata.ts →
 * InstanceEvaluator.ts → index.ts (defaultFunctions).
 *
 * pulldata(instanceId, desiredCol, lookupCol, lookupVal)
 *   → instance(instanceId)/root/item[lookupCol='lookupVal']/desiredCol
 */

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { StringFunction } from '../vendor/xpath/evaluator/functions/StringFunction.ts';
import type { InstanceXPathNode } from '../adapter/instance/InstanceXPathNode.ts';
import { XPATH_EVALUATION_RESULT } from '../vendor/xpath/evaluator/result/XPathEvaluationResult.ts';

export const pulldata = new StringFunction(
  'pulldata',
  [
    { arityType: 'required', typeHint: 'string' },
    { arityType: 'required', typeHint: 'string' },
    { arityType: 'required', typeHint: 'string' },
    { arityType: 'required', typeHint: 'string' },
  ],
  <T extends XPathNode>(
    context: LocationPathEvaluation<T>,
    [instanceExpression, desiredElementExpression, queryElementExpression, queryExpression]: readonly EvaluableArgument[],
  ): string => {
    const instanceId = instanceExpression!.evaluate(context).toString();
    const desiredElement = desiredElementExpression!.evaluate(context).toString();
    const queryElement = queryElementExpression!.evaluate(context).toString();
    const query = queryExpression!.evaluate(context).toString();

    const expr = `instance('${instanceId}')/root/item[${queryElement}='${query}']/${desiredElement}`;

    // Evaluate using the already-wired evaluator from the current context —
    // avoids a circular import with InstanceEvaluator.ts.
    // rootNode is the InstanceDocumentNode; getContainingDocument(rootNode)
    // returns itself, so contextDocument.secondaryInstances is available to
    // the inner instance() call.
    const rootNode = context.rootNode as unknown as InstanceXPathNode;
    return context.evaluator.evaluate(
      expr,
      rootNode as unknown as T,
      null,
      XPATH_EVALUATION_RESULT.STRING_TYPE,
    ).stringValue;
  },
);
