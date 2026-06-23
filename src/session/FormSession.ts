/**
 * FormSession — mutable run-state for a form evaluation session (Slice 3.1 skeleton).
 *
 * This is the top-level container that ties together:
 *   - FormDefinition (immutable defs + compiled bindings + DAG — added in 3.2–3.3)
 *   - InstanceTree (mutable data tree — Option A: the ONLY data store)
 *   - FormEvaluator (reactive cascade engine)
 *
 * In Slice 3.1 the session is minimal — no definition/DAG yet.
 * Later slices extend this without changing the public interface shape.
 */

import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import { FormEvaluator } from './FormEvaluator.ts';

export interface FormSession {
  /** The mutable instance data tree (Option A: sole data store, no parallel DOM). */
  readonly tree: InstanceTree;
  /** The evaluator wired to this session's InstanceTree. */
  readonly evaluator: FormEvaluator;
}

/**
 * Create a minimal FormSession from an InstanceTree.
 * Phase 3.2+ will add FormDefinition once the DAG and bindProcessor are wired.
 */
export function createFormSession(tree: InstanceTree): FormSession {
  return {
    tree,
    evaluator: new FormEvaluator(tree),
  };
}
