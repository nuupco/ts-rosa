/**
 * XPath 1.0 tokenizer with §3.7 lexical disambiguation rules.
 *
 * Disambiguation rules (from XPath 1.0 spec §3.7):
 * - `*` is a MultiplyOperator when preceded by an operand token (AxisName,
 *   NCName, number, string literal, `)`, `]`); otherwise it is a NameTest wildcard.
 * - `div`, `mod`, `and`, `or` are operators only when they follow an operand token.
 * - `-` is unary negation or binary subtraction depending on context (handled by
 *   the parser, not here — tokenizer always emits MINUS).
 * - `::` must follow an NCName to be an axis separator (AxisName `::` form).
 * - `(` following an NCName is a function call opening or node-type keyword.
 */

export const enum TokenKind {
	// Literals
	NUMBER = 'NUMBER',
	STRING = 'STRING',

	// Names / tests
	AXIS_NAME = 'AXIS_NAME',
	NODE_TYPE = 'NODE_TYPE',
	FUNCTION_NAME = 'FUNCTION_NAME',
	WILDCARD = 'WILDCARD', // bare *
	PREFIXED_WILDCARD = 'PREFIXED_WILDCARD', // ns:*
	NAME = 'NAME', // NCName or QName used as step test

	// Operators — arithmetic
	PLUS = 'PLUS',
	MINUS = 'MINUS',
	MULTIPLY = 'MULTIPLY',
	DIV = 'DIV',
	MOD = 'MOD',

	// Operators — comparison
	EQ = 'EQ',
	NEQ = 'NEQ',
	LT = 'LT',
	LTE = 'LTE',
	GT = 'GT',
	GTE = 'GTE',

	// Operators — boolean
	AND = 'AND',
	OR = 'OR',

	// Operators — union
	PIPE = 'PIPE',

	// Punctuation
	LPAREN = 'LPAREN',
	RPAREN = 'RPAREN',
	LBRACKET = 'LBRACKET',
	RBRACKET = 'RBRACKET',
	DOT = 'DOT',
	DOTDOT = 'DOTDOT',
	SLASH = 'SLASH',
	SLASHSLASH = 'SLASHSLASH',
	AT = 'AT',
	COMMA = 'COMMA',
	COLON_COLON = 'COLON_COLON',
	DOLLAR = 'DOLLAR',

	EOF = 'EOF',
}

export interface Token {
	readonly kind: TokenKind;
	/** The source text of the token, trimmed of surrounding whitespace. */
	readonly text: string;
	/** Byte offset where this token starts in the source string. */
	readonly start: number;
}

/** Node-type keywords that look like function calls in XPath 1.0 §2.3. */
const NODE_TYPE_KEYWORDS = new Set(['comment', 'text', 'processing-instruction', 'node']);

/** Axis names from XPath 1.0 §2.2. */
const AXIS_NAMES = new Set([
	'ancestor',
	'ancestor-or-self',
	'attribute',
	'child',
	'descendant',
	'descendant-or-self',
	'following',
	'following-sibling',
	'namespace',
	'parent',
	'preceding',
	'preceding-sibling',
	'self',
]);

/**
 * Token kinds that count as an "operand" for §3.7 disambiguation.
 * After one of these, `*` is multiply, and `div`/`mod`/`and`/`or` are operators.
 */
const OPERAND_KINDS = new Set<TokenKind>([
	TokenKind.NUMBER,
	TokenKind.STRING,
	TokenKind.NAME,
	TokenKind.WILDCARD,
	TokenKind.PREFIXED_WILDCARD,
	TokenKind.RPAREN,
	TokenKind.RBRACKET,
	TokenKind.NODE_TYPE,
	TokenKind.FUNCTION_NAME,
	TokenKind.AXIS_NAME,
]);

/**
 * Return true if the previous real token (ignoring whitespace) indicates
 * that the next ambiguous token is an operator, not a name/wildcard.
 */
function isAfterOperand(prev: Token | null): boolean {
	return prev !== null && OPERAND_KINDS.has(prev.kind);
}

/** Matches the start of a number literal. */
const NUMBER_RE = /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)/;

/** Matches NCName (NameStartChar followed by NameChar*). */
// Simplified to ASCII for XPath 1.0 practical purposes.
const NCNAME_RE = /^[A-Za-z_][A-Za-z0-9._-]*/;

