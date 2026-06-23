/**
 * XmldomEvaluator — wires PureJSExpressionParser + XmldomXPathAdapter into the
 * vendored Evaluator<XmldomNode>.
 *
 * This is the single place in ts-rosa that instantiates the vendored Evaluator.
 * It injects our pure-JS parser in place of the WASM-based ExpressionParser so
 * that NO web-tree-sitter / WASM dependency reaches production code.
 *
 * Slice 2: uses only the `fn` (XPath 1.0 core) FunctionLibrary.
 * Slice 3: will replace defaultFunctions with fn + javarosa + xforms.
 */

import { Evaluator } from '../vendor/xpath/evaluator/Evaluator.ts';
import { FunctionLibraryCollection } from '../vendor/xpath/evaluator/functions/FunctionLibraryCollection.ts';
import { fn } from '../vendor/xpath/functions/fn/index.ts';
import { xmldomXPathAdapter, type XmldomNode } from '../adapter/XmldomXPathAdapter.ts';
import { PureJSExpressionParser } from '../parser/PureJSExpressionParser.ts';
import type { ExpressionParser } from '../vendor/xpath/static/grammar/ExpressionParser.ts';

/**
 * Default function collection for Slice 2: XPath 1.0 core only.
 * Slice 3 will expand this to [fn, javarosa, xforms].
 */
const defaultFunctions = new FunctionLibraryCollection([fn]);

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
export const xmldomEvaluator = new Evaluator<XmldomNode>({
	domAdapter: xmldomXPathAdapter,
	parser: sharedParser,
	functions: defaultFunctions,
});
