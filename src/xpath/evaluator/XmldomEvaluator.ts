/**
 * XmldomEvaluator — wires PureJSExpressionParser + XmldomXPathAdapter into the
 * vendored Evaluator<XmldomNode>.
 *
 * This is the single place in ts-rosa that instantiates the vendored Evaluator.
 * It injects our pure-JS parser in place of the WASM-based ExpressionParser so
 * that NO web-tree-sitter / WASM dependency reaches production code.
 *
 * Slice 3: uses the full function library collection (fn + javarosa + xforms).
 */

import { Evaluator } from '../vendor/xpath/evaluator/Evaluator.ts';
import { xmldomXPathAdapter, type XmldomNode } from '../adapter/XmldomXPathAdapter.ts';
import { PureJSExpressionParser } from '../parser/PureJSExpressionParser.ts';
import type { ExpressionParser } from '../vendor/xpath/static/grammar/ExpressionParser.ts';
import { defaultFunctions } from '../functions/index.ts';
import { getPlatformTimeZoneId } from '../../platform/PlatformConfig.ts';

/**
 * Singleton parser instance — shared across all evaluator instances.
 * The LRU cache inside PureJSExpressionParser handles repeated expressions.
 *
 * Cast to ExpressionParser: our ParsedTree lacks the `language` field that
 * SyntaxTree declares, but the vendored Evaluator only ever accesses
 * `.rootNode` from the parse result. The cast is safe because we own both
 * sides and the evaluator never calls `.language`.
 */
const sharedParser = new PureJSExpressionParser() as unknown as ExpressionParser;

/**
 * Lazily constructed so the platform timeZoneId (registered via
 * registerPlatformConfig()) can be read at first use rather than frozen at
 * module-import time. Defaults to 'UTC' when no config is registered, which
 * matches JavaRosa oracle expectations for date arithmetic
 * (date(0) → "1970-01-01", date(1) → "1970-01-02").
 */
let _xmldomEvaluator: Evaluator<XmldomNode> | null = null;

function getXmldomEvaluatorInstance(): Evaluator<XmldomNode> {
	if (_xmldomEvaluator === null) {
		_xmldomEvaluator = new Evaluator<XmldomNode>({
			domAdapter: xmldomXPathAdapter,
			parser: sharedParser,
			functions: defaultFunctions,
			timeZoneId: getPlatformTimeZoneId(),
		});
	}
	return _xmldomEvaluator;
}

/**
 * Pre-configured evaluator over xmldom nodes using our pure-JS parser.
 * Backed by a lazily constructed singleton (see getXmldomEvaluatorInstance)
 * so existing call sites (`xmldomEvaluator.evaluate(...)`) are unaffected.
 */
export const xmldomEvaluator: Evaluator<XmldomNode> = new Proxy(
	{} as Evaluator<XmldomNode>,
	{
		get(_target, prop, receiver) {
			return Reflect.get(getXmldomEvaluatorInstance(), prop, receiver);
		},
	},
);
