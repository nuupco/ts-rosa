/**
 * T7/T8 — VariableReferenceExpressionEvaluator + public seam wiring.
 *
 * JavaRosa-oracle scenarios (bound number/string, arithmetic coercion,
 * unbound throws) are ported into tests/equivalence/xpath/eval.test.ts
 * (describe "XPath eval — variable references ($name)"). This file covers
 * additional seam-level contract details not tied to a JavaRosa oracle case:
 * the concrete error class, typed-result shape, and backward compatibility.
 */
import { describe, expect, it } from 'vitest';
import { evaluateXPath, evaluateXPathTyped } from '../../../src/xpath/index.ts';
import { UnboundVariableError } from '../../../src/xpath/vendor/xpath/error/UnboundVariableError.ts';

describe('XPath $name variable references (seam contract)', () => {
	it('throws UnboundVariableError (not a generic Error) for an unbound reference', () => {
		expect(() => evaluateXPath('$unknown_var')).toThrow(UnboundVariableError);
	});

	it('is backward compatible: omitting variables behaves identically for a $-free expression', () => {
		expect(evaluateXPath('1 + 1')).toBe(evaluateXPath('1 + 1', undefined));
	});

	it('evaluateXPathTyped preserves the NUMBER type for a bound numeric variable', () => {
		const typed = evaluateXPathTyped('$x', { variables: new Map([['x', 42]]) } as never);

		expect(typed).toEqual({ type: 'NUMBER', value: 42 });
	});
});
