/**
 * generate-xpath-golden.ts
 *
 * Regenerates the structural AST shapes used as oracle in
 * tests/unit/xpath/parser-golden.test.ts by running the real
 * web-tree-sitter + @getodk/tree-sitter-xpath grammar.
 *
 * HOW TO RUN
 * ----------
 *   bun run scripts/generate-xpath-golden.ts
 *
 * OUTPUT
 * ------
 * Prints to stdout a JSON array of { expr, shape } objects, where `shape`
 * matches the NodeShape interface in parser-golden.test.ts (type, text,
 * childCount, children). Redirect to a file if you want to diff it:
 *
 *   bun run scripts/generate-xpath-golden.ts > /tmp/golden-actual.json
 *
 * REQUIREMENTS
 * ------------
 * - The `reference/web-forms` clone must exist at the repository root.
 *   It is NOT a production or test-runtime dependency — only needed for
 *   regeneration or to verify the golden shapes are still accurate.
 * - Tested against web-tree-sitter 0.24.5 / @getodk/tree-sitter-xpath 0.2.2
 *   (upstream commit c02a421).
 *
 * VERIFYING AGAINST THE HARDCODED GOLDEN
 * ---------------------------------------
 * Run this script and compare its output with the hardcoded shapes in
 * tests/unit/xpath/parser-golden.test.ts. Any structural divergence means
 * the PureJSExpressionParser and tree-sitter disagree — that is a bug in
 * the pure-TS parser, not in the golden file.
 *
 * IMPORTANT: do not add web-tree-sitter to package.json dependencies.
 * It is intentionally excluded from the production and test bundles.
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths — resolve relative to this script's location
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const refNodeModules = resolve(repoRoot, 'reference/web-forms/node_modules');

const webTreeSitterPath = resolve(refNodeModules, 'web-tree-sitter/tree-sitter.js');
const wasmParserPath = resolve(
	refNodeModules,
	'@getodk/tree-sitter-xpath/dist/tree-sitter-xpath.wasm'
);
const webTreeSitterWasmPath = resolve(refNodeModules, 'web-tree-sitter/tree-sitter.wasm');

// ---------------------------------------------------------------------------
// Expressions — must match exactly what parser-golden.test.ts exercises
// ---------------------------------------------------------------------------

const EXPRESSIONS: string[] = [
	'5',
	"'hello'",
	'1 + 2',
	'2 + 3 * 4',
	'1 + 2 + 3',
	'3 > 2',
	'1 = 1',
	'1 != 2',
	'true() and false()',
	'true() or false()',
	'-1',
	'/root/a',
	'/',
	'//item',
	'foo/bar',
	'.',
	'..',
	'node()',
	'foo[1]',
	'child::foo',
	'@attr',
	'self::node()',
	'foo()',
	"boolean-from-string('true')",
	'a | b',
	'count(//item)',
];

// ---------------------------------------------------------------------------
// NodeShape — mirrors parser-golden.test.ts interface
// ---------------------------------------------------------------------------

interface NodeShape {
	type: string;
	text?: string;
	childCount?: number;
	children?: NodeShape[];
}

// ---------------------------------------------------------------------------
// Shape extractor — captures type + text + children recursively.
// Depth is limited to avoid enormous output for large trees.
// ---------------------------------------------------------------------------

function extractShape(node: any, depth = 0, maxDepth = 8): NodeShape {
	const shape: NodeShape = { type: node.type as string };

	if (node.childCount === 0) {
		shape.text = node.text as string;
		shape.childCount = 0;
	} else {
		shape.childCount = node.childCount as number;
		if (depth < maxDepth) {
			shape.children = [];
			for (let i = 0; i < (node.childCount as number); i++) {
				shape.children.push(extractShape(node.child(i), depth + 1, maxDepth));
			}
		}
	}

	return shape;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	// web-tree-sitter is a CommonJS module — use createRequire
	const require = createRequire(import.meta.url);
	const TreeSitter = require(webTreeSitterPath) as any;

	await TreeSitter.init({ locateFile: () => webTreeSitterWasmPath });

	const XPath = await TreeSitter.Language.load(wasmParserPath);
	const parser = new TreeSitter();
	parser.setLanguage(XPath);

	const results: Array<{ expr: string; shape: NodeShape }> = [];

	for (const expr of EXPRESSIONS) {
		const tree = parser.parse(expr);
		const shape = extractShape(tree.rootNode);
		results.push({ expr, shape });
	}

	// eslint-disable-next-line no-console
	console.log(JSON.stringify(results, null, 2));
}

main().catch((err: unknown) => {
	console.error('generate-xpath-golden failed:', err);
	process.exit(1);
});
