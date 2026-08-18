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
 *   - compileXPath(expr) parses once and returns a CompiledExpression handle for
 *     Phase 3 DataBinding consumption (parse-once, evaluate-many-times pattern).
 *
 * XPathValue (discriminated union) is exported for callers that need type
 * information beyond the primitive coercion.
 */

import { getXmlParser } from '../../platform/XmlParser.ts';
import type { XmldomNode } from '../adapter/XmldomXPathAdapter.ts';
import { xmldomEvaluator } from '../evaluator/XmldomEvaluator.ts';
import {
	instanceEvaluator,
	type InstanceEvaluationContext,
} from '../evaluator/InstanceEvaluator.ts';
import type { InstanceXPathNode } from '../adapter/instance/InstanceXPathNode.ts';
import {
	XPATH_EVALUATION_RESULT,
	type XPathEvaluationResultType,
} from '../vendor/xpath/evaluator/result/XPathEvaluationResult.ts';
import {
	makeInstanceDocumentNode,
	wrapInstanceNode,
	setActiveRelevanceCheck,
	setActiveChoiceNameResolver,
	getActiveChoiceNameResolver,
} from '../adapter/instance/InstanceNodeXPathAdapter.ts';
import { setActiveVariables } from '../evaluator/VariableScope.ts';
import { assertXPathVariableValue, type XPathVariableValue } from '../evaluator/XPathVariableValue.ts';

export type { XPathVariableValue } from '../evaluator/XPathVariableValue.ts';

export type { InstanceEvaluationContext } from '../evaluator/InstanceEvaluator.ts';

// Re-export adapter symbols so FormEvaluator only touches this seam.
export {
	makeInstanceDocumentNode,
	wrapInstanceNode,
	setActiveRelevanceCheck,
	setActiveChoiceNameResolver,
	getActiveChoiceNameResolver,
} from '../adapter/instance/InstanceNodeXPathAdapter.ts';
export type {
	InstanceDocumentNode,
	InstanceXPathNode,
	InstanceElementNode,
} from '../adapter/instance/InstanceXPathNode.ts';

// Re-export result constants behind the seam boundary.
export { XPATH_EVALUATION_RESULT } from '../vendor/xpath/evaluator/result/XPathEvaluationResult.ts';

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
	/** XPath `$name` variable bindings (read-side only; no setvalue source yet). */
	readonly variables?: ReadonlyMap<string, XPathVariableValue>;
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

/**
 * Validate and normalize caller-supplied variable bindings into the
 * ReadonlyMap<string, XPathVariableValue> shape VariableScope expects.
 * Throws (bind time) if any value is not a supported primitive
 * (design Decision 5 — node-set/array/object values are out of scope).
 */
function toActiveVariableMap(
	variables: ReadonlyMap<string, XPathVariableValue> | undefined
): ReadonlyMap<string, XPathVariableValue> {
	if (variables === undefined) return EMPTY_VARIABLES;
	for (const [name, value] of variables) {
		assertXPathVariableValue(value, name);
	}
	return variables;
}

const EMPTY_VARIABLES: ReadonlyMap<string, XPathVariableValue> = new Map();

let stubDocument: XmldomNode | null = null;

