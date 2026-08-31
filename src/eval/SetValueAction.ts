/**
 * SetValueAction — event-triggered `<setvalue>` action descriptor.
 *
 * Mirrors JavaRosa's `SetValueAction` / `Action` model: an imperative,
 * event-scoped write, distinct from `Triggerable` (a standing declarative
 * rule re-evaluated on every dependency change). See design doc
 * "sdd/setvalue-actions/design" for the full architecture rationale.
 *
 * Supported events:
 *   - 'odk-instance-first-load' (alias 'xforms-ready'): fires once at
 *     form-load time.
 *   - 'xforms-value-changed': fires when one of `triggers` changes.
 *   - 'odk-new-repeat': fires once per newly created repeat instance
 *     (dispatched from `initializeRepeatInstance`, a later PR).
 *   - 'jr-insert': deprecated alias-era event, model-level only (a later PR
 *     wires the actual fire point; this PR only parses/gates it).
 *   - 'xforms-revalidate': fires once at form-finalize time, from
 *     FormSession.finalize() (mirrors JavaRosa FormDef#postProcessInstance ->
 *     ActionController.triggerActionsFromEvent(EVENT_XFORMS_REVALIDATE)).
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

/** Supported, normalized setvalue events. */
export type SetValueEvent =
  | 'odk-instance-first-load'
  | 'xforms-value-changed'
  | 'odk-new-repeat'
  | 'jr-insert'
  | 'xforms-revalidate';

/**
 * Raw event tokens accepted by `normalizeEvent` — 'xforms-ready' is a JavaRosa
 * alias for 'odk-instance-first-load' and is normalized to it. 'jr-insert' is
 * a deprecated, non-namespaced JavaRosa token (hyphenated — NOT `jr:insert`)
 * kept distinct from `odk-new-repeat`; see design doc "sdd/setvalue-parity/design"
 * Decision 5. `xforms-revalidate` fires from FormSession.finalize() (see
 * FormEvaluator.fireRevalidateActions) — closes the finalize-lifecycle gap
 * documented in docs/XLSFORM-COVERAGE.md.
 */
const EVENT_ALIASES: ReadonlyMap<string, SetValueEvent> = new Map([
  ['odk-instance-first-load', 'odk-instance-first-load'],
  ['xforms-ready', 'odk-instance-first-load'],
  ['xforms-value-changed', 'xforms-value-changed'],
  ['odk-new-repeat', 'odk-new-repeat'],
  ['jr-insert', 'jr-insert'],
  ['xforms-revalidate', 'xforms-revalidate'],
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
  /**
   * Raw `ref` attribute string this action targets, unresolved. Compiled
   * once (see `targetExpr`) and resolved at FIRE TIME via the XPath seam —
   * sdd/setvalue-parity design Decision 2. Never parsed with parse-time
   * string manipulation (that was the pre-parity v1 approach, removed).
   */
  readonly targetSource: string;
  /**
   * Compiled target expression, evaluated via `evaluateTyped` at fire time
   * against a context anchored at `hostRef` (or the document root for
   * model-level actions). Must evaluate to a NODESET of exactly one element
   * node — see `FormEvaluator.fireActionInner` error contract.
   */
  readonly targetExpr: CompiledInstanceExpression;
  /** Absolute ref of the enclosing host control, or null for model-level actions. */
  readonly hostRef: TreeReference | null;
  /**
   * Predicate-free generic ref: derived at parse time by stripping
   * predicates from an absolute `targetSource`, or by contextualizing a
   * relative `targetSource` onto `hostRef`. Used ONLY for `ActionRegistry`
   * keying and as the `getTriggers` context ref for the value expression —
   * NEVER written to (design Decision 4).
   */
  readonly genericTarget: TreeReference;
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
  /** Human-readable source location for fail-loud error messages. */
  readonly sourceLocation: string;
}