export function tokenize(expression: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;
	let prev: Token | null = null;

	const push = (kind: TokenKind, text: string, start: number): void => {
		const t: Token = { kind, text, start };
		tokens.push(t);
		prev = t;
	};

	while (pos < expression.length) {
		// Skip whitespace
		const wsMatch = /^\s+/.exec(expression.slice(pos));
		if (wsMatch) {
			pos += wsMatch[0].length;
			continue;
		}

		const ch = expression[pos];

		if (ch === undefined) break;

		// Two-character operators first
		const two = expression.slice(pos, pos + 2);

		if (two === '//') {
			push(TokenKind.SLASHSLASH, '//', pos);
			pos += 2;
			continue;
		}

		if (two === '::') {
			push(TokenKind.COLON_COLON, '::', pos);
			pos += 2;
			continue;
		}

		if (two === '..') {
			push(TokenKind.DOTDOT, '..', pos);
			pos += 2;
			continue;
		}

		if (two === '!=') {
			push(TokenKind.NEQ, '!=', pos);
			pos += 2;
			continue;
		}

		if (two === '<=') {
			push(TokenKind.LTE, '<=', pos);
			pos += 2;
			continue;
		}

		if (two === '>=') {
			push(TokenKind.GTE, '>=', pos);
			pos += 2;
			continue;
		}

		// Single-character punctuation
		switch (ch) {
			case '/': push(TokenKind.SLASH, '/', pos++); continue;
			case '+': push(TokenKind.PLUS, '+', pos++); continue;
			case '-': push(TokenKind.MINUS, '-', pos++); continue;
			case '=': push(TokenKind.EQ, '=', pos++); continue;
			case '<': push(TokenKind.LT, '<', pos++); continue;
			case '>': push(TokenKind.GT, '>', pos++); continue;
			case '|': push(TokenKind.PIPE, '|', pos++); continue;
			case '(': push(TokenKind.LPAREN, '(', pos++); continue;
			case ')': push(TokenKind.RPAREN, ')', pos++); continue;
			case '[': push(TokenKind.LBRACKET, '[', pos++); continue;
			case ']': push(TokenKind.RBRACKET, ']', pos++); continue;
			case ',': push(TokenKind.COMMA, ',', pos++); continue;
			case '@': push(TokenKind.AT, '@', pos++); continue;
			case '$': push(TokenKind.DOLLAR, '$', pos++); continue;
			case '.': {
				// If followed by a digit, this is a leading-dot number literal (.NNN).
				// Fall through to the NUMBER check below instead of emitting DOT.
				if (expression[pos + 1] !== undefined && /[0-9]/.test(expression[pos + 1]!)) break;
				push(TokenKind.DOT, '.', pos++);
				continue;
			}
		}

		// Multiply / wildcard disambiguation (§3.7)
		if (ch === '*') {
			if (isAfterOperand(prev)) {
				push(TokenKind.MULTIPLY, '*', pos++);
			} else {
				push(TokenKind.WILDCARD, '*', pos++);
			}
			continue;
		}

		// String literal
		if (ch === '"' || ch === "'") {
			const quote = ch;
			const start = pos++;
			while (pos < expression.length && expression[pos] !== quote) {
				pos++;
			}
			if (pos >= expression.length) {
				throw new Error(`Unterminated string literal in XPath: ${expression}`);
			}
			pos++; // consume closing quote
			push(TokenKind.STRING, expression.slice(start, pos), start);
			continue;
		}

		// Number
		const numMatch = NUMBER_RE.exec(expression.slice(pos));
		if (numMatch) {
			push(TokenKind.NUMBER, numMatch[0], pos);
			pos += numMatch[0].length;
			continue;
		}

		// NCName / QName / axis / keyword
		const nameMatch = NCNAME_RE.exec(expression.slice(pos));
		if (nameMatch) {
			const rawName = nameMatch[0];
			const start = pos;
			pos += rawName.length;

			// Check for QName (prefix:localPart) or prefixed wildcard (prefix:*)
			if (expression[pos] === ':' && expression[pos + 1] !== ':') {
				// This is a colon that is NOT `::` (already handled above)
				const colon = pos;
				pos++; // consume ':'
				if (expression[pos] === '*') {
					// prefix:* → prefixed wildcard name test
					pos++;
					push(TokenKind.PREFIXED_WILDCARD, `${rawName}:*`, start);
					continue;
				}
				const localMatch = NCNAME_RE.exec(expression.slice(pos));
				if (localMatch) {
					pos += localMatch[0].length;
					const qname = `${rawName}:${localMatch[0]}`;
					// A QName that looks like an axis name followed by `::` was already
					// handled (the `::` check above ran before reaching here); so here
					// a colon that is not `::` means it is a namespace prefix separator.
					//
					// Look ahead past whitespace to check for `(` — a prefixed QName
					// followed by `(` is a namespace-qualified function call (e.g. jr:itext())
					// and must be emitted as FUNCTION_NAME so parseFunctionCall() handles it.
					let qla = pos;
					while (qla < expression.length && /\s/.test(expression[qla]!)) qla++;
					if (expression[qla] === '(') {
						push(TokenKind.FUNCTION_NAME, qname, start);
					} else {
						push(TokenKind.NAME, qname, start);
					}
					continue;
				}
				// Rewind: the colon was not part of a QName
				pos = colon;
			}

			// Look ahead past whitespace
			let la = pos;
			while (la < expression.length && /\s/.test(expression[la]!)) la++;
			const nextCh = expression[la];

			// axis_name `::` — only if the next non-ws chars are `::`
			if (
				expression[la] === ':' &&
				expression[la + 1] === ':' &&
				AXIS_NAMES.has(rawName)
			) {
				push(TokenKind.AXIS_NAME, rawName, start);
				continue;
			}

			// node-type keyword or function_name — lookahead for `(`
			if (nextCh === '(') {
				if (NODE_TYPE_KEYWORDS.has(rawName)) {
					push(TokenKind.NODE_TYPE, rawName, start);
				} else {
					push(TokenKind.FUNCTION_NAME, rawName, start);
				}
				continue;
			}

			// Keyword-operators disambiguation (§3.7)
			// `div`, `mod`, `and`, `or` are operator keywords only after an operand.
			if (isAfterOperand(prev)) {
				if (rawName === 'div') { push(TokenKind.DIV, rawName, start); continue; }
				if (rawName === 'mod') { push(TokenKind.MOD, rawName, start); continue; }
				if (rawName === 'and') { push(TokenKind.AND, rawName, start); continue; }
				if (rawName === 'or')  { push(TokenKind.OR, rawName, start); continue; }
			}

			// Default: treat as a plain name
			push(TokenKind.NAME, rawName, start);
			continue;
		}

		throw new Error(
			`Unexpected character '${ch}' at position ${pos} in XPath expression: ${expression}`
		);
	}

	push(TokenKind.EOF, '', pos);
	return tokens;
}
