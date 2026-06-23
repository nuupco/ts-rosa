/**
 * Frozen plain-object implementation of the SyntaxNode interface consumed by
 * the vendored evaluator (`src/xpath/vendor/xpath/static/grammar/SyntaxNode.ts`).
 *
 * The evaluators access nodes only via:
 *   - node.type      — the grammar-level type string
 *   - node.text      — full source text spanned by this node
 *   - node.childCount
 *   - node.children  — positional array (destructured in evaluators)
 *   - node.child(i)  — returns children[i] ?? null
 *
 * We do NOT re-export ASyntaxNode from the vendor to avoid coupling; the
 * interface defined here is structurally compatible with it.
 */

import type { AnySyntaxType } from '../vendor/xpath/static/grammar/type-names.ts';

export interface ASyntaxNode {
	readonly type: AnySyntaxType | '//';
	readonly text: string;
	readonly childCount: number;
	readonly children: readonly ASyntaxNode[];
	child(index: number): ASyntaxNode | null;
}

export interface ParsedTree {
	readonly rootNode: ASyntaxNode;
}

/**
 * Internal concrete type that extends ASyntaxNode with source-range metadata.
 * The `_startOffset` and `_endOffset` fields track the node's byte range within
 * the original expression string. They are used by computeBinaryText() to
 * compute parent node text without relying on indexOf() (which is ambiguous
 * when the same substring appears multiple times, e.g. "1 + 1").
 *
 * These fields are NOT part of the public ASyntaxNode interface so consumers
 * (the vendored evaluators) never see them.
 */
export interface SyntaxNodeWithOffsets extends ASyntaxNode {
	readonly _startOffset: number;
	readonly _endOffset: number;
}

export function hasSyntaxOffsets(node: ASyntaxNode): node is SyntaxNodeWithOffsets {
	return '_startOffset' in node;
}

/**
 * Create a frozen, immutable SyntaxNode.
 * The `type` parameter accepts `AnySyntaxType | '//'` because `//` is the
 * unnamed literal emitted as a sibling in `abbreviated_absolute_location_path`.
 *
 * `startOffset` and `endOffset` are the byte indices of this node within the
 * original source expression. When provided they enable O(1) parent-text
 * computation; when omitted the node falls back to text-based heuristics.
 */
export function makeSyntaxNode(
	type: AnySyntaxType | '//',
	text: string,
	children: readonly ASyntaxNode[],
	startOffset?: number,
	endOffset?: number
): ASyntaxNode {
	const hasOffsets =
		startOffset !== undefined && endOffset !== undefined;

	const base = {
		type,
		text,
		childCount: children.length,
		children: Object.freeze([...children]) as readonly ASyntaxNode[],
		child(index: number): ASyntaxNode | null {
			return children[index] ?? null;
		},
	};

	const node = hasOffsets
		? Object.freeze({ ...base, _startOffset: startOffset, _endOffset: endOffset })
		: Object.freeze(base);

	return node;
}
