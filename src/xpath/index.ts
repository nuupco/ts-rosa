/**
 * XPath evaluation seam — public entry point for ts-rosa.
 *
 * This module is the ONLY import boundary for XPath functionality consumed by
 * the rest of the codebase (spec requirement G7). All XPath evaluation goes
 * through evaluateXPath() exported here.
 *
 * Phase 2 / Slice 2 — real engine wired:
 *   - PureJSExpressionParser: pure-JS XPath 1.0 recursive-descent parser
 *   - XmldomEvaluator: vendored Evaluator<XmldomNode> with injected parser
 *   - XmldomXPathAdapter: bridges @xmldom/xmldom nodes to the evaluator
 *
 * Phase 3 will add: compileXPath, EvaluationContext with FormInstance/TreeRef.
 */

export {
	evaluateXPath,
	evaluateXPathTyped,
	compileXPath,
	type CompiledExpression,
	type EvaluationContext,
	type XPathValue,
	type XPathVariableValue,
} from './seam/XPathSeam.ts';
