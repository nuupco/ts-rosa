/**
 * bindProcessor — canonical bind processor (Phase 1 + Phase 3 consolidated).
 *
 * Phase 1 (extract DataBinding records):
 *   - Reads nodeset/ref, type, and copies XPath expression attributes as raw
 *     strings. No parsing, no evaluation.
 *
 * Phase 3 (compile expressions):
 *   - Compiles each DataBinding expression to a CompiledInstanceExpression via
 *     compileInstanceXPath and extracts trigger TreeReferences via getTriggers.
 *   - Produces CompiledBinding records consumed by TriggerableDag (Slice 3.3).
 *
 * Consolidated from bindProcessor.ts (Phase 1) + bindProcessor2.ts (Phase 3).
 * The name bindProcessor2 / function bindProcessor2 are aliases for backward
 * compat — any remaining internal consumers are updated at consolidation time.
 */

import type { DataBinding } from '../model/def/DataBinding.ts';
import type { ControlType } from '../model/def/controlType.ts';
import { dataTypeFromXsdName, type DataType } from '../model/data/DataType.ts';
import { parseAbsoluteRef, type TreeReference } from '../model/instance/TreeReference.ts';
import { compileInstanceXPath } from '../xpath/seam/XPathSeam.ts';
import { getTriggers } from '../eval/getTriggers.ts';
import { PureJSExpressionParser } from '../xpath/parser/PureJSExpressionParser.ts';
import {
  type Triggerable,
  type ConditionKind,
  makeRecalculate,
  makeCondition,
} from '../eval/Triggerable.ts';

// ---------------------------------------------------------------------------
// Phase 1 — DataType resolution
// ---------------------------------------------------------------------------

/**
 * Derive DataType from a <bind type="..."> attribute value and an optional
 * control hint (the body element's localName, e.g. 'select1').
 *
 * - If typeAttr is present and non-null, use XSD name map.
 * - If typeAttr is null/empty, fall back to control hint if provided.
 * - Default: 'string'.
 */
export function dataTypeFromBindType(
  typeAttr: string | null,
  controlHint?: ControlType,
): DataType {
  if (typeAttr !== null && typeAttr !== '') {
    const direct = dataTypeFromXsdName(typeAttr);
    if (direct !== 'unsupported') return direct;
    const withPrefix = dataTypeFromXsdName(`xsd:${typeAttr}`);
    return withPrefix;
  }
  if (controlHint === 'select1') return 'selectOne';
  if (controlHint === 'select') return 'selectMulti';
  return 'string';
}

// ---------------------------------------------------------------------------
// Phase 1 — DataBinding extraction (raw strings, no XPath evaluation)
// ---------------------------------------------------------------------------

/**
 * Process an array of <bind> Elements and return a Map keyed by the nodeset
 * attribute value. Each entry is a DataBinding with:
 *   - nodeset: the raw nodeset/ref attribute string
 *   - ref: parsed TreeReference (structural, no predicates)
 *   - dataType: resolved from 'type' attribute
 *   - relevant/required/readonly_/calculate/constraint/constraintMsg: RAW strings or null
 */
export function bindProcessor(binds: readonly Element[]): Map<string, DataBinding> {
  const result = new Map<string, DataBinding>();

  for (const el of binds) {
    const nodeset =
      el.getAttribute('nodeset') ?? el.getAttribute('ref') ?? null;
    if (nodeset === null) continue;

    const typeAttr = el.getAttribute('type') ?? null;
    const dataType = dataTypeFromBindType(typeAttr);

    const binding: DataBinding = {
      nodeset,
      ref: parseAbsoluteRef(nodeset),
      dataType,
      relevant: el.getAttribute('relevant') ?? null,
      required: el.getAttribute('required') ?? null,
      readonly_: el.getAttribute('readonly') ?? null,
      calculate: el.getAttribute('calculate') ?? null,
      constraint: el.getAttribute('constraint') ?? null,
      constraintMsg:
        el.getAttribute('jr:constraintMsg') ??
        el.getAttribute('constraintMsg') ??
        null,
    };

    result.set(nodeset, binding);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Phase 3 — CompiledBinding types
// ---------------------------------------------------------------------------

export type CompiledBindingKind =
  | { kind: 'recalculate' }
  | { kind: 'condition'; action: ConditionKind | 'constraint' };

/**
 * A compiled binding entry — one per non-null XPath expression on a <bind>.
 *
 * This is the intermediate representation between bindProcessor and the
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
// Phase 3 — Shared parser instance
// ---------------------------------------------------------------------------

const sharedParser = new PureJSExpressionParser();

// ---------------------------------------------------------------------------
// Phase 3 — bindProcessor2 (Phase 3 compiled bindings, renamed alias retained)
// ---------------------------------------------------------------------------

/**
 * Process an array of <bind> Elements and return a Map keyed by the nodeset
 * attribute value. Each entry is a ProcessedBinding with compiled expressions
 * and extracted triggers.
 *
 * @deprecated Use `bindProcessor2` name only for backward compat during
 * consolidation. New callers reference this file directly.
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

    const calculate = el.getAttribute('calculate');
    if (calculate !== null) {
      const cb = compileBinding(calculate, 'recalculate', undefined, contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }

    const relevant = el.getAttribute('relevant');
    if (relevant !== null) {
      const cb = compileBinding(relevant, 'condition', 'relevant', contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }

    const required = el.getAttribute('required');
    if (required !== null) {
      const cb = compileBinding(required, 'condition', 'required', contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }

    const readonly_ = el.getAttribute('readonly');
    if (readonly_ !== null) {
      const cb = compileBinding(readonly_, 'condition', 'readonly', contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }

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
    return null;
  }

  const parsed = sharedParser.parse(exprStr).rootNode;
  const triggers = getTriggers(parsed, contextRef, originalContextRef);
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
