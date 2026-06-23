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
 * Pre-configured evaluator over xmldom nodes using our pure-JS parser.
 *
 * Usage:
 *   const result = xmldomEvaluator.evaluate(expr, contextNode, null, XPATH_EVALUATION_RESULT.ANY_TYPE);
 */
/**
 * Use UTC so date arithmetic (date(0) → "1970-01-01", date(1) → "1970-01-02")
 * is deterministic and matches JavaRosa oracle expectations. JavaRosa uses UTC
 * internally for epoch-based date conversions.
 */
export const xmldomEvaluator = new Evaluator<XmldomNode>({
	domAdapter: xmldomXPathAdapter,
	parser: sharedParser,
	functions: defaultFunctions,
	timeZoneId: 'UTC',
});
