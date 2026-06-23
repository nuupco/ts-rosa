/**
 * bindProcessor2 — Slice 3.2-T4
 *
 * Phase 3 version of the bind processor: compiles each DataBinding expression
 * to a CompiledInstanceExpression via compileInstanceXPath and extracts its
 * trigger TreeReferences via getTriggers.
 *
 * Produces CompiledBinding records consumed by TriggerableDag (Slice 3.3).
 *
 * Design notes:
 * - dataTypeFromBindType is re-used from bindProcessor.ts (Phase 1).
 * - constraint self-reference (`.`) IS included in triggers (design §2.3 says
 *   "contextualizes to the target's own ref"; cycle detection excludes
 *   pure constraint self-refs from throwing — that's 3.3's concern).
 * - contextRef = originalContextRef = parseAbsoluteRef(nodeset) for all bindings.
 */

import { compileInstanceXPath } from '../xpath/seam/XPathSeam.ts';
import { getTriggers } from '../eval/getTriggers.ts';
import { PureJSExpressionParser } from '../xpath/parser/PureJSExpressionParser.ts';
import {
  parseAbsoluteRef,
  type TreeReference,
} from '../model/instance/TreeReference.ts';
import {
  type Triggerable,
  type ConditionKind,
  makeRecalculate,
  makeCondition,
} from '../eval/Triggerable.ts';
import { dataTypeFromBindType } from './bindProcessor.ts';
import type { DataType } from '../model/data/DataType.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompiledBindingKind =
  | { kind: 'recalculate' }
  | { kind: 'condition'; action: ConditionKind | 'constraint' };

/**
 * A compiled binding entry — one per non-null XPath expression on a <bind>.
 *
 * This is the intermediate representation between bindProcessor2 and the
 * TriggerableDag build in Slice 3.3. It bundles the compiled expression,
 * extracted triggers, and context refs together.
 *
 * Note: 'constraint' is kept separate from ConditionKind to avoid pulling
 * it into the cascade logic (constraints are validation-only, not cascade sources).
 */
export type CompiledBinding =
  | {
      readonly kind: 'recalculate';
      readonly action?: undefined;
      readonly expr: ReturnType<typeof compileInstanceXPath>;
      readonly triggers: readonly TreeReference[];
      readonly contextRef: TreeReference;
      readonly originalContextRef: TreeReference;
      readonly targets: readonly TreeReference[];
    }
  | {
      readonly kind: 'condition';
      readonly action: ConditionKind | 'constraint';
      readonly expr: ReturnType<typeof compileInstanceXPath>;
      readonly triggers: readonly TreeReference[];
      readonly contextRef: TreeReference;
      readonly originalContextRef: TreeReference;
      readonly targets: readonly TreeReference[];
    };

/**
 * The output record for a single <bind> element after Phase 3 processing.
 */
export interface ProcessedBinding {
  /** Raw nodeset string (map key). */
  readonly nodeset: string;
  /** Parsed absolute TreeReference for the bind target. */
  readonly ref: TreeReference;
  /** Resolved data type. */
  readonly dataType: DataType;
  /** One compiled binding per non-null XPath attribute. */
  readonly compiledBindings: readonly CompiledBinding[];
}

// ---------------------------------------------------------------------------
// Shared parser instance (parse-once per expression, LRU-cached inside)
// ---------------------------------------------------------------------------

const sharedParser = new PureJSExpressionParser();

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Process an array of <bind> Elements and return a Map keyed by the nodeset
 * attribute value. Each entry is a ProcessedBinding with compiled expressions
 * and extracted triggers.
 */
export function bindProcessor2(binds: readonly Element[]): Map<string, ProcessedBinding> {
  const result = new Map<string, ProcessedBinding>();

  for (const el of binds) {
    const nodeset = el.getAttribute('nodeset') ?? el.getAttribute('ref') ?? null;
    if (nodeset === null) continue;

    const typeAttr = el.getAttribute('type') ?? null;
    const dataType = dataTypeFromBindType(typeAttr);
    const ref = parseAbsoluteRef(nodeset);
    const contextRef = ref;
    const originalContextRef = ref;

    const compiledBindings: CompiledBinding[] = [];

    // --- calculate → Recalculate ---
    const calculate = el.getAttribute('calculate');
    if (calculate !== null) {
      const cb = compileBinding(calculate, 'recalculate', undefined, contextRef, originalContextRef); // overload 1
      if (cb !== null) compiledBindings.push(cb);
    }

    // --- relevant → Condition(relevant) ---
    const relevant = el.getAttribute('relevant');
    if (relevant !== null) {
      const cb = compileBinding(relevant, 'condition', 'relevant', contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }

    // --- required → Condition(required) ---
    const required = el.getAttribute('required');
    if (required !== null) {
      const cb = compileBinding(required, 'condition', 'required', contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }

    // --- readonly → Condition(readonly) ---
    const readonly_ = el.getAttribute('readonly');
    if (readonly_ !== null) {
      const cb = compileBinding(readonly_, 'condition', 'readonly', contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }

    // --- constraint → Condition(constraint) ---
    // Constraints are validation-only and NOT cascade sources; they are kept
    // separate from ConditionKind in the type and handled differently in 3.3.
    const constraint = el.getAttribute('constraint');
    if (constraint !== null) {
      const cb = compileBinding(constraint, 'condition', 'constraint', contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }

    result.set(nodeset, {
      nodeset,
      ref,
      dataType,
      compiledBindings,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function compileBinding(
  exprStr: string,
  kind: 'recalculate',
  action: undefined,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): CompiledBinding | null;
function compileBinding(
  exprStr: string,
  kind: 'condition',
  action: ConditionKind | 'constraint',
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): CompiledBinding | null;
function compileBinding(
  exprStr: string,
  kind: 'recalculate' | 'condition',
  action: ConditionKind | 'constraint' | undefined,
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): CompiledBinding | null {
  let expr: ReturnType<typeof compileInstanceXPath>;
  try {
    expr = compileInstanceXPath(exprStr);
  } catch {
    // Invalid expression — skip silently (will surface at eval time)
    return null;
  }

  // Parse the expression to extract triggers
  const parsed = sharedParser.parse(exprStr).rootNode;
  const triggers = getTriggers(parsed, contextRef, originalContextRef);

  // targets: for a bind, the target is the bind's own ref
  const targets: TreeReference[] = [contextRef];

  if (kind === 'recalculate') {
    return { kind: 'recalculate', expr, triggers, contextRef, originalContextRef, targets };
  }
  return {
    kind: 'condition',
    action: action as ConditionKind | 'constraint',
    expr,
    triggers,
    contextRef,
    originalContextRef,
    targets,
  };
}
