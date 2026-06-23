/**
 * FormNavigator — form entry cursor engine (Phase 4).
 *
 * @experimental Phase 4 cursor API. NOT exported from any stable barrel.
 *
 * Owns the mutable cursor (FormIndex) and provides query and navigation
 * methods that mirror JavaRosa FormEntryController + FormEntryModel.
 *
 * Firewall: ZERO XPath imports. Relevance routing goes exclusively through
 * FormEvaluator.isEffectivelyRelevant. The XPathSeam is NOT imported here.
 */

import type { FormDefinition } from '../model/def/FormDefinition.ts';
import type { FormElement } from '../model/def/FormElement.ts';
import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import type { TreeReference } from '../model/instance/TreeReference.ts';
import type { FormEvaluator } from './FormEvaluator.ts';
import {
  type FormIndex,
  type AtFormIndex,
  type FormIndexLevel,
  beginningOfForm,
  endOfForm,
  atIndex,
  isBof,
  isEof,
  isAt,
} from './FormIndex.ts';
import {
  type FormEntryEvent,
  FORM_ENTRY_EVENT,
} from './FormEntryEvent.ts';
import { extendRef, parseAbsoluteRef } from '../model/instance/TreeReference.ts';


// ---------------------------------------------------------------------------
// Internal: resolvePath result
// ---------------------------------------------------------------------------

interface ResolvedPath {
  /** The leaf FormElement at the end of the path. */
  element: FormElement;
  /** Chain from root → leaf (parent elements, excluding the leaf). */
  parentChain: readonly FormElement[];
  /** The concrete TreeReference built while walking the path. */
  ref: TreeReference;
}

// ---------------------------------------------------------------------------
// FormNavigator
// ---------------------------------------------------------------------------

/**
 * @experimental
 */
export class FormNavigator {
  /** Current cursor position. Starts at BOF. */
  private currentIndex: FormIndex = beginningOfForm;

  constructor(
    private readonly definition: FormDefinition,
    private readonly tree: InstanceTree,
    private readonly evaluator: FormEvaluator,
  ) {}

  // ---------------------------------------------------------------------------
  // Cursor queries (Slice 4.1)
  // ---------------------------------------------------------------------------

  /**
   * @experimental
   * Returns the current cursor position.
   */
  getCurrentIndex(): FormIndex {
    return this.currentIndex;
  }

  /**
   * @experimental
   * Returns true when the cursor is past the last event (EOF).
   */
  atTheEndOfForm(): boolean {
    return isEof(this.currentIndex);
  }

  /**
   * @experimental
   * Returns true when the cursor is positioned AT a question element.
   */
  atQuestion(): boolean {
    if (!isAt(this.currentIndex)) return false;
    const resolved = this.resolvePath(this.currentIndex.path);
    return resolved !== null && resolved.element.kind === 'question';
  }

  /**
   * @experimental
   * Returns the TreeReference for the given index (defaults to current cursor).
   * Returns null when the index is BOF or EOF.
   */
  refAtIndex(idx?: FormIndex): TreeReference | null {
    const target = idx ?? this.currentIndex;
    if (!isAt(target)) return null;
    return target.ref;
  }

  /**
   * @experimental
   * Classify a FormIndex into a FormEntryEvent without moving the cursor.
   * Mirrors JavaRosa FormEntryModel.getEvent(FormIndex).
   */
  eventAt(idx: FormIndex): FormEntryEvent {
    if (isBof(idx)) {
      return { kind: 'beginning-of-form', code: FORM_ENTRY_EVENT.BEGINNING_OF_FORM, index: idx };
    }
    if (isEof(idx)) {
      return { kind: 'end-of-form', code: FORM_ENTRY_EVENT.END_OF_FORM, index: idx };
    }
    // At position — classify by element kind
    const resolved = this.resolvePath(idx.path);
    if (resolved === null) {
      // Unreachable in a well-formed form; treat as EOF
      return { kind: 'end-of-form', code: FORM_ENTRY_EVENT.END_OF_FORM, index: endOfForm };
    }
    const { element } = resolved;
    if (element.kind === 'question') {
      return { kind: 'question', code: FORM_ENTRY_EVENT.QUESTION, index: idx as AtFormIndex };
    }
    if (element.kind === 'group') {
      return { kind: 'group', code: FORM_ENTRY_EVENT.GROUP, index: idx as AtFormIndex };
    }
    // repeat — classification (REPEAT vs PROMPT_NEW_REPEAT) deferred to 4.4
    // For 4.1 skeleton: classify as group (placeholder — overridden in 4.4)
    return { kind: 'group', code: FORM_ENTRY_EVENT.GROUP, index: idx as AtFormIndex };
  }

  /**
   * @experimental
   * Convenience alias: eventAt(idx ?? currentIndex).
   * Mirrors JavaRosa FormEntryController.getEvent().
   */
  getEvent(idx?: FormIndex): FormEntryEvent {
    return this.eventAt(idx ?? this.currentIndex);
  }

  // ---------------------------------------------------------------------------
  // Internal: resolvePath — O(depth) walk of FormDefinition.body
  // ---------------------------------------------------------------------------

  /**
   * Walk FormDefinition.body using the path levels to find the leaf element.
   * Also reconstructs the concrete TreeReference (used for classifying repeats,
   * relevance checks, and element lookup).
   *
   * Returns null only when the path is structurally invalid (should not happen
   * with well-formed FormIndex values produced by incrementIndex).
   */
  resolvePath(path: readonly FormIndexLevel[]): ResolvedPath | null {
    if (path.length === 0) return null;

    let siblings: readonly FormElement[] = this.definition.body;
    const parentChain: FormElement[] = [];
    let element: FormElement | undefined;

    // Build the concrete ref as we walk, starting from the instance root.
    // The root node (e.g. "data") is not part of the body path levels —
    // body elements are direct children of the instance root.
    // We build the ref by extending from the root ref (e.g. /data).
    const rootName = this.definition.mainInstance.root.name;
    let ref: TreeReference = parseAbsoluteRef(`/${rootName}`);

    for (let i = 0; i < path.length; i++) {
      const lvl = path[i]!;
      element = siblings[lvl.elementIndex];
      if (element === undefined) return null;

      // Extend ref with the element's ref leaf name + concrete multiplicity
      const leafName = this.elementLeafName(element);
      ref = extendRef(ref, leafName, lvl.multiplicity);

      if (i < path.length - 1) {
        // Must be a container (group or repeat)
        if (element.kind !== 'group' && element.kind !== 'repeat') return null;
        parentChain.push(element);
        siblings = element.children;
      }
    }

    if (element === undefined) return null;
    return { element, parentChain, ref };
  }

  // ---------------------------------------------------------------------------
  // Internal: elementLeafName
  // ---------------------------------------------------------------------------

  /**
   * Extract the last segment name from a FormElement's TreeReference.
   * This is the element's own local name in the body/instance tree.
   */
  private elementLeafName(element: FormElement): string {
    const levels = element.ref.levels;
    if (levels.length === 0) return 'unknown';
    return levels[levels.length - 1]!.name;
  }
}
