/**
 * Native `pulldata()` XPath function for ts-rosa.
 *
 * Rationale: the vendor pulldata implementation (xforms/string.ts) calls
 * `context.evaluator.evaluateString(expr)` without a contextNode option.
 * The vendored Evaluator singleton has no rootNode set, so that call throws:
 *   "Context node must be provided in options or as Evaluator constructor options.rootNode"
 *
 * Fix: build the same XPath expression the vendor builds, then evaluate it
 * directly via `context.evaluator.evaluate(expr, rootNode, ...)`, passing the
 * document root as the context node so that `instance('id')/root/...` paths
 * resolve against the correct secondary instance map.
 *
 * We use `context.evaluator` (the already-wired Evaluator from the current
 * LocationPathEvaluation) rather than importing `instanceEvaluator` directly —
 * that would introduce a circular import: index.ts → xforms-pulldata.ts →
 * InstanceEvaluator.ts → index.ts (defaultFunctions).
 *
 * pulldata(instanceId, desiredCol, lookupCol, lookupVal)
 *   → instance(instanceId)/root/item[lookupCol='lookupVal']/desiredCol
 *
 * Performance: CSV-backed secondary instances (jr://file-csv/*) can hold
 * thousands to hundreds of thousands of `item` rows (see
 * src/parse/csv/csvToInstanceTree.ts). A cascade of pulldata() calls off one
 * answer previously re-parsed the built expression AND linearly scanned
 * every row on every single call — multi-second UI freezes for cascades of
 * 3+ calls (see reported issue: a single answerQuestion() call taking
 * ~6.4s). Below, a per-(secondary-instance-root, lookup-column) index is
 * built lazily on first use and cached in a WeakMap keyed by the secondary
 * instance's root InstanceNode, turning subsequent lookups (same instance +
 * lookup column, different lookup value) into O(1) Map reads instead of an
 * O(n) scan. The index is only used when the secondary instance root is
 * structurally flat (root → item → leaf column, no attributes) — the shape
 * csvToInstanceTree.ts always produces. Non-CSV secondary instances (inline
 * XML `<instance>` blocks resolved via resolveExternalInstances.ts) can have
 * nested elements, repeated child names, or attributes, so they fall back to
 * the original XPath evaluation path, which remains fully correct for them.
 */

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { StringFunction } from '../vendor/xpath/evaluator/functions/StringFunction.ts';
import type { InstanceDocumentNode, InstanceXPathNode } from '../adapter/instance/InstanceXPathNode.ts';
import { XPATH_EVALUATION_RESULT } from '../vendor/xpath/evaluator/result/XPathEvaluationResult.ts';
import type { InstanceNode } from '../../model/instance/InstanceNode.ts';

/** Escapes a value for safe interpolation inside a single-quoted XPath string literal. */
const escapeXPathStringLiteral = (value: string): string => value.replace(/'/g, "&apos;");

/** Reads an InstanceNode's value as a plain string, or null if it has none. */
function nodeValueAsString(node: InstanceNode): string | null {
  const value = node.value;
  if (value == null) return null;
  return value.kind === 'string' || value.kind === 'uncast' ? value.value : value.displayText;
}

type SecondaryInstanceIndex = {
  readonly isFlat: boolean;
  readonly columnIndexes: Map<string, ReadonlyMap<string, InstanceNode>>;
};

const secondaryInstanceIndexCache = new WeakMap<InstanceNode, SecondaryInstanceIndex>();

/**
 * A secondary instance root is safe for direct (non-XPath) indexed lookup
 * only if it matches the flat root → item → leaf-column shape
 * csvToInstanceTree.ts always produces: no item carries XML attributes, and
 * no column node has children of its own.
 */
function isFlatItemColumnTree(root: InstanceNode): boolean {
  for (const item of root.children) {
    if (item.attributes != null) return false;
    for (const column of item.children) {
      if (column.children.length > 0 || column.attributes != null) return false;
    }
  }
  return true;
}

function getSecondaryInstanceIndex(root: InstanceNode): SecondaryInstanceIndex {
  let index = secondaryInstanceIndexCache.get(root);
  if (index == null) {
    index = { isFlat: isFlatItemColumnTree(root), columnIndexes: new Map() };
    secondaryInstanceIndexCache.set(root, index);
  }
  return index;
}

function getColumnIndex(root: InstanceNode, lookupColumn: string): ReadonlyMap<string, InstanceNode> | null {
  const index = getSecondaryInstanceIndex(root);
  if (!index.isFlat) return null;

  let columnIndex = index.columnIndexes.get(lookupColumn);
  if (columnIndex == null) {
    const byLookupValue = new Map<string, InstanceNode>();
    for (const item of root.children) {
      const column = item.children.find((child) => child.name === lookupColumn);
      const columnValue = column == null ? null : nodeValueAsString(column);
      // First matching row wins, matching XPath string()'s first-node-in-
      // document-order semantics over the `item[lookupCol='lookupVal']` node-set.
      if (columnValue != null && !byLookupValue.has(columnValue)) {
        byLookupValue.set(columnValue, item);
      }
    }
    columnIndex = byLookupValue;
    index.columnIndexes.set(lookupColumn, columnIndex);
  }
  return columnIndex;
}

export const pulldata = new StringFunction(
  'pulldata',
  [
    { arityType: 'required', typeHint: 'string' },
    { arityType: 'required', typeHint: 'string' },
    { arityType: 'required', typeHint: 'string' },
    { arityType: 'required', typeHint: 'string' },
  ],
  <T extends XPathNode>(
    context: LocationPathEvaluation<T>,
    [instanceExpression, desiredElementExpression, queryElementExpression, queryExpression]: readonly EvaluableArgument[],
  ): string => {
    const instanceId = instanceExpression!.evaluate(context).toString();
    const desiredElement = desiredElementExpression!.evaluate(context).toString();
    const queryElement = queryElementExpression!.evaluate(context).toString();
    const query = queryExpression!.evaluate(context).toString();

    const doc = context.contextDocument as unknown as InstanceDocumentNode;
    const secondaryDoc: InstanceXPathNode | null = doc.secondaryInstances?.get(instanceId) ?? null;

    if (secondaryDoc != null && secondaryDoc.kind === 'document') {
      const root = secondaryDoc.tree.root;
      const columnIndex = getColumnIndex(root, queryElement);
      if (columnIndex != null) {
        const item = columnIndex.get(query);
        if (item == null) return '';
        const desiredNode = item.children.find((child) => child.name === desiredElement);
        return desiredNode == null ? '' : (nodeValueAsString(desiredNode) ?? '');
      }
    }

    // Fallback: non-CSV (e.g. inline XML) secondary instance, or the
    // instance id couldn't be resolved directly — defer to the general
    // XPath evaluator so existing semantics (including error behavior for
    // an unresolved instance id) are preserved unchanged.
    const expr = `instance('${escapeXPathStringLiteral(instanceId)}')/root/item[${queryElement}='${escapeXPathStringLiteral(query)}']/${desiredElement}`;

    // Evaluate using the already-wired evaluator from the current context —
    // avoids a circular import with InstanceEvaluator.ts.
    // rootNode is the InstanceDocumentNode; getContainingDocument(rootNode)
    // returns itself, so contextDocument.secondaryInstances is available to
    // the inner instance() call.
    const rootNode = context.rootNode as unknown as InstanceXPathNode;
    return context.evaluator.evaluate(
      expr,
      rootNode as unknown as T,
      null,
      XPATH_EVALUATION_RESULT.STRING_TYPE,
    ).stringValue;
  },
);
