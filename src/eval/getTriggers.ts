/**
 * getTriggers — Slice 3.2-T2
 *
 * Walks a PureJSExpressionParser SyntaxNode AST and returns the set of
 * genericized, predicate-stripped, contextualized absolute TreeReferences
 * that the expression depends on.
 *
 * Mirrors JavaRosa XPathConditional.getTriggers (XPathConditional.java:100-143).
 *
 * Contract:
 *   getTriggers(root, contextRef, originalContextRef): TreeReference[]
 *   - root: the xpath/expr AST root from PureJSExpressionParser
 *   - contextRef: the bind's absolute target ref (used to contextualize relative paths)
 *   - originalContextRef: the first/original context (used for current() and . self-ref)
 *   - Returns unique, genericized, predicate-less absolute TreeReferences.
 */

import type { ASyntaxNode } from '../xpath/parser/SyntaxNode.ts';
import {
  type TreeReference,
  REF_ABSOLUTE,
  rootRef,
  extendRef,
  parentOf,
  genericize,
  contextualize,
  refEquals,
  refToString,
} from '../model/instance/TreeReference.ts';
import { INDEX_UNBOUND } from '../model/instance/multiplicity.ts';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract all trigger TreeReferences from a parsed XPath expression AST.
 *
 * @param root - The root ASyntaxNode of a parsed expression (type 'xpath' or 'expr').
 * @param contextRef - Absolute ref of the bind's target node (for relative paths).
 * @param originalContextRef - The original/first context (for current() and `.`).
 * @returns Deduplicated, genericized, predicate-stripped absolute TreeReferences.
 */
