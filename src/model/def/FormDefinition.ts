import type { InstanceTree } from '../instance/InstanceTree';
import type { DataBinding } from './DataBinding';
import type { FormElement } from './FormElement';
import type { TriggerableDag } from '../../eval/TriggerableDag';
import type { CompiledBinding } from '../../parse/bindProcessor2';

/**
 * FormDefinition — pure definition record for a parsed XForms form.
 *
 * Contains only definition + initialized instance template.
 * No session state, no evaluator state (FormSession/FormEvaluator are future phases).
 */
export type FormDefinition = {
  readonly title: string | null;
  readonly mainInstance: InstanceTree;
  readonly bindings: ReadonlyMap<string, DataBinding>; // key = nodeset
  readonly body: readonly FormElement[];               // control tree (input/select/group/repeat)
  /** Topologically sorted reactive DAG (built from compiled bindings in Slice 3.3). */
  readonly dag: TriggerableDag | null;
  /**
   * Compiled constraint expressions per nodeset (key = nodeset string).
   * Constraints are NOT in the cascade DAG — they are evaluated on-demand
   * during answerQuestion and validate().
   */
  readonly constraintBindings: ReadonlyMap<string, CompiledBinding>;
};

/**
 * Depth-first traversal of the form body, calling visitor for each question element.
 * Groups and repeats are traversed but not passed to the visitor.
 */
export function walkControls(
  def: FormDefinition,
  visitor: (q: FormElement & { kind: 'question' }) => void
): void {
  function walk(elements: readonly FormElement[]): void {
    for (const el of elements) {
      if (el.kind === 'question') {
        visitor(el);
      } else {
        // group or repeat — recurse into children
        walk(el.children);
      }
    }
  }
  walk(def.body);
}
