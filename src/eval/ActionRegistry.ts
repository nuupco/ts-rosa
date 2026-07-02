/**
 * ActionRegistry — JavaRosa ActionController analog.
 *
 * Organizes a FormDefinition's parsed `SetValueAction[]` (src/eval/SetValueAction.ts)
 * by event type so FormEvaluator/FormSession can fire them without re-scanning
 * `definition.actions` on every lookup. Deliberately separate from
 * TriggerableDag (see design doc "sdd/setvalue-actions/design", ADR-1):
 * actions are imperative/event-scoped, not standing declarative rules.
 *
 * v1 (this module, PR2 scope) only organizes:
 *   - `loadActions`: actions with event === 'odk-instance-first-load', in
 *     declaration order (fire once, at session-creation time).
 *   - `valueChangedByTrigger`: actions with event === 'xforms-value-changed',
 *     keyed by the SAME `refToString(genericize(ref))` convention
 *     TriggerableDag.triggerablesPerTrigger uses, so a future PR's
 *     triggerTriggerables hook can look them up symmetrically. Wiring the
 *     firing of these into triggerTriggerables is PR3 scope — this module
 *     only builds the map.
 */

import type { SetValueAction } from './SetValueAction.ts';
import { genericize, refToString } from '../model/instance/TreeReference.ts';

export interface ActionRegistry {
  /** Load-time (odk-instance-first-load) actions, in declaration order. */
  readonly loadActions: readonly SetValueAction[];
  /**
   * Value-changed actions keyed by `refToString(genericize(triggerRef))`.
   * An action appears once per distinct trigger ref (a single action can have
   * multiple triggers, per SetValueAction.triggers).
   */
  readonly valueChangedByTrigger: ReadonlyMap<string, readonly SetValueAction[]>;
}

/**
 * Build an ActionRegistry from a FormDefinition's `actions` array.
 * Pure function — no side effects, safe to call at session-creation time.
 */
export function buildActionRegistry(actions: readonly SetValueAction[]): ActionRegistry {
  const loadActions: SetValueAction[] = [];
  const valueChangedByTrigger = new Map<string, SetValueAction[]>();

  for (const action of actions) {
    if (action.event === 'odk-instance-first-load') {
      loadActions.push(action);
      continue;
    }
    // action.event === 'xforms-value-changed'
    for (const trigger of action.triggers) {
      const key = refToString(genericize(trigger));
      let bucket = valueChangedByTrigger.get(key);
      if (bucket === undefined) {
        bucket = [];
        valueChangedByTrigger.set(key, bucket);
      }
      bucket.push(action);
    }
  }

  return { loadActions, valueChangedByTrigger };
}
