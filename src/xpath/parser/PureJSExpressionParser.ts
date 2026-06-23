/**
 * Pure-JS recursive-descent XPath 1.0 parser with precedence climbing.
 *
 * Emits a SyntaxNode tree with the EXACT same structural shape as the
 * tree-sitter-xpath grammar, including:
 *   - Wrapper nodes: root is always `xpath` > `expr` > actual expression
 *   - Binary expressions wrap operands in `filter_path_expr` > `filter_expr`
 *     when the operand is a literal, function call, or other non-path expression
 *   - `//` as a literal unnamed node (`type: '//'`) that is a sibling in
 *     `abbreviated_absolute_location_path` and `relative_location_path`
 *   - Positional child ordering that matches the evaluator's destructuring
 *
 * Architecture:
 *   tokenize(expr) → Token[] → recursive-descent parser → frozen SyntaxNode tree
 *
 * Precedence (highest = lowest number, binds tightest):
 *   UnaryExpr < MultiplicativeExpr < AdditiveExpr < RelationalExpr
 *   < EqualityExpr < AndExpr < OrExpr < UnionExpr (path-level)
 *
 * The tree-sitter grammar does NOT have a separate UnionExpr at the top-level
 * precedence. UnionExpr is peer to path expressions. We handle it at the top
 * of the expression chain.
 */

import { type ParseOptions } from '../vendor/xpath/static/grammar/ExpressionParser.ts';
import { type ASyntaxNode, makeSyntaxNode, type ParsedTree } from './SyntaxNode.ts';
import { tokenize, type Token, TokenKind } from './Tokenizer.ts';

// ---------------------------------------------------------------------------
// Simple LRU cache
// ---------------------------------------------------------------------------

class LRUCache<K, V> {
	private readonly map = new Map<K, V>();

	constructor(private readonly maxSize: number) {}

	get(key: K): V | undefined {
		const v = this.map.get(key);
		if (v !== undefined) {
			// refresh
			this.map.delete(key);
			this.map.set(key, v);
		}
		return v;
	}

	set(key: K, value: V): void {
		if (this.map.has(key)) this.map.delete(key);
		this.map.set(key, value);
		if (this.map.size > this.maxSize) {
			this.map.delete(this.map.keys().next().value!);
		}
	}
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export class PureJSExpressionParser {
	private readonly cache = new LRUCache<string, ParsedTree>(256);

	parse(expression: string, _options?: ParseOptions): ParsedTree {
		const cached = this.cache.get(expression);
		if (cached !== undefined) return cached;

		const tokens = tokenize(expression);
		const parser = new Parser(expression, tokens);
		const result = parser.parseRoot();
		this.cache.set(expression, result);
		return result;
	}
}

// ---------------------------------------------------------------------------
// Internal recursive-descent parser class
// ---------------------------------------------------------------------------

class Parser {
	private pos = 0;

	constructor(
		private readonly src: string,
		private readonly tokens: Token[]
	) {}

	// -------------------------------------------------------------------------
	// Token navigation
	// -------------------------------------------------------------------------

	private peek(): Token {
		return this.tokens[this.pos] ?? { kind: TokenKind.EOF, text: '', start: this.src.length };
	}

	private peekKind(): TokenKind {
		return this.peek().kind;
	}

	private advance(): Token {
		const t = this.peek();
		if (t.kind !== TokenKind.EOF) this.pos++;
		return t;
	}

	private expect(kind: TokenKind): Token {
		const t = this.peek();
		if (t.kind !== kind) {
			this.error();
		}
		return this.advance();
	}

	private consume(kind: TokenKind): Token | null {
		if (this.peekKind() === kind) return this.advance();
		return null;
	}

	private error(): never {
		throw new Error(`Expression has syntax error: ${this.src}`);
	}

	// -------------------------------------------------------------------------
	// Root
	// -------------------------------------------------------------------------

	parseRoot(): ParsedTree {
		const exprNode = this.parseExprWrapper();

		if (this.peekKind() !== TokenKind.EOF) {
			this.error();
		}

		const xpathNode = makeSyntaxNode('xpath', this.src, [exprNode]);
		return { rootNode: xpathNode };
	}