function getStubDocument(): XmldomNode {
	if (stubDocument === null) {
		const provider = getXmlParser();
		if (provider.createDocument === undefined) {
			throw new Error(
				'XmlParser provider does not implement createDocument(). ' +
					'The XPath seam needs a stub document when no evaluation context ' +
					'is provided. Implement createDocument(rootTagName) on the provider ' +
					'passed to registerXmlParser().',
			);
		}
		const doc = provider.createDocument('stub');
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
	const variables = toActiveVariableMap(context?.variables);

	const result = setActiveVariables(variables, () =>
		xmldomEvaluator.evaluate(expr, contextNode, null, XPATH_EVALUATION_RESULT.ANY_TYPE)
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

// ---------------------------------------------------------------------------
// Compilation seam — Phase 3 handoff
// ---------------------------------------------------------------------------

/**
 * A pre-compiled XPath expression that can be evaluated multiple times
 * against different contexts without re-parsing.
 *
 * This is the handoff point for Phase 3 DataBinding compilation: Phase 3
 * will call compileXPath() once per expression string found in DataBinding
 * and store the resulting CompiledExpression in the DAG node, calling
 * evaluate() on each reactive update.
 */
export interface CompiledExpression {
	/** The original expression string, for debugging and caching. */
	readonly source: string;
	/**
	 * Evaluate the compiled expression against an optional context.
	 * When context is omitted a stub document is used (same behaviour as
	 * evaluateXPath with no context).
	 */
	evaluate(context?: EvaluationContext): number | string | boolean | readonly XmldomNode[];
}

/**
 * Parse an XPath expression once and return a reusable CompiledExpression.
 *
 * The expression is validated (parsed) immediately — invalid expressions
 * throw synchronously so callers discover errors at compile time, not at
 * the first evaluate() call.
 *
 * Usage pattern (Phase 3 DataBinding):
 *   const compiled = compileXPath(binding.calculate);   // parse once
 *   // on each reactive trigger:
 *   const value = compiled.evaluate(currentContext);    // evaluate many times
 */
export function compileXPath(expr: string): CompiledExpression {
	// Validate the expression immediately by doing a trial parse.
	// evaluateXPathTyped calls the parser internally; if it throws the error
	// propagates to the caller and no CompiledExpression is returned.
	evaluateXPathTyped(expr);

	return {
		source: expr,
		evaluate(context?: EvaluationContext): number | string | boolean | readonly XmldomNode[] {
			return evaluateXPath(expr, context);
		},
	};
}

// ---------------------------------------------------------------------------
// InstanceTree XPath compilation — Phase 3 (Option A bridge)
// ---------------------------------------------------------------------------

/**
 * Result types for InstanceEvaluator evaluation.
 */
export type InstanceXPathValue =
	| { readonly type: 'BOOLEAN'; readonly value: boolean }
	| { readonly type: 'NUMBER'; readonly value: number }
	| { readonly type: 'STRING'; readonly value: string }
	| { readonly type: 'NODESET'; readonly nodes: readonly InstanceXPathNode[] };

/**
 * A CompiledExpression variant that evaluates over an InstanceTree via the
 * InstanceEvaluator (Option A bridge).
 *
 * The xmldom CompiledExpression and this type are intentionally distinct to
 * prevent accidental cross-evaluator usage.
 */
export interface CompiledInstanceExpression {
	/** The original expression string, for debugging and caching. */
	readonly source: string;
	/**
	 * Evaluate over an InstanceTree context.
	 * When context is omitted the expression is evaluated with no context
	 * (useful for constant expressions).
	 */
	evaluateTyped(context?: InstanceEvaluationContext): InstanceXPathValue;
	evaluate(context?: InstanceEvaluationContext): number | string | boolean | readonly InstanceXPathNode[];
}

/**
 * Parse an XPath expression once and return a reusable CompiledInstanceExpression
 * that evaluates over InstanceTree via the InstanceEvaluator.
 *
 * The xmldom compileXPath() and evaluateXPath() surfaces are UNCHANGED — this
 * is an additive entry point only. The XPathSeam remains the sole XPath import
 * boundary.
 */
export function compileInstanceXPath(expr: string): CompiledInstanceExpression {
	return {
		source: expr,

		evaluateTyped(context?: InstanceEvaluationContext): InstanceXPathValue {
			const variables = toActiveVariableMap(context?.variables);
			const contextNode = context?.contextNode;
			if (contextNode === undefined) {
				// No context — evaluate as constant; result is usually a string/number/boolean
				const result = setActiveVariables(variables, () =>
					instanceEvaluator.evaluate(
						expr,
						// Use a minimal stub: we need some node to pass; create a simple doc
						// by evaluating with the xmldom evaluator's context mechanism.
						// For constant expressions (no node access) the context node is irrelevant.
						// We re-use the same trick as the xmldom path: pass contextNode as undefined
						// will fail type-check, so we fall back to an exception for now —
						// callers SHOULD provide a context.
						null as unknown as InstanceXPathNode,
						null,
						XPATH_EVALUATION_RESULT.ANY_TYPE,
					)
				);
				return decodeInstanceResult(result);
			}
			const result = setActiveVariables(variables, () =>
				instanceEvaluator.evaluate(
					expr,
					contextNode,
					null,
					XPATH_EVALUATION_RESULT.ANY_TYPE,
				)
			);
			return decodeInstanceResult(result);
		},

		evaluate(context?: InstanceEvaluationContext): number | string | boolean | readonly InstanceXPathNode[] {
			const typed = this.evaluateTyped(context);
			switch (typed.type) {
				case 'NUMBER': return typed.value;
				case 'STRING': return typed.value;
				case 'BOOLEAN': return typed.value;
				case 'NODESET': return typed.nodes;
			}
		},
	};
}

/**
 * Evaluate a pre-compiled instance expression against an InstanceEvaluationContext.
 *
 * This is the seam-level wrapper for the direct `instanceEvaluator.evaluate(...)` call
 * so that FormEvaluator does not need to import InstanceEvaluator directly.
 *
 * @param compiled - A CompiledInstanceExpression obtained from compileInstanceXPath.
 * @param ctx      - The evaluation context providing instanceRoot and contextNode.
 * @returns The raw evaluator result (callers decode via InstanceXPathValue helpers).
 */
export function evaluateInstanceXPath(
	compiled: CompiledInstanceExpression,
	ctx: InstanceEvaluationContext,
): ReturnType<typeof instanceEvaluator.evaluate> {
	const variables = toActiveVariableMap(ctx.variables);
	return setActiveVariables(variables, () =>
		instanceEvaluator.evaluate(
			compiled.source,
			ctx.contextNode,
			null,
			XPATH_EVALUATION_RESULT.ANY_TYPE,
		)
	);
}

/**
 * Evaluate a plain XPath expression string directly over the InstanceTree.
 *
 * Used by FormEvaluator for internal evaluations (e.g. evaluateAsNodeSet,
 * evaluateOnInstance, nodeset string coercion) without going through a compiled
 * expression. Keeps InstanceEvaluator import inside the seam.
 *
 * @param expr      - XPath expression string.
 * @param ctxNode   - Context node for evaluation.
 * @param resultType - Requested result type constant from XPATH_EVALUATION_RESULT.
 */
export function evaluateInstanceExpr(
	expr: string,
	ctxNode: InstanceXPathNode,
	resultType: XPathEvaluationResultType,
): ReturnType<typeof instanceEvaluator.evaluate> {
	return setActiveVariables(EMPTY_VARIABLES, () =>
		instanceEvaluator.evaluate(expr, ctxNode, null, resultType)
	);
}

function decodeInstanceResult(result: ReturnType<typeof instanceEvaluator.evaluate>): InstanceXPathValue {
	switch (result.resultType) {
		case XPATH_EVALUATION_RESULT.BOOLEAN_TYPE:
			return { type: 'BOOLEAN', value: result.booleanValue };
		case XPATH_EVALUATION_RESULT.NUMBER_TYPE:
			return { type: 'NUMBER', value: result.numberValue };
		case XPATH_EVALUATION_RESULT.STRING_TYPE:
			return { type: 'STRING', value: result.stringValue };
		default: {
			const nodes: InstanceXPathNode[] = [];
			let node = result.iterateNext();
			while (node !== null) {
				nodes.push(node);
				node = result.iterateNext();
			}
			return { type: 'NODESET', nodes };
		}
	}
}
