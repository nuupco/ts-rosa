/**
 * SetValueAction — event-triggered `<setvalue>` action descriptor.
 *
 * Mirrors JavaRosa's `SetValueAction` / `Action` model: an imperative,
 * event-scoped write, distinct from `Triggerable` (a standing declarative
 * rule re-evaluated on every dependency change). See design doc
 * "sdd/setvalue-actions/design" for the full architecture rationale.
 *
 * v1 supports exactly two events:
 *   - 'odk-instance-first-load' (alias 'xforms-ready'): fires once at
 *     form-load time.
 *   - 'xforms-value-changed': fires when one of `triggers` changes.
 *
 * This module only defines the data shape + a pure event-normalization
 * helper. Parsing (src/parse/actionParser.ts) and firing (FormEvaluator,
 * a later PR) are separate concerns.
 */

import type { CompiledInstanceExpression } from '../xpath/seam/XPathSeam.ts';
import type { TreeReference } from '../model/instance/TreeReference.ts';

// ---------------------------------------------------------------------------
// Event type
// ---------------------------------------------------------------------------

/** v1-supported, normalized setvalue events. */
export type SetValueEvent = 'odk-instance-first-load' | 'xforms-value-changed';

/**
 * Raw event tokens accepted by `normalizeEvent` — 'xforms-ready' is a JavaRosa
 * alias for 'odk-instance-first-load' and is normalized to it.
 */
const EVENT_ALIASES: ReadonlyMap<string, SetValueEvent> = new Map([
  ['odk-instance-first-load', 'odk-instance-first-load'],
  ['xforms-ready', 'odk-instance-first-load'],
  ['xforms-value-changed', 'xforms-value-changed'],
]);

/**
 * Normalizes a raw `event` attribute token to a v1-supported `SetValueEvent`.
 *
 * Returns `null` when the token is not one of the v1-supported events
 * (including an empty/missing token). Callers (the parser) are responsible
 * for turning a `null` result into a fail-loud error naming the unsupported
 * event and the element's ref — this helper itself does not throw, so it
 * stays a pure, easily-unit-testable mapping function.
 */
export function normalizeEvent(rawEvent: string | null): SetValueEvent | null {
  if (rawEvent === null) return null;
  const trimmed = rawEvent.trim();
  if (trimmed === '') return null;
  return EVENT_ALIASES.get(trimmed) ?? null;
}

// ---------------------------------------------------------------------------
// SetValueAction
// ---------------------------------------------------------------------------

/**
 * A single parsed `<setvalue>` action declaration.
 *
 * One of `expr` / `literal` is set (never both, never neither):
 *   - `expr` is set when the element has a `value="..."` attribute (compiled
 *     XPath expression).
 *   - `literal` is set when the element uses inner-text instead of a `value`
 *     attribute (a raw string written verbatim, cast at write time).
 */
export interface SetValueAction {
  /** Normalized event this action fires on. */
  readonly event: SetValueEvent;
  /** Absolute target TreeReference (`ref` attribute) this action writes to. */
  readonly target: TreeReference;
  /** Compiled value expression, or null when `literal` is used instead. */
  readonly expr: CompiledInstanceExpression | null;
  /** Inner-text literal value, or null when `expr` is used instead. */
  readonly literal: string | null;
  /**
   * Genericized, predicate-less dependency refs that fire this action.
   * Empty for load-time actions; non-empty for `xforms-value-changed` actions
   * (union of the value expression's `getTriggers` deps and, for body-nested
   * actions, the host control's ref).
   */
  readonly triggers: readonly TreeReference[];
  /** Context ref used to contextualize the value expression (= target). */
  readonly contextRef: TreeReference;
  /** Original/first context ref (= target); used by getTriggers for current()/. */
  readonly originalContextRef: TreeReference;
  /** Human-readable source location for fail-loud error messages. */
  readonly sourceLocation: string;
}
