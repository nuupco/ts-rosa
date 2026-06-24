/**
 * Native `itext()` XPath function for ts-rosa (registered under the JavaRosa
 * namespace as `jr:itext`).
 *
 * Reads per-form itext resolver from the evaluation context's document node
 * (context.contextDocument.itext), NOT from a global evaluator state. This
 * design avoids the circular-import cycle that exists in the vendored
 * javarosa/node-set.ts (which calls XFormsXPathEvaluator.getTranslationValues()).
 *
 * Mirror of src/xpath/functions/xforms-indexed-repeat.ts precedent.
 *
 * Returns: the active-language translation string for the given itext id, or
 * `[id]` as the JavaRosa fallback marker when no resolver is attached or the
 * id is not found.
 */

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { StringFunction } from '../vendor/xpath/evaluator/functions/StringFunction.ts';
import type { InstanceDocumentNode } from '../adapter/instance/InstanceXPathNode.ts';

export const itext = new StringFunction(
  'itext',
  [{ arityType: 'required', typeHint: 'string' }],
  <T extends XPathNode>(context: LocationPathEvaluation<T>, [idExpr]: readonly EvaluableArgument[]): string => {
    const id = idExpr!.evaluate(context).toString();
    const doc = context.contextDocument as unknown as InstanceDocumentNode;
    const resolver = doc.itext;
    return resolver?.resolve(id) ?? `[${id}]`;
  },
);
