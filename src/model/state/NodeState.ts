/**
 * NodeState — derived UI/reactive state for a bound node.
 *
 * Slice 3.5: NodeState is owned by FormEvaluator in a Map keyed by
 * refToString(genericize(ref)). It is NEVER stored on InstanceNode
 * (keeps data tree pure).
 *
 * Fields:
 *   relevant  — own relevance (result of the node's relevant Condition)
 *   enabled   — inverse of readonly / itemset enable (Phase 3.5: driven by readonly Condition)
 *   required  — driven by required Condition
 *   readonly  — driven by readonly Condition
 *   constraintMsg — last constraint message (Phase 3.6)
 *   calculatedValue — last computed value (informational; actual value lives on InstanceNode)
 *
 * Effective relevance (own AND all ancestors relevant) is computed by
 * ancestor walk in FormEvaluator.isEffectivelyRelevant — NOT stored here.
 */

import type { AnswerValue } from '../data/AnswerValue.ts';

export interface NodeState {
  relevant: boolean;
  enabled: boolean;
  required: boolean;
  readonly: boolean;
  constraintMsg: string | null;
  calculatedValue: AnswerValue | null;
}

export function defaultNodeState(): NodeState {
  return {
    relevant: true,
    enabled: true,
    required: false,
    readonly: false,
    constraintMsg: null,
    calculatedValue: null,
  };
}
