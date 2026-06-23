/**
 * @vendored from @getodk/xpath
 *
 * Minimal ExpressionParser interface — the TreeSitter-based implementation is
 * excluded from the vendor bundle. A pure-JS implementation will be injected
 * via EvaluatorOptions.parser in Slice 2.
 *
 * Only the interface types are preserved here; the class constructor and all
 * TreeSitter / WASM references are removed.
 */

import type { XPathNode } from './SyntaxNode.ts';
import type { SyntaxTree } from './SyntaxTree.ts';

export interface ParseOptions {
	readonly attemptErrorRecovery?: boolean;
}

/**
 * Minimal parse interface consumed by {@link Evaluator}.
 *
 * The vendored {@link Evaluator} accepts an instance of this interface via
 * {@link EvaluatorOptions.parser}. When no parser is provided the evaluator
 * throws at construction time with an actionable message.
 */
export interface ExpressionParser {
	parse(expression: string, options?: ParseOptions): SyntaxTree & { readonly rootNode: XPathNode };
}
