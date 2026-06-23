/**
 * Golden AST-shape tests for PureJSExpressionParser.
 *
 * Strategy: each test asserts that PureJSExpressionParser produces a SyntaxNode
 * tree with the same structural shape as the real tree-sitter-xpath grammar. The
 * reference shapes were captured by running web-tree-sitter against the same
 * expressions (see scripts that generated these — the WASM is test-only, never
 * in production code).
 *
 * These tests are the oracle for Slice 2a. They MUST pass before any equivalence
 * it.fails are activated in Slice 2b.
 */
import { describe, expect, it } from 'vitest';
import type { ASyntaxNode } from '../../../src/xpath/parser/SyntaxNode.ts';
import { PureJSExpressionParser } from '../../../src/xpath/parser/PureJSExpressionParser.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NodeShape {
	type: string;
	text?: string;
	childCount?: number;
	children?: NodeShape[];
}

/**
 * Recursively assert that `node` matches `shape`.
 * Only keys present in `shape` are checked — extra properties are ignored.
 */
function assertShape(node: ASyntaxNode, shape: NodeShape, path = 'root'): void {
	expect(node.type, `${path}.type`).toBe(shape.type);

	if (shape.text !== undefined) {
		expect(node.text, `${path}.text`).toBe(shape.text);
	}

	if (shape.childCount !== undefined) {
		expect(node.childCount, `${path}.childCount`).toBe(shape.childCount);
	}

	if (shape.children !== undefined) {
		expect(node.childCount, `${path}.childCount (children array length)`).toBe(
			shape.children.length
		);

		for (let i = 0; i < shape.children.length; i++) {
			const childShape = shape.children[i];
			if (childShape === undefined) continue;
			const child = node.child(i);
			expect(child, `${path}.child(${i}) not null`).not.toBeNull();
			assertShape(child!, childShape, `${path}.children[${i}]`);
		}
	}
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const parser = new PureJSExpressionParser();

// ---------------------------------------------------------------------------
// Primitive literals
// ---------------------------------------------------------------------------

describe('number literal "5"', () => {
	it('produces xpath > expr > filter_path_expr > filter_expr > number', () => {
		const { rootNode } = parser.parse('5');
		assertShape(rootNode, {
			type: 'xpath',
			text: '5',
			childCount: 1,
			children: [
				{
					type: 'expr',
					text: '5',
					childCount: 1,
					children: [
						{
							type: 'filter_path_expr',
							text: '5',
							childCount: 1,
							children: [
								{
									type: 'filter_expr',
									text: '5',
									childCount: 1,
									children: [{ type: 'number', text: '5', childCount: 0 }],
								},
							],
						},
					],
				},
			],
		});
	});
});

describe("string literal \"'hello'\"", () => {
	it("produces xpath > expr > filter_path_expr > filter_expr > string_literal", () => {
		const { rootNode } = parser.parse("'hello'");
		assertShape(rootNode, {
			type: 'xpath',
			childCount: 1,
			children: [
				{
					type: 'expr',
					childCount: 1,
					children: [
						{
							type: 'filter_path_expr',
							childCount: 1,
							children: [
								{
									type: 'filter_expr',
									childCount: 1,
									children: [{ type: 'string_literal', text: "'hello'", childCount: 0 }],
								},
							],
						},
					],
				},
			],
		});
	});
});

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

describe('addition "1 + 2"', () => {
	it('produces addition_expr with two filter_path_expr children', () => {
		const { rootNode } = parser.parse('1 + 2');
		const expr = rootNode.child(0)!;
		const addExpr = expr.child(0)!;

		expect(addExpr.type).toBe('addition_expr');
		expect(addExpr.childCount).toBe(2);
		expect(addExpr.child(0)!.type).toBe('filter_path_expr');
		expect(addExpr.child(1)!.type).toBe('filter_path_expr');
		expect(addExpr.child(0)!.child(0)!.child(0)!.type).toBe('number');
		expect(addExpr.child(0)!.child(0)!.child(0)!.text).toBe('1');
		expect(addExpr.child(1)!.child(0)!.child(0)!.type).toBe('number');
		expect(addExpr.child(1)!.child(0)!.child(0)!.text).toBe('2');
	});
});

describe('precedence "2 + 3 * 4"', () => {
	it('nests multiplication under addition (left is number, right is multiplication_expr)', () => {
		const { rootNode } = parser.parse('2 + 3 * 4');
		const addExpr = rootNode.child(0)!.child(0)!;

		expect(addExpr.type).toBe('addition_expr');
		expect(addExpr.childCount).toBe(2);

		// left operand: 2
		const left = addExpr.child(0)!;
		expect(left.type).toBe('filter_path_expr');
		expect(left.child(0)!.child(0)!.text).toBe('2');

		// right operand: 3 * 4 (multiplication takes precedence)
		const right = addExpr.child(1)!;
		expect(right.type).toBe('multiplication_expr');
		expect(right.child(0)!.child(0)!.child(0)!.text).toBe('3');
		expect(right.child(1)!.child(0)!.child(0)!.text).toBe('4');
	});
});

describe('left-associativity "1 + 2 + 3"', () => {
	it('produces left-leaning addition tree', () => {
		const { rootNode } = parser.parse('1 + 2 + 3');
		const outer = rootNode.child(0)!.child(0)!;

		expect(outer.type).toBe('addition_expr');
		// left child is another addition_expr (left-assoc)
		expect(outer.child(0)!.type).toBe('addition_expr');
		// right child is filter_path_expr wrapping 3
		expect(outer.child(1)!.type).toBe('filter_path_expr');
		expect(outer.child(1)!.child(0)!.child(0)!.text).toBe('3');
	});
});

// ---------------------------------------------------------------------------
// Comparisons
// ---------------------------------------------------------------------------

describe('greater-than "3 > 2"', () => {
	it('produces gt_expr with two filter_path_expr children', () => {
		const { rootNode } = parser.parse('3 > 2');
		const gtExpr = rootNode.child(0)!.child(0)!;

		expect(gtExpr.type).toBe('gt_expr');
		expect(gtExpr.childCount).toBe(2);
	});
});

describe('equality "1 = 1"', () => {
	it('produces eq_expr', () => {
		const eq = rootNode_of('1 = 1').child(0)!.child(0)!;
		expect(eq.type).toBe('eq_expr');
	});
});

describe('not-equal "1 != 2"', () => {
	it('produces ne_expr', () => {
		const ne = rootNode_of('1 != 2').child(0)!.child(0)!;
		expect(ne.type).toBe('ne_expr');
	});
});

// ---------------------------------------------------------------------------
// Boolean operators
// ---------------------------------------------------------------------------

describe('and "true() and false()"', () => {
	it('produces and_expr with two filter_path_expr children', () => {
		const andExpr = rootNode_of('true() and false()').child(0)!.child(0)!;
		expect(andExpr.type).toBe('and_expr');
		expect(andExpr.childCount).toBe(2);
	});
});

describe('or "true() or false()"', () => {
	it('produces or_expr with two filter_path_expr children', () => {
		const orExpr = rootNode_of('true() or false()').child(0)!.child(0)!;
		expect(orExpr.type).toBe('or_expr');
	});
});

// ---------------------------------------------------------------------------
// Unary
// ---------------------------------------------------------------------------

describe('unary negation "-1"', () => {
	it('produces unary_expr wrapping filter_path_expr > filter_expr > number', () => {
		const unary = rootNode_of('-1').child(0)!.child(0)!;
		expect(unary.type).toBe('unary_expr');
		expect(unary.childCount).toBe(1);
		expect(unary.child(0)!.type).toBe('filter_path_expr');
		expect(unary.child(0)!.child(0)!.child(0)!.text).toBe('1');
	});
});

// ---------------------------------------------------------------------------
// Location paths
// ---------------------------------------------------------------------------

describe('absolute path "/root/a"', () => {
	it('produces absolute_location_path with absolute_root_location_path + two step children', () => {
		const absPath = rootNode_of('/root/a').child(0)!.child(0)!;
		expect(absPath.type).toBe('absolute_location_path');
		// children: [absolute_root_location_path, step(root), step(a)]
		expect(absPath.childCount).toBe(3);
		expect(absPath.child(0)!.type).toBe('absolute_root_location_path');
		expect(absPath.child(0)!.text).toBe('/');
		expect(absPath.child(1)!.type).toBe('step');
		expect(absPath.child(2)!.type).toBe('step');
	});
});

describe('root "/" alone', () => {
	it('produces absolute_location_path with single absolute_root_location_path child', () => {
		const absPath = rootNode_of('/').child(0)!.child(0)!;
		expect(absPath.type).toBe('absolute_location_path');
		expect(absPath.childCount).toBe(1);
		expect(absPath.child(0)!.type).toBe('absolute_root_location_path');
	});
});

describe('abbreviated absolute path "//item"', () => {
	it('produces absolute_location_path > abbreviated_absolute_location_path > [// step(item)]', () => {
		const absPath = rootNode_of('//item').child(0)!.child(0)!;
		expect(absPath.type).toBe('absolute_location_path');
		const abbrev = absPath.child(0)!;
		expect(abbrev.type).toBe('abbreviated_absolute_location_path');
		// children: [// literal, step(item)]
		expect(abbrev.childCount).toBe(2);
		expect(abbrev.child(0)!.type).toBe('//');
		expect(abbrev.child(0)!.text).toBe('//');
		expect(abbrev.child(1)!.type).toBe('step');
	});
});

describe('relative path "foo/bar"', () => {
	it('produces relative_location_path with two step children', () => {
		const relPath = rootNode_of('foo/bar').child(0)!.child(0)!;
		expect(relPath.type).toBe('relative_location_path');
		expect(relPath.childCount).toBe(2);
		expect(relPath.child(0)!.type).toBe('step');
		expect(relPath.child(1)!.type).toBe('step');
	});
});

describe('abbreviated step "." (self)', () => {
	it('produces relative_location_path > step > abbreviated_step > self', () => {
		const relPath = rootNode_of('.').child(0)!.child(0)!;
		expect(relPath.type).toBe('relative_location_path');
		const step = relPath.child(0)!;
		expect(step.type).toBe('step');
		const abbrev = step.child(0)!;
		expect(abbrev.type).toBe('abbreviated_step');
		expect(abbrev.text).toBe('.');
		expect(abbrev.child(0)!.type).toBe('self');
	});
});

describe('abbreviated step ".." (parent)', () => {
	it('produces relative_location_path > step > abbreviated_step > parent', () => {
		const step = rootNode_of('..').child(0)!.child(0)!.child(0)!;
		const abbrev = step.child(0)!;
		expect(abbrev.type).toBe('abbreviated_step');
		expect(abbrev.text).toBe('..');
		expect(abbrev.child(0)!.type).toBe('parent');
	});
});

describe('node type test "node()"', () => {
	it('produces step > node_test > node_type_test', () => {
		const step = rootNode_of('node()').child(0)!.child(0)!.child(0)!;
		expect(step.type).toBe('step');
		const nodeTest = step.child(0)!;
		expect(nodeTest.type).toBe('node_test');
		expect(nodeTest.child(0)!.type).toBe('node_type_test');
		expect(nodeTest.child(0)!.text).toBe('node()');
	});
});

describe('predicate "foo[1]"', () => {
	it('produces step with node_test and predicate children', () => {
		const step = rootNode_of('foo[1]').child(0)!.child(0)!.child(0)!;
		expect(step.type).toBe('step');
		expect(step.childCount).toBe(2);
		expect(step.child(0)!.type).toBe('node_test');
		expect(step.child(1)!.type).toBe('predicate');
		// predicate contains expr > filter_path_expr > filter_expr > number
		const predExpr = step.child(1)!.child(0)!;
		expect(predExpr.type).toBe('expr');
	});
});

describe('explicit axis "child::foo"', () => {
	it('produces step > axis_test with axis_name + unprefixed_name', () => {
		const step = rootNode_of('child::foo').child(0)!.child(0)!.child(0)!;
		expect(step.type).toBe('step');
		const axisTest = step.child(0)!;
		expect(axisTest.type).toBe('axis_test');
		expect(axisTest.childCount).toBe(2);
		expect(axisTest.child(0)!.type).toBe('axis_name');
		expect(axisTest.child(0)!.text).toBe('child');
		expect(axisTest.child(1)!.type).toBe('unprefixed_name');
		expect(axisTest.child(1)!.text).toBe('foo');
	});
});

describe('attribute shorthand "@attr"', () => {
	it('produces step > abbreviated_axis_test > unprefixed_name', () => {
		const step = rootNode_of('@attr').child(0)!.child(0)!.child(0)!;
		expect(step.type).toBe('step');
		const abbrevAxis = step.child(0)!;
		expect(abbrevAxis.type).toBe('abbreviated_axis_test');
		expect(abbrevAxis.childCount).toBe(1);
		expect(abbrevAxis.child(0)!.type).toBe('unprefixed_name');
		expect(abbrevAxis.child(0)!.text).toBe('attr');
	});
});

describe('explicit axis with node type "self::node()"', () => {
	it('produces step > axis_test with axis_name(self) + node_type_test', () => {
		const step = rootNode_of('self::node()').child(0)!.child(0)!.child(0)!;
		const axisTest = step.child(0)!;
		expect(axisTest.type).toBe('axis_test');
		expect(axisTest.child(0)!.type).toBe('axis_name');
		expect(axisTest.child(0)!.text).toBe('self');
		expect(axisTest.child(1)!.type).toBe('node_type_test');
	});
});

// ---------------------------------------------------------------------------
// Function calls
// ---------------------------------------------------------------------------

describe('function call "foo()"', () => {
	it('produces filter_path_expr > filter_expr > function_call > function_name > unprefixed_name', () => {
		const fpe = rootNode_of('foo()').child(0)!.child(0)!;
		expect(fpe.type).toBe('filter_path_expr');
		const fe = fpe.child(0)!;
		expect(fe.type).toBe('filter_expr');
		const fc = fe.child(0)!;
		expect(fc.type).toBe('function_call');
		expect(fc.childCount).toBe(1); // just the function_name, no args
		const fn = fc.child(0)!;
		expect(fn.type).toBe('function_name');
		expect(fn.child(0)!.type).toBe('unprefixed_name');
		expect(fn.child(0)!.text).toBe('foo');
	});
});

describe("function call with arg \"boolean-from-string('true')\"", () => {
	it('produces function_call with function_name + argument children', () => {
		const fc = rootNode_of("boolean-from-string('true')")
			.child(0)!
			.child(0)!
			.child(0)!
			.child(0)!;
		expect(fc.type).toBe('function_call');
		expect(fc.childCount).toBe(2);
		expect(fc.child(0)!.type).toBe('function_name');
		expect(fc.child(0)!.child(0)!.text).toBe('boolean-from-string');
		const arg = fc.child(1)!;
		expect(arg.type).toBe('argument');
		// argument > expr > filter_path_expr > filter_expr > string_literal
		const strLit = arg.child(0)!.child(0)!.child(0)!.child(0)!;
		expect(strLit.type).toBe('string_literal');
		expect(strLit.text).toBe("'true'");
	});
});

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

describe('union "a | b"', () => {
	it('produces union_expr with two relative_location_path children', () => {
		const union = rootNode_of('a | b').child(0)!.child(0)!;
		expect(union.type).toBe('union_expr');
		expect(union.childCount).toBe(2);
		expect(union.child(0)!.type).toBe('relative_location_path');
		expect(union.child(1)!.type).toBe('relative_location_path');
	});
});

// ---------------------------------------------------------------------------
// Function in argument "count(//item)"
// ---------------------------------------------------------------------------

describe('count(//item)', () => {
	it('produces function_call with argument containing absolute_location_path', () => {
		const fc = rootNode_of('count(//item)').child(0)!.child(0)!.child(0)!.child(0)!;
		expect(fc.type).toBe('function_call');
		expect(fc.childCount).toBe(2);
		const arg = fc.child(1)!;
		expect(arg.type).toBe('argument');
		const innerExpr = arg.child(0)!;
		expect(innerExpr.type).toBe('expr');
		const absPath = innerExpr.child(0)!;
		expect(absPath.type).toBe('absolute_location_path');
	});
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('syntax error "1 ++ 2"', () => {
	it('throws Error (not "not implemented")', () => {
		expect(() => parser.parse('1 ++ 2')).toThrow(Error);
		expect(() => parser.parse('1 ++ 2')).not.toThrow('not implemented');
	});
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function rootNode_of(expr: string): ASyntaxNode {
	return parser.parse(expr).rootNode;
}