export function getTriggers(
  root: ASyntaxNode,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): TreeReference[] {
  const collected = new Set<string>();
  const results: TreeReference[] = [];

  function add(ref: TreeReference): void {
    const key = refToString(genericize(ref));
    if (!collected.has(key)) {
      collected.add(key);
      results.push(genericize(ref));
    }
  }

  function walk(node: ASyntaxNode): void {
    switch (node.type) {
      // -----------------------------------------------------------------------
      // Wrappers — just recurse into children
      // -----------------------------------------------------------------------
      case 'xpath':
      case 'expr':
        for (const child of node.children) walk(child);
        break;

      // -----------------------------------------------------------------------
      // Absolute location path: /a/b/c or //foo
      // Children: [absolute_root_location_path, step, step, ...]
      //       or: [abbreviated_absolute_location_path]
      // -----------------------------------------------------------------------
      case 'absolute_location_path': {
        const ref = decodeAbsoluteLocationPath(node, contextRef, originalContextRef);
        if (ref !== null) add(ref);
        // Also recurse into predicates of each step to collect inner triggers
        walkAbsolutePathPredicates(node, contextRef, originalContextRef, add);
        break;
      }

      // -----------------------------------------------------------------------
      // Relative location path: a/b/c or ./foo or ../foo
      // Children: [step, step, ...] with optional '//' literal siblings
      // -----------------------------------------------------------------------
      case 'relative_location_path': {
        const ref = decodeRelativeLocationPath(node, contextRef, originalContextRef);
        if (ref !== null) add(ref);
        // Recurse into predicates of each step
        walkAbsolutePathPredicates(node, contextRef, originalContextRef, add);
        break;
      }

      // -----------------------------------------------------------------------
      // filter_path_expr: FilterExpr / RelativeLocationPath
      // Children: [filter_path_expr (head), step, step, ...]
      // The head is a filter expression; recurse into it for its own triggers.
      // The trailing steps (if any) form a relative path on top of the head result —
      // we recurse into them as individual expressions too.
      // -----------------------------------------------------------------------
      case 'filter_path_expr': {
        for (const child of node.children) {
          if (child.type === 'filter_expr') {
            walk(child);
          } else if (child.type === 'filter_path_expr') {
            // Nested filter_path_expr (e.g. instance('id')/a/b[p] as the
            // left-hand base of an outer filter_path_expr). Recurse fully.
            walk(child);
          } else if (child.type === 'step') {
            // A step following a filter — walk its predicates for nested triggers
            walkStepPredicates(child, contextRef, originalContextRef, walk);
          }
          // '//' literals are skipped
        }
        break;
      }

      // -----------------------------------------------------------------------
      // filter_expr: wraps function_call, string_literal, number, expr
      // -----------------------------------------------------------------------
      case 'filter_expr':
        for (const child of node.children) walk(child);
        break;

      // -----------------------------------------------------------------------
      // Binary expressions — recurse into both operands
      // -----------------------------------------------------------------------
      case 'addition_expr':
      case 'subtraction_expr':
      case 'multiplication_expr':
      case 'division_expr':
      case 'modulo_expr':
      case 'and_expr':
      case 'or_expr':
      case 'eq_expr':
      case 'ne_expr':
      case 'lt_expr':
      case 'lte_expr':
      case 'gt_expr':
      case 'gte_expr':
      case 'union_expr':
        for (const child of node.children) walk(child);
        break;

      // -----------------------------------------------------------------------
      // Unary expression — recurse into the single operand
      // -----------------------------------------------------------------------
      case 'unary_expr':
        for (const child of node.children) walk(child);
        break;

      // -----------------------------------------------------------------------
      // function_call — recurse into argument children.
      // Special: current() → add originalContextRef as a trigger.
      // -----------------------------------------------------------------------
      case 'function_call': {
        const fnNameNode = node.children.find((c) => c.type === 'function_name');
        const fnName = fnNameNode?.text ?? '';

        if (fnName === 'current') {
          // current() returns the original context node — it IS a dependency
          add(originalContextRef);
        } else {
          // Recurse into every argument's expression
          for (const child of node.children) {
            if (child.type === 'argument') {
              for (const argChild of child.children) walk(argChild);
            }
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Literals and variable references — no path triggers
      // -----------------------------------------------------------------------
      case 'number':
      case 'string_literal':
      case 'variable_reference':
        // No path dependency extracted here (variable_reference deps are
        // resolved at DAG build time via the EvaluationContext variable map).
        break;

      // -----------------------------------------------------------------------
      // Steps that appear at the top level (rare — bare '.' or '..')
      // -----------------------------------------------------------------------
      case 'step': {
        const ref = decodeStepAsRelative(node, contextRef, originalContextRef);
        if (ref !== null) add(ref);
        break;
      }

      // -----------------------------------------------------------------------
      // Default: recurse into any unrecognized node's children
      // -----------------------------------------------------------------------
      default:
        for (const child of node.children) walk(child);
        break;
    }
  }

  walk(root);
  return results;
}

// ---------------------------------------------------------------------------
// Path decoding
// ---------------------------------------------------------------------------

/**
 * Decode an absolute_location_path node into a TreeReference.
 * Handles:
 *   - /a/b/c  (absolute_root_location_path + steps)
 *   - //foo   (abbreviated_absolute_location_path inside absolute_location_path)
 */
function decodeAbsoluteLocationPath(
  node: ASyntaxNode,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): TreeReference | null {
  // Check if this is a //foo abbreviated form
  const firstChild = node.children[0];
  if (firstChild?.type === 'abbreviated_absolute_location_path') {
    return decodeAbbreviatedAbsolutePath(firstChild, contextRef, originalContextRef);
  }

  // Normal absolute path: children = [absolute_root_location_path, step, step, ...]
  let ref = rootRef(); // starts at /

  for (const child of node.children) {
    if (child.type === 'absolute_root_location_path') {
      continue; // already have root
    }
    if (child.type === 'step') {
      const updated = applyStepToRef(child, ref, contextRef, originalContextRef);
      if (updated === null) return null; // self/parent on root would go negative — skip
      ref = updated;
      // Also walk predicate sub-expressions for nested triggers (handled by caller via
      // walkStepPredicates — but we can call it here directly for absolute path steps)
    }
  }

  // Strip predicates: TreeReference has no predicate fields (good — already predicate-less)
  return ref;
}

/**
 * Decode //foo → abbreviated_absolute_location_path > ['//', step, ...]
 * Conservative: we record the first named step as an absolute ref prefix.
 */
function decodeAbbreviatedAbsolutePath(
  node: ASyntaxNode,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): TreeReference | null {
  // Children: ['//', step, step, ...]
  let ref = rootRef();
  let seenStep = false;

  for (const child of node.children) {
    if (child.type === '//' || child.text === '//') continue;
    if (child.type === 'step') {
      const updated = applyStepToRef(child, ref, contextRef, originalContextRef);
      if (updated !== null) {
        ref = updated;
        seenStep = true;
      }
    }
  }

  return seenStep ? ref : null;
}

/**
 * Decode a relative_location_path into a TreeReference by contextualizing
 * the steps against contextRef (or originalContextRef for `.`-like starts).
 */
function decodeRelativeLocationPath(
  node: ASyntaxNode,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): TreeReference | null {
  // Start with the contextRef as the base (relative paths are anchored there)
  // But we need to build a relative ref first, then contextualize.
  // Strategy: build relative steps, then prepend contextRef.

  // Determine starting base: check if first step is '.' (self) — use origCtx
  const firstStep = node.children.find((c) => c.type === 'step');
  const isOrigCtx = firstStep !== undefined && isAbbreviatedSelf(firstStep);

  let base: TreeReference = isOrigCtx ? originalContextRef : contextRef;

  // Walk steps and build up the path
  let relative = buildRelativeRef(node.children, contextRef, originalContextRef);
  if (relative === null) return null;

  // If the first step is self (.) the base is already the right root; the
  // relative ref starts from there. If first step is not self, contextualize.
  if (isOrigCtx) {
    // Already anchored on originalContextRef — relative built from AFTER the '.'
    return genericize(relative);
  }

  // For normal relative paths: the steps extend beyond the context
  // buildRelativeRef already incorporates the context via its walking logic
  return genericize(relative);
}

/**
 * Attempt to interpret a bare step node as a relative path element.
 * Used when a step appears at the expression level.
 */
function decodeStepAsRelative(
  node: ASyntaxNode,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): TreeReference | null {
  return applyStepToRef(node, contextRef, originalContextRef, contextRef);
}

// ---------------------------------------------------------------------------
// Step application
// ---------------------------------------------------------------------------

/**
 * Apply a single step to a running TreeReference.
 * Returns updated ref, or null if the step is unresolvable.
 *
 * @param step - the 'step' ASyntaxNode
 * @param current - the running ref being built
 * @param contextRef - the bind context ref (for relative paths)
 * @param originalContextRef - the original context (for '.' self)
 */
function applyStepToRef(
  step: ASyntaxNode,
  current: TreeReference,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): TreeReference | null {
  const firstChild = step.children[0];
  if (firstChild === undefined) return null;

  switch (firstChild.type) {
    case 'abbreviated_step': {
      // '.' (self) or '..' (parent)
      const inner = firstChild.children[0];
      if (inner?.type === 'self') {
        // . → no movement (stay at current position, already contextualized)
        return current;
      }
      if (inner?.type === 'parent') {
        // .. → go up one level
        if (current.levels.length === 0) return null; // can't go above root
        return parentOf(current);
      }
      return null;
    }

    case 'node_test': {
      // Named step: child::foo or just 'foo'
      const name = extractNameFromNodeTest(firstChild);
      if (name === null) return null;
      return extendRef(current, name, INDEX_UNBOUND);
    }

    case 'abbreviated_axis_test': {
      // @attr — attribute step; we record the ELEMENT ref (drop @attr leaf)
      // The attribute step doesn't add a new element level.
      return current;
    }

    case 'axis_test': {
      // explicit axis: child::foo, self::node(), parent::*, etc.
      const axisName = firstChild.children.find((c) => c.type === 'axis_name')?.text ?? '';
      const nodeTestChild = firstChild.children.find(
        (c) => c.type === 'node_test' || c.type === 'node_type_test' || c.type === 'unprefixed_name'
      );
      const name = nodeTestChild ? extractNameFromNodeTest(nodeTestChild) : null;

      switch (axisName) {
        case 'self':
          return current;
        case 'parent':
          return current.levels.length > 0 ? parentOf(current) : null;
        case 'child':
          if (name === null) return current; // node() or * wildcard — stay at current
          return extendRef(current, name, INDEX_UNBOUND);
        default:
          // Other axes (following, preceding, etc.) — best-effort: use name if present
          if (name !== null) return extendRef(current, name, INDEX_UNBOUND);
          return null;
      }
    }

    default:
      return null;
  }
}

/**
 * Build a TreeReference by walking an array of ASyntaxNode children that may
 * contain 'step' nodes and '//' literal separators.
 *
 * For a relative_location_path, we start from contextRef and apply each step.
 * If the first step is '.', we start from originalContextRef.
 */
function buildRelativeRef(
  children: readonly ASyntaxNode[],
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): TreeReference | null {
  const steps = children.filter((c) => c.type === 'step');
  if (steps.length === 0) return null;

  // Determine starting base from first step
  const firstStep = steps[0]!;
  const firstIsOrigCtx = isAbbreviatedSelf(firstStep);
  let current = firstIsOrigCtx ? originalContextRef : contextRef;

  for (const step of steps) {
    const updated = applyStepToRef(step, current, contextRef, originalContextRef);
    if (updated === null) return null;
    current = updated;
  }

  return current;
}

// ---------------------------------------------------------------------------
// Predicate sub-walk
// ---------------------------------------------------------------------------

/**
 * Walk predicate children of a step to collect triggers from inner expressions.
 * The predicate's context is the path up to (but not including) the current step.
 */
function walkStepPredicates(
  step: ASyntaxNode,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
  walker: (node: ASyntaxNode) => void,
): void {
  // Predicates are children of type 'predicate'
  for (const child of step.children) {
    if (child.type === 'predicate') {
      for (const inner of child.children) {
        walker(inner);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk all steps in a location path node (absolute or relative) and recurse
 * into any predicate sub-expressions to collect inner triggers.
 *
 * The predicate context is the path prefix up to that step, but since we
 * don't track partial refs here we use contextRef conservatively.
 */
function walkAbsolutePathPredicates(
  node: ASyntaxNode,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
  add: (ref: TreeReference) => void,
): void {
  function walkNode(n: ASyntaxNode): void {
    if (n.type === 'predicate') {
      // Predicate contains an 'expr' wrapping the inner expression
      for (const child of n.children) {
        // Re-invoke getTriggers on the predicate inner expression
        const innerTriggers = getTriggers(child, contextRef, originalContextRef);
        for (const t of innerTriggers) add(t);
      }
    } else {
      for (const child of n.children) walkNode(child);
    }
  }
  for (const child of node.children) walkNode(child);
}

/**
 * Extract the element name from a node_test node.
 * node_test > unprefixed_name | prefixed_name | unprefixed_wildcard_name_test | etc.
 */
function extractNameFromNodeTest(node: ASyntaxNode): string | null {
  if (node.type === 'unprefixed_name') return node.text;
  if (node.type === 'prefixed_name') {
    // prefixed_name > [prefix, local_part] — use full text for now
    return node.text;
  }

  // node_test wraps a name test
  if (node.type === 'node_test') {
    const inner = node.children[0];
    if (!inner) return null;
    if (inner.type === 'node_type_test') return null; // node() / text() / etc. — wildcard
    return extractNameFromNodeTest(inner);
  }

  if (node.type === 'unprefixed_wildcard_name_test') return null; // * wildcard
  if (node.type === 'prefixed_wildcard_name_test') return null;

  return null;
}

/**
 * Returns true if the step represents the abbreviated self step (`.`).
 */
function isAbbreviatedSelf(step: ASyntaxNode): boolean {
  const firstChild = step.children[0];
  if (firstChild?.type !== 'abbreviated_step') return false;
  const inner = firstChild.children[0];
  return inner?.type === 'self';
}