	/**
	 * Produce an `expr` wrapper node around the actual expression, matching
	 * tree-sitter's invariant that `xpath` always has exactly one `expr` child
	 * and `argument` always wraps in `expr`.
	 */
	private parseExprWrapper(): ASyntaxNode {
		const inner = this.parseOrExpr();
		return makeSyntaxNode('expr', inner.text, [inner]);
	}

	// -------------------------------------------------------------------------
	// Binary expression chain (precedence climbing)
	// The grammar precedence (low to high binding):
	//   or < and < equality < relational < additive < multiplicative < unary
	// After these: union, path, filter expressions
	// -------------------------------------------------------------------------

	private parseOrExpr(): ASyntaxNode {
		let left = this.parseAndExpr();

		while (this.peekKind() === TokenKind.OR) {
			this.advance();
			const right = this.parseAndExpr();
			const text = this.src.slice(left.text === this.src ? 0 : this.src.indexOf(left.text), this.src.indexOf(right.text) + right.text.length);
			left = makeSyntaxNode('or_expr', computeBinaryText(this.src, left, right), [left, right]);
		}

		return left;
	}

	private parseAndExpr(): ASyntaxNode {
		let left = this.parseEqualityExpr();

		while (this.peekKind() === TokenKind.AND) {
			this.advance();
			const right = this.parseEqualityExpr();
			left = makeSyntaxNode('and_expr', computeBinaryText(this.src, left, right), [left, right]);
		}

		return left;
	}

