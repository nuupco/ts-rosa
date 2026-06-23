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
 * Create a frozen, immutable SyntaxNode.
 * The `type` parameter accepts `AnySyntaxType | '//'` because `//` is the
 * unnamed literal emitted as a sibling in `abbreviated_absolute_location_path`.
 */
export function makeSyntaxNode(
	type: AnySyntaxType | '//',
	text: string,
	children: readonly ASyntaxNode[]
): ASyntaxNode {
	const node: ASyntaxNode = Object.freeze({
		type,
		text,
		childCount: children.length,
		children: Object.freeze([...children]) as readonly ASyntaxNode[],
		child(index: number): ASyntaxNode | null {
			return children[index] ?? null;
		},
	});

	return node;
}
