import type { TreeReference } from '../instance/TreeReference';
import type { ControlType } from './controlType';
import type { DataBinding } from './DataBinding';

/**
 * A static choice item from a <item> child of select1/select elements.
 * Dynamic itemsets are a Phase 5c concern.
 */
export type ChoiceItem = {
  readonly value: string;
  /** Raw text content of the label element (non-itext label). */
  readonly labelText: string | null;
  /**
   * True when the label is driven by jr:itext('id') rather than a literal text node.
   * Added in Slice 5a to support itext-driven static choice labels.
   */
  readonly labelIsItext?: boolean;
  /**
   * The extracted itext id when labelIsItext = true.
   * e.g. for <label ref="jr:itext('fruit:apple')"/> → labelItextId = 'fruit:apple'.
   */
  readonly labelItextId?: string | null;
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
      /**
       * Label inner text with <output> elements replaced by ${index} placeholders,
       * preserving surrounding whitespace (including non-breaking spaces).
       * Mirrors JavaRosa QuestionDef.getLabelInnerText().
       * Null when no label is present.
       */
      readonly labelInnerText: string | null;
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
