/**
 * T2 — Parser: DOLLAR branch in PureJSExpressionParser.parsePrimaryExpr.
 *
 * Token shape confirmed in T1 (tests/unit/xpath/tokenizer-variable.test.ts):
 * `$name` lexes as DOLLAR followed by ONE NAME token (QName combined into a
 * single token), so the parser branch consumes DOLLAR + NAME and builds a
 * `variable_reference` terminal node with `.text = '$name'`.
 */
import { describe, expect, it } from 'vitest';
import { PureJSExpressionParser } from '../../../src/xpath/parser/PureJSExpressionParser.ts';

function parseInner(expr: string) {
	const parser = new PureJSExpressionParser();
	const tree = parser.parse(expr);
	// xpath > expr > filter_path_expr > filter_expr > variable_reference
	return tree.rootNode.child(0)!.child(0)!.child(0)!.child(0)!;
}

describe('PureJSExpressionParser — variable_reference', () => {
	it('parses a bare variable reference $var_float_five', () => {
		const node = parseInner('$var_float_five');

		expect(node.type).toBe('variable_reference');
		expect(node.text).toBe('$var_float_five');
		expect(node.childCount).toBe(0);
	});

	it('parses a variable reference nested in a binary expression', () => {
		const tree = new PureJSExpressionParser().parse('$var_float_five + 1');
		const additionNode = tree.rootNode.child(0)!.child(0)!;

		expect(additionNode.type).toBe('addition_expr');
		// left operand is wrapped in filter_path_expr > filter_expr > variable_reference
		const left = additionNode.child(0)!;
		expect(left.type).toBe('filter_path_expr');
		const inner = left.child(0)!.child(0)!;
		expect(inner.type).toBe('variable_reference');
		expect(inner.text).toBe('$var_float_five');
	});

	it('parses a QName-form variable reference $ns:myvar, preserving the qualified name', () => {
		const node = parseInner('$ns:myvar');

		expect(node.type).toBe('variable_reference');
		expect(node.text).toBe('$ns:myvar');
	});

	it('still throws a syntax error for a bare $ with no name', () => {
		expect(() => new PureJSExpressionParser().parse('$')).toThrow(/syntax error/);
	});

	it('still throws a syntax error for $123 (not a valid name)', () => {
		expect(() => new PureJSExpressionParser().parse('$123')).toThrow(/syntax error/);
	});
});
