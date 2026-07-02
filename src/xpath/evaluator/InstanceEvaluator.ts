/**
 * InstanceEvaluator — wires PureJSExpressionParser + InstanceNodeXPathAdapter
 * into a vendored Evaluator<InstanceXPathNode>.
 *
 * Reuses the SAME sharedParser and defaultFunctions as XmldomEvaluator.
 * The two evaluators coexist: XmldomEvaluator handles xmldom tests (unchanged);
 * InstanceEvaluator handles FormEvaluator / reactive engine evaluations.
 *
 * This is the coexistence proof for Option A (design §1.1 de-risk gate).
 */

import { Evaluator } from '../vendor/xpath/evaluator/Evaluator.ts';
import { instanceNodeXPathAdapter } from '../adapter/instance/InstanceNodeXPathAdapter.ts';
import type { InstanceXPathNode } from '../adapter/instance/InstanceXPathNode.ts';
import { PureJSExpressionParser } from '../parser/PureJSExpressionParser.ts';
import type { ExpressionParser } from '../vendor/xpath/static/grammar/ExpressionParser.ts';
import { defaultFunctions } from '../functions/index.ts';
import type { XPathValue } from '../seam/XPathSeam.ts';
import { getPlatformTimeZoneId } from '../../platform/PlatformConfig.ts';

export type { InstanceXPathNode };

/**
 * Evaluation context for InstanceEvaluator evaluations.
 *
 * - instanceRoot: the synthetic document node for the InstanceTree
 * - contextNode: the current context node for the evaluation
 * - secondaryInstances: optional secondary instance roots (Phase 5)
 * - variables: optional variable bindings ($var, Phase 3.7)
 * - relevanceOf: optional closure — returns true if the node is effectively
 *   relevant. Default = always true (used by pure XPath unit tests).
 *   FormEvaluator injects this in Phase 3.5 to make non-relevant nodes
 *   return '' for XPath reads.
 */
export interface InstanceEvaluationContext {
  readonly instanceRoot: InstanceXPathNode;
  readonly contextNode: InstanceXPathNode;
  readonly secondaryInstances?: ReadonlyMap<string, InstanceXPathNode>;
  readonly variables?: ReadonlyMap<string, XPathValue>;
  readonly relevanceOf?: (node: InstanceXPathNode) => boolean;
}

/**
 * Shared parser — reused from XmldomEvaluator (same singleton).
 *
 * Cast to ExpressionParser: our ParsedTree lacks the `language` field that
 * SyntaxTree declares, but the vendored Evaluator only ever accesses
 * `.rootNode` from the parse result. The cast is safe.
 */
const sharedParser = new PureJSExpressionParser() as unknown as ExpressionParser;

/**
 * Lazily constructed so the platform timeZoneId (registered via
 * registerPlatformConfig()) can be read at first use rather than frozen at
 * module-import time. Defaults to 'UTC' when no config is registered,
 * matching JavaRosa oracle expectations for deterministic date arithmetic.
 */
let _instanceEvaluator: Evaluator<InstanceXPathNode> | null = null;

function getInstanceEvaluatorInstance(): Evaluator<InstanceXPathNode> {
  if (_instanceEvaluator === null) {
    _instanceEvaluator = new Evaluator<InstanceXPathNode>({
      domAdapter: instanceNodeXPathAdapter,
      parser: sharedParser,
      functions: defaultFunctions,
      timeZoneId: getPlatformTimeZoneId(),
    });
  }
  return _instanceEvaluator;
}

/**
 * Singleton InstanceEvaluator over InstanceXPathNode using the pure-JS parser.
 * Backed by a lazily constructed singleton (see getInstanceEvaluatorInstance)
 * so existing call sites (`instanceEvaluator.evaluate(...)`) are unaffected.
 */
export const instanceEvaluator: Evaluator<InstanceXPathNode> = new Proxy(
  {} as Evaluator<InstanceXPathNode>,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getInstanceEvaluatorInstance(), prop, receiver);
    },
  },
);
