/**
 * T1 — Verify the QName variable token shape against the real Tokenizer,
 * BEFORE any parser code assumes a shape (design Decision 1 / risk #1).
 *
 * Confirmed finding: `$` always lexes to a standalone DOLLAR token
 * (Tokenizer.ts case '$'). The name that follows — whether a bare NCName
 * or a QName (`ns:local`) — is lexed by the existing NCName/QName scanner
 * as a SINGLE NAME token whose `.text` is the full qualified name
 * (e.g. "ns:myvar"), NOT a NAME/COLON_COLON/NAME sequence (`::` is a
 * distinct two-char token reserved for axis separators). So `$ns:myvar`
 * tokenizes as: DOLLAR, NAME("ns:myvar"), EOF.
 */
import { describe, expect, it } from 'vitest';
import { tokenize, TokenKind } from '../../../src/xpath/parser/Tokenizer.ts';

describe('Tokenizer — variable reference token shape', () => {
	it('lexes $name as DOLLAR followed by a single NAME token', () => {
		const tokens = tokenize('$var_float_five');

		expect(tokens.map((t) => t.kind)).toEqual([TokenKind.DOLLAR, TokenKind.NAME, TokenKind.EOF]);
		expect(tokens[1]?.text).toBe('var_float_five');
	});

	it('lexes $ns:myvar (QName form) as DOLLAR followed by ONE NAME token with the full qualified name', () => {
		const tokens = tokenize('$ns:myvar');

		expect(tokens.map((t) => t.kind)).toEqual([TokenKind.DOLLAR, TokenKind.NAME, TokenKind.EOF]);
		expect(tokens[1]?.text).toBe('ns:myvar');
	});

	it('does not emit COLON_COLON for a QName variable reference (that token is reserved for axis separators)', () => {
		const tokens = tokenize('$ns:myvar');

		expect(tokens.some((t) => t.kind === TokenKind.COLON_COLON)).toBe(false);
	});
});
