/**
 * @vendored from @getodk/tree-sitter-xpath
 *
 * Inlined type-level constants from the tree-sitter XPath grammar.
 * These are const enum members used only as template literal types in type-names.ts.
 * No runtime code — TypeScript inlines const enum values at compile time.
 *
 * Source: @getodk/tree-sitter-xpath dist/tree-sitter-xpath-parser.d.ts
 * License: Apache-2.0 — Copyright (c) 2023 ODK (getodk/web-forms)
 */

export const enum SyntaxType {
	ERROR = 'ERROR',
	AbbreviatedAbsoluteLocationPath = 'abbreviated_absolute_location_path',
	AbbreviatedAxisTest = 'abbreviated_axis_test',
	AbbreviatedStep = 'abbreviated_step',
	AbsoluteLocationPath = 'absolute_location_path',
	AbsoluteRootLocationPath = 'absolute_root_location_path',
	AdditionExpr = 'addition_expr',
	AndExpr = 'and_expr',
	Argument = 'argument',
	AxisName = 'axis_name',
	AxisTest = 'axis_test',
	DivisionExpr = 'division_expr',
	EqExpr = 'eq_expr',
	Expr = 'expr',
	FilterExpr = 'filter_expr',
	FilterPathExpr = 'filter_path_expr',
	FunctionCall = 'function_call',
	FunctionName = 'function_name',
	GtExpr = 'gt_expr',
	GteExpr = 'gte_expr',
	LocalPart = 'local_part',
	LtExpr = 'lt_expr',
	LteExpr = 'lte_expr',
	ModuloExpr = 'modulo_expr',
	MultiplicationExpr = 'multiplication_expr',
	NeExpr = 'ne_expr',
	NodeTest = 'node_test',
	NodeTypeTest = 'node_type_test',
	Number = 'number',
	OrExpr = 'or_expr',
	Predicate = 'predicate',
	Prefix = 'prefix',
	PrefixedName = 'prefixed_name',
	PrefixedWildcardNameTest = 'prefixed_wildcard_name_test',
	ProcessingInstructionNameTest = 'processing_instruction_name_test',
	RelativeLocationPath = 'relative_location_path',
	Step = 'step',
	StringLiteral = 'string_literal',
	SubtractionExpr = 'subtraction_expr',
	UnaryExpr = 'unary_expr',
	UnionExpr = 'union_expr',
	UnprefixedName = 'unprefixed_name',
	UnprefixedWildcardNameTest = 'unprefixed_wildcard_name_test',
	VariableReference = 'variable_reference',
	Xpath = 'xpath',
	Parent = 'parent',
	Self = 'self',
}

export type UnnamedType = '//';