	private parseEqualityExpr(): ASyntaxNode {
		let left = this.parseRelationalExpr();

		for (;;) {
			const k = this.peekKind();
			if (k === TokenKind.EQ) {
				this.advance();
				const right = this.parseRelationalExpr();
				left = makeSyntaxNode('eq_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else if (k === TokenKind.NEQ) {
				this.advance();
				const right = this.parseRelationalExpr();
				left = makeSyntaxNode('ne_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else {
				break;
			}
		}

		return left;
	}

	private parseRelationalExpr(): ASyntaxNode {
		let left = this.parseAdditiveExpr();

		for (;;) {
			const k = this.peekKind();
			if (k === TokenKind.LT) {
				this.advance();
				const right = this.parseAdditiveExpr();
				left = makeSyntaxNode('lt_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else if (k === TokenKind.LTE) {
				this.advance();
				const right = this.parseAdditiveExpr();
				left = makeSyntaxNode('lte_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else if (k === TokenKind.GT) {
				this.advance();
				const right = this.parseAdditiveExpr();
				left = makeSyntaxNode('gt_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else if (k === TokenKind.GTE) {
				this.advance();
				const right = this.parseAdditiveExpr();
				left = makeSyntaxNode('gte_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else {
				break;
			}
		}

		return left;
	}

	private parseAdditiveExpr(): ASyntaxNode {
		let left = this.parseMultiplicativeExpr();

		for (;;) {
			const k = this.peekKind();
			if (k === TokenKind.PLUS) {
				this.advance();
				const right = this.parseMultiplicativeExpr();
				left = makeSyntaxNode('addition_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else if (k === TokenKind.MINUS) {
				this.advance();
				const right = this.parseMultiplicativeExpr();
				left = makeSyntaxNode('subtraction_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else {
				break;
			}
		}

		return left;
	}

	private parseMultiplicativeExpr(): ASyntaxNode {
		let left = this.parseUnaryExpr();

		for (;;) {
			const k = this.peekKind();
			if (k === TokenKind.MULTIPLY) {
				this.advance();
				const right = this.parseUnaryExpr();
				left = makeSyntaxNode('multiplication_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else if (k === TokenKind.DIV) {
				this.advance();
				const right = this.parseUnaryExpr();
				left = makeSyntaxNode('division_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else if (k === TokenKind.MOD) {
				this.advance();
				const right = this.parseUnaryExpr();
				left = makeSyntaxNode('modulo_expr', computeBinaryText(this.src, left, right), [left, right]);
			} else {
				break;
			}
		}

		return left;
	}

	private parseUnaryExpr(): ASyntaxNode {
		if (this.peekKind() === TokenKind.MINUS) {
			const minusTok = this.advance();
			const operand = this.parseUnionOperand();
			const fpe = wrapInFilterPathExpr(operand);
			const text = this.src.slice(minusTok.start, endOffset(fpe, this.src));
			return makeSyntaxNode('unary_expr', text, [fpe]);
		}

		return this.parseUnionOperand();
	}

	/**
	 * Parse a union expression or a single path/filter expression.
	 * Union: PathExpr | PathExpr | ...
	 * This is the level above path expressions in the precedence chain.
	 */
	private parseUnionOperand(): ASyntaxNode {
		let left = this.parsePathExpr();

		while (this.peekKind() === TokenKind.PIPE) {
			this.advance();
			const right = this.parsePathExpr();
			left = makeSyntaxNode('union_expr', computeBinaryText(this.src, left, right), [left, right]);
		}

		return left;
	}

	// -------------------------------------------------------------------------
	// Path / Filter expressions
	// -------------------------------------------------------------------------

	/**
	 * PathExpr ::= LocationPath | FilterExpr | FilterExpr '/' RelativeLocationPath
	 *             | FilterExpr '//' RelativeLocationPath
	 *
	 * In tree-sitter, simple function calls and literals are wrapped as:
	 *   filter_path_expr > filter_expr > (function_call | literal | number | expr)
	 * Location paths are NOT wrapped in filter_path_expr at the top level.
	 */
	private parsePathExpr(): ASyntaxNode {
		// Absolute location paths start with / or //
		if (this.peekKind() === TokenKind.SLASH || this.peekKind() === TokenKind.SLASHSLASH) {
			return this.parseAbsoluteLocationPath();
		}

		// Relative location paths can start with a step-like token:
		// NAME, *, @, ., .., AXIS_NAME (followed by ::), NODE_TYPE (followed by ()),
		// or explicit axis forms
		if (this.isStepStart()) {
			return this.parseRelativeLocationPath();
		}

		// Otherwise: FilterExpr optionally followed by / or // RelativeLocationPath
		const filterExprNode = this.parseFilterExpr();
		const filterPathNode = wrapInFilterPathExpr(filterExprNode);

		// Check for filter_path_expr: FilterExpr followed by path steps
		// e.g. id("foo")/child
		if (this.peekKind() === TokenKind.SLASH || this.peekKind() === TokenKind.SLASHSLASH) {
			return this.parseFilterPathContinuation(filterPathNode);
		}

		return filterPathNode;
	}

	private parseFilterPathContinuation(head: ASyntaxNode): ASyntaxNode {
		const children: ASyntaxNode[] = [head];

		while (this.peekKind() === TokenKind.SLASH || this.peekKind() === TokenKind.SLASHSLASH) {
			if (this.peekKind() === TokenKind.SLASHSLASH) {
				const slashTok = this.advance();
				children.push(makeSyntaxNode('//', '//', []));
				const step = this.parseStep();
				children.push(step);
			} else {
				this.advance(); // consume /
				const step = this.parseStep();
				children.push(step);
			}
		}

		const text = this.src.slice(
			findNodeStart(children[0]!, this.src),
			endOffsetFromChildren(children, this.src)
		);
		return makeSyntaxNode('filter_path_expr', text, children);
	}

	/**
	 * Parse an absolute location path.
	 * / RelativeLocationPath?
	 * // RelativeLocationPath
	 */
	private parseAbsoluteLocationPath(): ASyntaxNode {
		if (this.peekKind() === TokenKind.SLASHSLASH) {
			return this.parseAbbreviatedAbsoluteLocationPath();
		}

		// Starts with /
		const slashTok = this.advance(); // consume /
		const rootNode = makeSyntaxNode('absolute_root_location_path', '/', []);

		const children: ASyntaxNode[] = [rootNode];

		// Optional relative location path after the /
		if (this.isStepStart()) {
			const relSteps = this.parseRelativeSteps();
			children.push(...relSteps);
		}

		const text = this.src.slice(slashTok.start, endOffsetFromChildren(children, this.src));
		return makeSyntaxNode('absolute_location_path', text, children);
	}

	/**
	 * Parse //RelativeLocationPath → absolute_location_path > abbreviated_absolute_location_path
	 */
	private parseAbbreviatedAbsoluteLocationPath(): ASyntaxNode {
		const slashSlashTok = this.advance(); // consume //
		const slashSlashLiteral = makeSyntaxNode('//', '//', []);
		const firstStep = this.parseStep();

		const abbrevChildren: ASyntaxNode[] = [slashSlashLiteral, firstStep];

		// More steps after the first
		while (this.peekKind() === TokenKind.SLASH || this.peekKind() === TokenKind.SLASHSLASH) {
			if (this.peekKind() === TokenKind.SLASHSLASH) {
				const t = this.advance();
				abbrevChildren.push(makeSyntaxNode('//', '//', []));
			} else {
				this.advance();
			}
			if (this.isStepStart()) {
				abbrevChildren.push(this.parseStep());
			}
		}

		const abbrevText = this.src.slice(slashSlashTok.start, endOffsetFromChildren(abbrevChildren, this.src));
		const abbrevNode = makeSyntaxNode('abbreviated_absolute_location_path', abbrevText, abbrevChildren);

		const absText = abbrevText; // same span
		return makeSyntaxNode('absolute_location_path', absText, [abbrevNode]);
	}

	/**
	 * Parse a relative location path: step (/ step | // step)*
	 */
	private parseRelativeLocationPath(): ASyntaxNode {
		const steps = this.parseRelativeSteps();

		const text = this.src.slice(
			findNodeStart(steps[0]!, this.src),
			endOffsetFromChildren(steps, this.src)
		);
		return makeSyntaxNode('relative_location_path', text, steps);
	}

	/**
	 * Parse one or more step nodes, interleaved with / and // separators.
	 * Returns a flat array of steps (// is NOT included as a separator node here —
	 * only `abbreviated_absolute_location_path` uses `//` as a sibling node).
	 *
	 * In `relative_location_path`, `//` becomes a `NodeTypeTestStep('descendant-or-self')`
	 * in the evaluator via the `//` sibling node in the children array.
	 * Wait — let's check the actual tree shape for `foo//bar`:
	 */
	private parseRelativeSteps(): ASyntaxNode[] {
		const steps: ASyntaxNode[] = [];
		steps.push(this.parseStep());

		while (this.peekKind() === TokenKind.SLASH || this.peekKind() === TokenKind.SLASHSLASH) {
			if (this.peekKind() === TokenKind.SLASHSLASH) {
				this.advance();
				// In relative_location_path, // is emitted as a '//' literal sibling
				steps.push(makeSyntaxNode('//', '//', []));
			} else {
				this.advance(); // consume /
			}

			if (this.isStepStart()) {
				steps.push(this.parseStep());
			} else if (steps.length > 0) {
				// trailing / — error
				this.error();
			}
		}

		return steps;
	}

	/**
	 * Determine if the current token can start a step.
	 * FUNCTION_NAME is NOT a step start — it is a function call and goes through
	 * the FilterExpr path.
	 * NODE_TYPE is a step start only when it is inside a step context (always true
	 * for a relative location path, but not at the top-level expression level where
	 * it would be a function call like node()).
	 * Actually NODE_TYPE at the top-level becomes a relative_location_path too
	 * (e.g. `node()` is a step test). So NODE_TYPE is a step start.
	 */
	private isStepStart(): boolean {
		const k = this.peekKind();
		return (
			k === TokenKind.NAME ||
			k === TokenKind.WILDCARD ||
			k === TokenKind.PREFIXED_WILDCARD ||
			k === TokenKind.AT ||
			k === TokenKind.DOT ||
			k === TokenKind.DOTDOT ||
			k === TokenKind.AXIS_NAME ||
			k === TokenKind.NODE_TYPE
			// FUNCTION_NAME is NOT a step start — it is a function call (FilterExpr)
		);
	}

	/**
	 * Parse a single step node.
	 * Step shapes:
	 *   abbreviated_step (`.` or `..`)
	 *   node_test (implicit child:: axis)
	 *   axis_test (explicit axis via AxisName `::`)
	 *   abbreviated_axis_test (@ shorthand)
	 */
	private parseStep(): ASyntaxNode {
		const startPos = this.peek().start;

		// `..` → abbreviated_step > parent
		if (this.peekKind() === TokenKind.DOTDOT) {
			const tok = this.advance();
			const parentNode = makeSyntaxNode('parent', '..', []);
			const abbrev = makeSyntaxNode('abbreviated_step', '..', [parentNode]);
			return makeSyntaxNode('step', '..', [abbrev]);
		}

		// `.` → abbreviated_step > self
		if (this.peekKind() === TokenKind.DOT) {
			const tok = this.advance();
			const selfNode = makeSyntaxNode('self', '.', []);
			const abbrev = makeSyntaxNode('abbreviated_step', '.', [selfNode]);
			return makeSyntaxNode('step', '.', [abbrev]);
		}

		// `@` → abbreviated_axis_test
		if (this.peekKind() === TokenKind.AT) {
			this.advance(); // consume @
			const nameTest = this.parseNameTestNode();
			const abbrevAxis = makeSyntaxNode('abbreviated_axis_test', `@${nameTest.text}`, [nameTest]);
			const stepText = `@${nameTest.text}`;
			const children: ASyntaxNode[] = [abbrevAxis, ...this.parsePredicates()];
			const text = buildStepText(this.src, stepText, children);
			return makeSyntaxNode('step', text, children);
		}

		// AXIS_NAME `::` → axis_test
		if (this.peekKind() === TokenKind.AXIS_NAME) {
			const axisTok = this.advance();
			this.expect(TokenKind.COLON_COLON);
			const axisNameNode = makeSyntaxNode('axis_name', axisTok.text, []);

			// After `::` comes a node-test (name test or node-type test)
			const axisTestContent = this.parseAxisTestContent();
			const axisTestText = `${axisTok.text}::${axisTestContent.text}`;
			const axisTestNode = makeSyntaxNode('axis_test', axisTestText, [axisNameNode, axisTestContent]);
			const children: ASyntaxNode[] = [axisTestNode, ...this.parsePredicates()];
			const text = buildStepText(this.src, axisTestText, children);
			return makeSyntaxNode('step', text, children);
		}

		// NODE_TYPE `()` → node_type_test inside node_test
		if (this.peekKind() === TokenKind.NODE_TYPE) {
			const typeTok = this.advance();
			this.expect(TokenKind.LPAREN);
			// processing-instruction may have an optional string arg
			let piName: string | null = null;
			if (typeTok.text === 'processing-instruction' && this.peekKind() === TokenKind.STRING) {
				piName = this.advance().text;
			}
			this.expect(TokenKind.RPAREN);

			let nodeTypeNode: ASyntaxNode;
			let nodeTestNode: ASyntaxNode;

			if (piName !== null) {
				// processing_instruction_name_test > string_literal
				const litNode = makeSyntaxNode('string_literal', piName, []);
				nodeTypeNode = makeSyntaxNode('processing_instruction_name_test', `processing-instruction(${piName})`, [litNode]);
				nodeTestNode = makeSyntaxNode('node_test', nodeTypeNode.text, [nodeTypeNode]);
			} else {
				const nodeTypeText = `${typeTok.text}()`;
				nodeTypeNode = makeSyntaxNode('node_type_test', nodeTypeText, []);
				nodeTestNode = makeSyntaxNode('node_test', nodeTypeText, [nodeTypeNode]);
			}

			const children: ASyntaxNode[] = [nodeTestNode, ...this.parsePredicates()];
			const text = buildStepText(this.src, nodeTestNode.text, children);
			return makeSyntaxNode('step', text, children);
		}

		// NAME or WILDCARD or PREFIXED_WILDCARD → node_test
		const nameTest = this.parseNameTestNode();
		const nodeTestNode = makeSyntaxNode('node_test', nameTest.text, [nameTest]);
		const children: ASyntaxNode[] = [nodeTestNode, ...this.parsePredicates()];
		const text = buildStepText(this.src, nameTest.text, children);
		return makeSyntaxNode('step', text, children);
	}

	/**
	 * Parse the content after `axis::` — either a name test or a node-type test.
	 */
	private parseAxisTestContent(): ASyntaxNode {
		if (this.peekKind() === TokenKind.NODE_TYPE) {
			const typeTok = this.advance();
			this.expect(TokenKind.LPAREN);
			let piName: string | null = null;
			if (typeTok.text === 'processing-instruction' && this.peekKind() === TokenKind.STRING) {
				piName = this.advance().text;
			}
			this.expect(TokenKind.RPAREN);
			if (piName !== null) {
				const litNode = makeSyntaxNode('string_literal', piName, []);
				return makeSyntaxNode('processing_instruction_name_test', `processing-instruction(${piName})`, [litNode]);
			}
			return makeSyntaxNode('node_type_test', `${typeTok.text}()`, []);
		}

		return this.parseNameTestNode();
	}

	/** Parse a name test node: unprefixed_name, unprefixed_wildcard_name_test, or prefixed forms. */
	private parseNameTestNode(): ASyntaxNode {
		if (this.peekKind() === TokenKind.WILDCARD) {
			const tok = this.advance();
			return makeSyntaxNode('unprefixed_wildcard_name_test', '*', []);
		}

		if (this.peekKind() === TokenKind.PREFIXED_WILDCARD) {
			const tok = this.advance();
			// prefix:*  → prefixed_wildcard_name_test > prefix
			const colonIdx = tok.text.indexOf(':');
			const prefixText = tok.text.slice(0, colonIdx);
			const prefixNode = makeSyntaxNode('prefix', prefixText, []);
			return makeSyntaxNode('prefixed_wildcard_name_test', tok.text, [prefixNode]);
		}

		// NAME — could be QName or NCName
		const tok = this.advance();
		const colonIdx = tok.text.indexOf(':');
		if (colonIdx > -1) {
			// QName: prefix:localPart → prefixed_name > [prefix, local_part]
			const prefixText = tok.text.slice(0, colonIdx);
			const localText = tok.text.slice(colonIdx + 1);
			const prefixNode = makeSyntaxNode('prefix', prefixText, []);
			const localNode = makeSyntaxNode('local_part', localText, []);
			return makeSyntaxNode('prefixed_name', tok.text, [prefixNode, localNode]);
		}

		// NCName → unprefixed_name
		return makeSyntaxNode('unprefixed_name', tok.text, []);
	}

	/** Parse zero or more predicate nodes `[expr]`. */
	private parsePredicates(): ASyntaxNode[] {
		const preds: ASyntaxNode[] = [];
		while (this.peekKind() === TokenKind.LBRACKET) {
			const lbTok = this.advance();
			const exprWrapper = this.parseExprWrapper();
			const rbTok = this.expect(TokenKind.RBRACKET);
			const text = `[${exprWrapper.text}]`;
			preds.push(makeSyntaxNode('predicate', text, [exprWrapper]));
		}
		return preds;
	}

	// -------------------------------------------------------------------------
	// Filter expression (function call, literal, grouped expression)
	// -------------------------------------------------------------------------

	/**
	 * FilterExpr ::= PrimaryExpr Predicate*
	 * PrimaryExpr ::= '(' Expr ')' | Literal | Number | FunctionCall | VariableReference
	 *
	 * Returns the innermost node (function_call / string_literal / number / expr).
	 * The caller wraps it in filter_expr > filter_path_expr.
	 */
	private parseFilterExpr(): ASyntaxNode {
		const primary = this.parsePrimaryExpr();

		// Predicates on a primary (e.g. id("foo")[1])
		const preds = this.parsePredicates();
		if (preds.length === 0) return primary;

		// Wrap primary in filter_expr, then add predicates at filter_path_expr level
		// This is not standard tree-sitter shape for predicates on filter — but we
		// handle this edge case by returning a filter_expr wrapping both.
		// (Rare in practice for XPath 1.0; simplify to filter_expr for now.)
		const feText = buildConcatText(this.src, [primary, ...preds]);
		return makeSyntaxNode('filter_expr', feText, [primary, ...preds]);
	}

	private parsePrimaryExpr(): ASyntaxNode {
		const k = this.peekKind();

		// Grouped expression: ( Expr )
		if (k === TokenKind.LPAREN) {
			this.advance();
			const inner = this.parseExprWrapper();
			this.expect(TokenKind.RPAREN);
			// tree-sitter wraps this in filter_expr already at the call site
			// We return an expr node; the caller will wrap in filter_expr
			return inner;
		}

		// String literal
		if (k === TokenKind.STRING) {
			const tok = this.advance();
			return makeSyntaxNode('string_literal', tok.text, []);
		}

		// Number
		if (k === TokenKind.NUMBER) {
			const tok = this.advance();
			return makeSyntaxNode('number', tok.text, []);
		}

		// Function call
		if (k === TokenKind.FUNCTION_NAME) {
			return this.parseFunctionCall();
		}

		// FUNCTION_NAME-like names that aren't in step position (e.g. some names
		// that could be function calls). NAME tokens in a non-step context are
		// likely function calls too if followed by (.
		if (k === TokenKind.NAME) {
			// Peek further — if next is (, treat as function call
			const saved = this.pos;
			const nameTok = this.advance();
			if (this.peekKind() === TokenKind.LPAREN) {
				// Rewind to re-parse as function call, but we already consumed name
				// Build function_call directly
				this.advance(); // consume (
				const args = this.parseFunctionArguments();
				this.expect(TokenKind.RPAREN);
				const fnNameInner = makeSyntaxNode('unprefixed_name', nameTok.text, []);
				const fnName = makeSyntaxNode('function_name', nameTok.text, [fnNameInner]);
				const allChildren: ASyntaxNode[] = [fnName, ...args];
				const text = buildCallText(nameTok.text, args);
				return makeSyntaxNode('function_call', text, allChildren);
			}
			// Rewind — it's actually a path, let parsePathExpr handle it
			this.pos = saved;
			this.error();
		}

		this.error();
	}

	private parseFunctionCall(): ASyntaxNode {
		const nameTok = this.advance(); // FUNCTION_NAME token
		this.expect(TokenKind.LPAREN);
		const args = this.parseFunctionArguments();
		this.expect(TokenKind.RPAREN);

		const colonIdx = nameTok.text.indexOf(':');
		let fnNameInner: ASyntaxNode;

		if (colonIdx > -1) {
			const prefixText = nameTok.text.slice(0, colonIdx);
			const localText = nameTok.text.slice(colonIdx + 1);
			const prefixNode = makeSyntaxNode('prefix', prefixText, []);
			const localNode = makeSyntaxNode('local_part', localText, []);
			fnNameInner = makeSyntaxNode('prefixed_name', nameTok.text, [prefixNode, localNode]);
		} else {
			fnNameInner = makeSyntaxNode('unprefixed_name', nameTok.text, []);
		}

		const fnName = makeSyntaxNode('function_name', nameTok.text, [fnNameInner]);
		const allChildren: ASyntaxNode[] = [fnName, ...args];
		const text = buildCallText(nameTok.text, args);
		return makeSyntaxNode('function_call', text, allChildren);
	}

	private parseFunctionArguments(): ASyntaxNode[] {
		const args: ASyntaxNode[] = [];

		if (this.peekKind() === TokenKind.RPAREN) {
			return args;
		}

		// First argument
		const firstExpr = this.parseExprWrapper();
		args.push(makeSyntaxNode('argument', firstExpr.text, [firstExpr]));

		while (this.peekKind() === TokenKind.COMMA) {
			this.advance();
			const argExpr = this.parseExprWrapper();
			args.push(makeSyntaxNode('argument', argExpr.text, [argExpr]));
		}

		return args;
	}
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Wrap `inner` in a `filter_expr` > `filter_path_expr` chain.
 * This matches the tree-sitter shape for literals and function calls at the
 * expression level (i.e. not in a path step).
 */
function wrapInFilterPathExpr(inner: ASyntaxNode): ASyntaxNode {
	const filterExpr = makeSyntaxNode('filter_expr', inner.text, [inner]);
	return makeSyntaxNode('filter_path_expr', inner.text, [filterExpr]);
}

/**
 * Compute the source text spanned by a binary expression from left to right.
 * Uses .text on both operands; assumes they appear in source order.
 */
function computeBinaryText(src: string, left: ASyntaxNode, right: ASyntaxNode): string {
	const l = src.indexOf(left.text);
	const rEnd = src.indexOf(right.text, l) + right.text.length;
	if (l >= 0 && rEnd > l) return src.slice(l, rEnd);
	return `${left.text} ${right.text}`;
}

function findNodeStart(node: ASyntaxNode, src: string): number {
	const idx = src.indexOf(node.text);
	return idx >= 0 ? idx : 0;
}

function endOffset(node: ASyntaxNode, src: string): number {
	const idx = src.indexOf(node.text);
	return idx >= 0 ? idx + node.text.length : src.length;
}

function endOffsetFromChildren(children: ASyntaxNode[], src: string): number {
	let max = 0;
	for (const c of children) {
		const e = endOffset(c, src);
		if (e > max) max = e;
	}
	return max;
}

function buildStepText(src: string, base: string, children: ASyntaxNode[]): string {
	if (children.length <= 1) return base;
	// Include predicate text
	const parts = children.map((c) => c.text);
	return parts.join('');
}

function buildConcatText(src: string, nodes: ASyntaxNode[]): string {
	return nodes.map((n) => n.text).join('');
}

function buildCallText(name: string, args: ASyntaxNode[]): string {
	if (args.length === 0) return `${name}()`;
	return `${name}(${args.map((a) => a.text).join(', ')})`;
}
