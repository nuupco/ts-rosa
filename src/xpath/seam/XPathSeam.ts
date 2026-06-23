/**
 * XPathSeam — the sole XPath entry point for ts-rosa.
 *
 * Wraps XmldomEvaluator and exposes a minimal API that:
 *   - Accepts an optional EvaluationContext (instance + contextNode)
 *   - Returns a primitive value (number | string | boolean) for scalar results,
 *     or an array of XmldomNode for nodesets — matching the JavaRosa equivalence
 *     test assertions which call evaluateXPath(expr) with no context.
 *   - When no context is provided, uses a minimal stub document so the vendored
 *     Evaluator always has a valid DOM context node.
 *
 * XPathValue (discriminated union) is exported for callers that need type
 * information beyond the primitive coercion.
 */

import { DOMImplementation } from '@xmldom/xmldom';
import type { XmldomNode } from '../adapter/XmldomXPathAdapter.ts';
import { xmldomEvaluator } from '../evaluator/XmldomEvaluator.ts';
import {
	XPATH_EVALUATION_RESULT,
} from '../vendor/xpath/evaluator/result/XPathEvaluationResult.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EvaluationContext {
	/** Primary instance document. */
	readonly instance: XmldomNode;
	/** Current context node for the evaluation. */
	readonly contextNode: XmldomNode;
	/** Secondary instances, keyed by instance id (jr:instance). */
	readonly secondaryInstances?: ReadonlyMap<string, XmldomNode>;
}

/**
 * Discriminated union of all possible XPath result types.
 * Callers that need type-safe dispatch use this; callers that need a raw
 * primitive call evaluateXPath() directly (which coerces to primitive).
 */
export type XPathValue =
	| { readonly type: 'BOOLEAN'; readonly value: boolean }
	| { readonly type: 'NUMBER'; readonly value: number }
	| { readonly type: 'STRING'; readonly value: string }
	| { readonly type: 'NODESET'; readonly nodes: readonly XmldomNode[] };

// ---------------------------------------------------------------------------
// Minimal stub document — used when no context is provided
// ---------------------------------------------------------------------------

let stubDocument: XmldomNode | null = null;

function getStubDocument(): XmldomNode {
	if (stubDocument === null) {
		const impl = new DOMImplementation();
		const doc = impl.createDocument(null, 'stub', null);
		stubDocument = doc as unknown as XmldomNode;
	}

	return stubDocument;
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate an XPath expression and return a typed XPathValue.
 *
 * @param expr     - XPath 1.0 + XForms expression string.
 * @param context  - Optional evaluation context. When omitted a minimal stub
 *                   document is used so the evaluator has a valid context node.
 */
export function evaluateXPathTyped(expr: string, context?: EvaluationContext): XPathValue {
	const contextNode = context?.contextNode ?? getStubDocument();

	const result = xmldomEvaluator.evaluate(
		expr,
		contextNode,
		null,
		XPATH_EVALUATION_RESULT.ANY_TYPE
	);

	switch (result.resultType) {
		case XPATH_EVALUATION_RESULT.BOOLEAN_TYPE:
			return { type: 'BOOLEAN', value: result.booleanValue };
		case XPATH_EVALUATION_RESULT.NUMBER_TYPE:
			return { type: 'NUMBER', value: result.numberValue };
		case XPATH_EVALUATION_RESULT.STRING_TYPE:
			return { type: 'STRING', value: result.stringValue };
		default: {
			// Nodeset or ANY_TYPE with nodeset result
			const nodes: XmldomNode[] = [];
			let node = result.iterateNext();
			while (node !== null) {
				nodes.push(node);
				node = result.iterateNext();
			}
			return { type: 'NODESET', nodes };
		}
	}
}

/**
 * Evaluate an XPath expression and coerce the result to a primitive value
 * (number | string | boolean) or a nodeset array.
 *
 * This is the primary entry point used by the equivalence tests: tests call
 * evaluateXPath("5") and expect the number 5, not an XPathValue object.
 *
 * Coercion rules (matching JavaRosa / XPath 1.0 spec):
 *   - NUMBER  → JS number (including NaN, Infinity)
 *   - STRING  → JS string
 *   - BOOLEAN → JS boolean
 *   - NODESET → readonly XmldomNode[] (callers handle node collections)
 */
export function evaluateXPath(
	expr: string,
	context?: EvaluationContext
): number | string | boolean | readonly XmldomNode[] {
	const typed = evaluateXPathTyped(expr, context);
	switch (typed.type) {
		case 'NUMBER':
			return typed.value;
		case 'STRING':
			return typed.value;
		case 'BOOLEAN':
			return typed.value;
		case 'NODESET':
			return typed.nodes;
	}
}
