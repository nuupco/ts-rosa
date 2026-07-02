/**
 * T6 — XPathVariableValue primitives-only guard (design Decision 5).
 * Node-set-valued variables are OUT OF SCOPE for v1 and MUST be rejected
 * at bind time with a clear error, rather than silently wrapping foreign
 * nodes into InstanceXPathNode/XmldomNode.
 */
import { describe, expect, it } from 'vitest';
import { assertXPathVariableValue } from '../../../src/xpath/evaluator/XPathVariableValue.ts';

describe('assertXPathVariableValue', () => {
	it('accepts a string', () => {
		expect(() => assertXPathVariableValue('hello', 'x')).not.toThrow();
	});

	it('accepts a number', () => {
		expect(() => assertXPathVariableValue(5, 'x')).not.toThrow();
	});

	it('accepts a boolean', () => {
		expect(() => assertXPathVariableValue(true, 'x')).not.toThrow();
	});

	it('rejects an array (node-set) value with a clear error naming the variable', () => {
		expect(() => assertXPathVariableValue([1, 2, 3] as unknown, 'nodes')).toThrow(/nodes/);
	});

	it('rejects a plain object value', () => {
		expect(() => assertXPathVariableValue({ a: 1 } as unknown, 'obj')).toThrow();
	});
});
