/**
 * Triggerable — Slice 3.2-T3
 *
 * Discriminated union for reactive binding nodes (Recalculate and Condition).
 * Mirrors JavaRosa Triggerable.java / Condition.java / Recalculate.java.
 *
 * These are the vertices of the TriggerableDag built in Slice 3.3.
 */

import type { CompiledInstanceExpression } from '../xpath/seam/XPathSeam.ts';
import type { TreeReference } from '../model/instance/TreeReference.ts';

// ---------------------------------------------------------------------------
// Condition action kinds
// ---------------------------------------------------------------------------

export type ConditionKind = 'relevant' | 'required' | 'readonly';

// ---------------------------------------------------------------------------
// Base interface
// ---------------------------------------------------------------------------

interface TriggerableBase {
  /**
   * The compiled XPath expression (parse-once, evaluate-many via compileInstanceXPath).
   */
  readonly expr: CompiledInstanceExpression;

  /**
   * Non-contextualized target TreeReferences — the nodes whose state this
   * Triggerable updates when it fires.
   */
  readonly targets: readonly TreeReference[];

  /**
   * Dependencies extracted by getTriggers (genericized, predicate-less absolute refs).
   * Keys into triggerablesPerTrigger.
   */
  readonly triggers: readonly TreeReference[];

  /**
   * Mutable context ref — reduced via intersection in addTriggerable dedup
   * (see TriggerableDag.addTriggerable). This is the only mutable field.
   */
  contextRef: TreeReference;

  /**
   * The original (first-seen) context ref. Immutable. Used by getTriggers for
   * current() / . contextualization and preserved across intersections.
   */
  readonly originalContextRef: TreeReference;
}

// ---------------------------------------------------------------------------
// Discriminated variants
// ---------------------------------------------------------------------------

export interface Recalculate extends TriggerableBase {
  readonly kind: 'recalculate';
}

export interface Condition extends TriggerableBase {
  readonly kind: 'condition';
  readonly action: ConditionKind;
}

export type Triggerable = Recalculate | Condition;

// ---------------------------------------------------------------------------
// Predicate helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the triggerable cascades its result to children.
 *
 * Only a relevant Condition cascades — relevance is inherited by descendants.
 * required/readonly Conditions and all Recalculates do NOT cascade.
 */
export function isCascadingToChildren(t: Triggerable): boolean {
  return t.kind === 'condition' && t.action === 'relevant';
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function makeRecalculate(
  expr: CompiledInstanceExpression,
  targets: readonly TreeReference[],
  triggers: readonly TreeReference[],
  contextRef: TreeReference,
  originalContextRef: TreeReference,
): Recalculate {
  return {
    kind: 'recalculate',
    expr,
    targets,
    triggers,
    contextRef,
    originalContextRef,
  };
}

export function makeCondition(
  expr: CompiledInstanceExpression,
  targets: readonly TreeReference[],
  triggers: readonly TreeReference[],
  contextRef: TreeReference,
  originalContextRef: TreeReference,
  action: ConditionKind,
): Condition {
  return {
    kind: 'condition',
    action,
    expr,
    targets,
    triggers,
    contextRef,
    originalContextRef,
  };
}
