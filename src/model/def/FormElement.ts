import type { TreeReference } from '../instance/TreeReference';
import type { ControlType } from './controlType';
import type { DataBinding } from './DataBinding';

/**
 * A static choice item from a <item> child of select1/select elements.
 * Dynamic itemsets are a Phase 5 concern.
 */
export type ChoiceItem = {
  readonly value: string;
  readonly labelText: string | null;
};

/**
 * FormElement — discriminated union for the body/control tree.
 *
 * 'repeat' is present structurally; navigation/instantiation is deferred to Phase 4.
 * UI/derived state (relevant, required, readonly, enabled) does NOT live here — deferred to NodeState (Phase 3).
 */
export type FormElement =
  | {
      readonly kind: 'question';
      readonly ref: TreeReference;
      readonly controlType: ControlType;
      readonly binding: DataBinding | null;
      readonly labelText: string | null;
      readonly choices: readonly ChoiceItem[];
    }
  | {
      readonly kind: 'group';
      readonly ref: TreeReference;
      readonly children: readonly FormElement[];
      readonly labelText: string | null;
    }
  | {
      readonly kind: 'repeat';
      readonly ref: TreeReference;
      readonly children: readonly FormElement[];
      readonly labelText: string | null;
    };
