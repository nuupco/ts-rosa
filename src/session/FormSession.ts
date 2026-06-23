/**
 * FormSession — mutable run-state for a form evaluation session.
 *
 * Slice 3.1 skeleton + Slice 3.4 extension:
 *   - Carries FormDefinition (includes compiled DAG from Slice 3.3)
 *   - Creates FormEvaluator wired to the InstanceTree
 *   - Calls evaluator.initializeInstance(dag) to compute initial calculate values
 */

import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import type { FormDefinition } from '../model/def/FormDefinition.ts';
import { FormEvaluator } from './FormEvaluator.ts';

export interface FormSession {
  /** The full form definition (immutable defs + compiled bindings + DAG). */
  readonly definition: FormDefinition;
  /** The mutable instance data tree (Option A: sole data store, no parallel DOM). */
  readonly tree: InstanceTree;
  /** The evaluator wired to this session's InstanceTree. */
  readonly evaluator: FormEvaluator;
}

/**
 * Create a FormSession from a FormDefinition.
 *
 * Runs initializeInstance on the DAG so all calculate expressions are
 * evaluated in topological order before the first user interaction.
 */
export function createFormSession(definition: FormDefinition): FormSession {
  const evaluator = new FormEvaluator(definition.mainInstance);

  // Slice 3.4: evaluate all Recalculates in DAG order (initial steady state)
  if (definition.dag !== null) {
    evaluator.initializeInstance(definition.dag);
  }

  return {
    definition,
    tree: definition.mainInstance,
    evaluator,
  };
}
