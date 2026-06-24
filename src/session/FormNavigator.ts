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
 * indexOf() parsing is isolated to a single parseAbsoluteRef call; no XPath
 * engine internals cross this module boundary.
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
import {
  extendRef,
  parseAbsoluteRef,
  genericize,
  refEquals,
} from '../model/instance/TreeReference.ts';
import { resolveReference, countRepeatInstances } from '../model/instance/InstanceTree.ts';


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
// Internal: mutable level (used during walk algorithms)
// ---------------------------------------------------------------------------

interface MutableLevel {
  elementIndex: number;
  multiplicity: number;
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
    // repeat — classify based on whether the instance at this multiplicity exists.
    // LINEAR mode: if instance does not exist → prompt-new-repeat; else → repeat.
    const instanceExists = resolveReference(this.tree, (idx as AtFormIndex).ref) !== null;
    if (instanceExists) {
      return { kind: 'repeat', code: FORM_ENTRY_EVENT.REPEAT, index: idx as AtFormIndex };
    }
    return { kind: 'prompt-new-repeat', code: FORM_ENTRY_EVENT.PROMPT_NEW_REPEAT, index: idx as AtFormIndex };
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
  // Raw walk — relevance-blind (Slice 4.2)
  // Ported line-by-line from FormEntryModel.incrementHelper / decrementHelper
  // (LINEAR mode only; NON_LINEAR / INDEX_REPEAT_JUNCTURE branches omitted).
  // ---------------------------------------------------------------------------

  /**
   * @experimental
   * Returns the next FormIndex after `idx`, descending into containers when
   * `descend` is true (default). Relevance-blind — use stepToNextEvent() for
   * the relevance-skipping stepping API.
   *
   * Ported from FormEntryModel.incrementIndex(FormIndex, boolean) + incrementHelper.
   */
  incrementIndex(idx: FormIndex, descend = true): FormIndex {
    if (isEof(idx)) return idx; // terminal

    const body = this.definition.body;
    const levels: MutableLevel[] = [];

    if (isBof(idx)) {
      if (body.length === 0) return endOfForm;
      // levels stays empty → i = -1, will descend into body[0]
    } else {
      // Copy path to mutable array
      for (const lvl of (idx as AtFormIndex).path) {
        levels.push({ elementIndex: lvl.elementIndex, multiplicity: lvl.multiplicity });
      }
    }

    this.incrementHelper(levels, descend);

    return this.buildFormIndex(levels);
  }

  /**
   * @experimental
   * Returns the previous FormIndex before `idx`. Relevance-blind.
   *
   * Ported from FormEntryModel.decrementIndex(FormIndex) + decrementHelper.
   */
  decrementIndex(idx: FormIndex): FormIndex {
    if (isBof(idx)) return idx; // terminal

    const body = this.definition.body;
    const levels: MutableLevel[] = [];

    if (isEof(idx)) {
      if (body.length === 0) return beginningOfForm;
      // levels stays empty → decrementHelper descends from root tail
    } else {
      for (const lvl of (idx as AtFormIndex).path) {
        levels.push({ elementIndex: lvl.elementIndex, multiplicity: lvl.multiplicity });
      }
    }

    this.decrementHelper(levels);

    if (levels.length === 0) return beginningOfForm;
    return this.buildFormIndex(levels);
  }

  // ---------------------------------------------------------------------------
  // Stepping with relevance skip (Slice 4.3)
  // ---------------------------------------------------------------------------

  /**
   * Returns true when an AtFormIndex position is a stop that the user should
   * see. Non-relevant positions are skipped.
   *
   * Delegates to FormEvaluator.isEffectivelyRelevant (which walks the full
   * ancestor chain via NodeState), so a non-relevant group's descendants are
   * automatically non-relevant without additional per-child checks (R4.3.5).
   *
   * For PROMPT_NEW_REPEAT positions, the repeat's own relevance is checked
   * via the genericized ref (the concrete ref has multiplicity=0 but the
   * relevance condition is stored under the generic key).
   */
  private isStopRelevant(idx: AtFormIndex): boolean {
    return this.evaluator.isEffectivelyRelevant(idx.ref);
  }

  /**
   * @experimental
   * Advance cursor, skipping non-relevant positions, until a relevant stop or
   * EOF is reached. Sets currentIndex and returns the event at the new position.
   *
   * Mirrors JavaRosa FormEntryController.stepToNextEvent (LINEAR mode):
   *   do { next = incrementIndex(next) } while next is at && not relevant
   */
  stepToNextEvent(): FormEntryEvent {
    let next = this.incrementIndex(this.currentIndex);
    while (isAt(next) && !this.isStopRelevant(next)) {
      next = this.incrementIndex(next);
    }
    this.currentIndex = next;
    return this.eventAt(next);
  }

  /**
   * @experimental
   * Retreat cursor, skipping non-relevant positions, until a relevant stop or
   * BOF is reached. Sets currentIndex and returns the event at the new position.
   *
   * Mirrors the symmetric stepToPreviousEvent.
   */
  stepToPreviousEvent(): FormEntryEvent {
    let prev = this.decrementIndex(this.currentIndex);
    while (isAt(prev) && !this.isStopRelevant(prev)) {
      prev = this.decrementIndex(prev);
    }
    this.currentIndex = prev;
    return this.eventAt(prev);
  }

  // ---------------------------------------------------------------------------
  // Jumps (Slice 4.2)
  // ---------------------------------------------------------------------------

  /**
   * @experimental
   * Set cursor to `idx` and return the event at that position.
   */
  jumpToIndex(idx: FormIndex): FormEntryEvent {
    this.currentIndex = idx;
    return this.eventAt(idx);
  }

  /**
   * @experimental
   * Reset cursor to BOF.
   */
  jumpToBeginningOfForm(): FormEntryEvent {
    this.currentIndex = beginningOfForm;
    return this.eventAt(beginningOfForm);
  }

  // ---------------------------------------------------------------------------
  // indexOf (Slice 4.2 / 4.6)
  // ---------------------------------------------------------------------------

  /**
   * @experimental
   * Walk the form from BOF (relevance-blind) and return the first AtFormIndex
   * whose ref matches `xPath`. Returns endOfForm if not found.
   *
   * Positional xPath (e.g. /data/repeat[1]/q): compared with concrete ref
   * (includes multiplicity). Generic xPath (no predicates): compared with
   * genericized ref (ignores multiplicity).
   *
   * XPath firewall: only parseAbsoluteRef() crosses this boundary — no XPath
   * engine internals are imported.
   */
  indexOf(xPath: string): FormIndex {
    const target = parseAbsoluteRef(xPath);

    let walker: FormIndex = this.incrementIndex(beginningOfForm);
    while (isAt(walker)) {
      if (this.refMatchesTarget(walker.ref, target)) return walker;
      walker = this.incrementIndex(walker);
    }
    return endOfForm;
  }

  /**
   * Compare a walker ref against the parsed target ref.
   *
   * Per-level rule (mirrors JavaRosa FormEntryModel.getIndexByReference):
   *   - If the target level has a concrete multiplicity (>= 0): exact match required.
   *   - If the target level has INDEX_UNBOUND (-1): name match only (any multiplicity).
   *
   * This handles mixed refs like /data/repeat[1]/inner1 where repeat[1] is
   * positional but inner1 has no predicate.
   */
  private refMatchesTarget(walkerRef: TreeReference, target: TreeReference): boolean {
    if (walkerRef.levels.length !== target.levels.length) return false;
    for (let i = 0; i < target.levels.length; i++) {
      const w = walkerRef.levels[i]!;
      const t = target.levels[i]!;
      if (w.name !== t.name) return false;
      // Only enforce multiplicity when target has a concrete predicate
      if (t.multiplicity >= 0 && w.multiplicity !== t.multiplicity) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Repeat navigation (Slice 4.4)
  // ---------------------------------------------------------------------------

  /**
   * @experimental
   * Jump to the PROMPT_NEW_REPEAT position for the innermost repeat that
   * contains the current cursor. Sets currentIndex and returns the event.
   *
   * If the cursor is not inside any repeat, this is a no-op (cursor unchanged,
   * returns the current event). Mirrors JavaRosa FormEntryController.jumpToNewRepeatPrompt().
   *
   * Algorithm:
   *   1. Walk the current index's path from leaf to root to find the innermost
   *      level whose element is a repeat.
   *   2. Set the path to that repeat level, with multiplicity incremented by 1
   *      (the next instance slot, which has no instance → PROMPT_NEW_REPEAT).
   *   3. If no repeat ancestor is found, do nothing.
   */
  jumpToNewRepeatPrompt(): FormEntryEvent {
    if (!isAt(this.currentIndex)) return this.eventAt(this.currentIndex);

    const path = this.currentIndex.path;
    // Find the deepest (innermost) repeat level in the current path
    let repeatLevel = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      const el = this.elementAt(
        path.slice(0, i + 1).map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity })),
      );
      if (el !== null && el.kind === 'repeat') {
        repeatLevel = i;
        break;
      }
    }

    if (repeatLevel === -1) {
      // Not inside any repeat — no-op
      return this.eventAt(this.currentIndex);
    }

    // Build new path: everything up to (and including) the repeat level,
    // with the repeat's multiplicity incremented by 1 (next instance slot).
    const newLevels: MutableLevel[] = [];
    for (let i = 0; i <= repeatLevel; i++) {
      newLevels.push({ elementIndex: path[i]!.elementIndex, multiplicity: path[i]!.multiplicity });
    }
    newLevels[repeatLevel]!.multiplicity += 1;

    const newIndex = this.buildFormIndex(newLevels);
    this.currentIndex = newIndex;
    return this.eventAt(newIndex);
  }

  /**
   * @experimental
   * Enter the nth repeat instance (0-indexed) for the repeat at the current
   * cursor position. Sets currentIndex to the repeat node at multiplicity n
   * and returns the event (REPEAT if instance exists, PROMPT_NEW_REPEAT otherwise).
   *
   * The cursor must already be positioned at or within a repeat node.
   * Mirrors JavaRosa FormEntryController.descendIntoRepeat(int n).
   */
  descendIntoRepeat(n: number): FormEntryEvent {
    if (!isAt(this.currentIndex)) return this.eventAt(this.currentIndex);

    // Find the outermost repeat level (top of path that is a repeat)
    const path = this.currentIndex.path;
    for (let i = 0; i < path.length; i++) {
      const el = this.elementAt(
        path.slice(0, i + 1).map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity })),
      );
      if (el !== null && el.kind === 'repeat') {
        const newLevels: MutableLevel[] = path
          .slice(0, i + 1)
          .map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
        newLevels[i]!.multiplicity = n;
        const newIndex = this.buildFormIndex(newLevels);
        this.currentIndex = newIndex;
        return this.eventAt(newIndex);
      }
    }

    // Not at a repeat — no-op
    return this.eventAt(this.currentIndex);
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
  // Internal helpers
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

  /**
   * Get the element at the given mutable levels array (leaf element).
   * Returns null if path is invalid.
   */
  private elementAt(levels: readonly MutableLevel[]): FormElement | null {
    if (levels.length === 0) return null;
    const resolved = this.resolvePath(levels.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity })));
    return resolved?.element ?? null;
  }

  /**
   * Get the children array for the element at `levels`, or body if levels is empty.
   */
  private childrenOf(levels: readonly MutableLevel[]): readonly FormElement[] {
    if (levels.length === 0) return this.definition.body;
    const el = this.elementAt(levels);
    if (el === null) return [];
    if (el.kind === 'group' || el.kind === 'repeat') return el.children;
    return [];
  }

  /**
   * Build the concrete ref for the element at the given mutable levels array.
   *
   * Multiplicity is applied ONLY for repeat elements (concrete instance
   * position). For questions and groups the multiplicity in the path is
   * always 0 (by algorithm), so we use INDEX_UNBOUND there — keeping the
   * ref in the same form as the binding key (refToString generic) that
   * FormEvaluator uses for constraint / relevance lookups.
   *
   * For repeat elements the concrete multiplicity IS carried (needed for
   * resolveReference instance-existence checks and per-instance relevance).
   */
  private buildRef(levels: readonly MutableLevel[]): TreeReference {
    const rootName = this.definition.mainInstance.root.name;
    let ref: TreeReference = parseAbsoluteRef(`/${rootName}`);
    let siblings: readonly FormElement[] = this.definition.body;
    for (const lvl of levels) {
      const el = siblings[lvl.elementIndex];
      if (el === undefined) break;
      const name = this.elementLeafName(el);
      // Use concrete multiplicity for repeats; INDEX_UNBOUND for questions/groups.
      const mult = el.kind === 'repeat' ? lvl.multiplicity : undefined;
      ref = extendRef(ref, name, mult);
      if (el.kind === 'group' || el.kind === 'repeat') {
        siblings = el.children;
      }
    }
    return ref;
  }

  /**
   * Convert mutable levels array to an immutable AtFormIndex.
   */
  private buildFormIndex(levels: MutableLevel[]): FormIndex {
    if (levels.length === 0) return endOfForm;
    const ref = this.buildRef(levels);
    return atIndex(
      levels.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity })),
      ref,
    );
  }

  /**
   * Ported from FormEntryModel.incrementHelper (LINEAR mode, java:548-642).
   * Mutates `levels` in place to advance to the next position.
   */
  private incrementHelper(levels: MutableLevel[], descend: boolean): void {
    let i = levels.length - 1;
    let exitRepeat = false;

    // --- Descend branch ---
    // Entered when: at root (i === -1) OR current leaf is a group/repeat container
    const leafEl = i >= 0 ? this.elementAt(levels) : null;
    if (i === -1 || (leafEl !== null && (leafEl.kind === 'group' || leafEl.kind === 'repeat'))) {
      if (i >= 0 && leafEl !== null && leafEl.kind === 'repeat') {
        // LINEAR: check if the current repeat instance exists
        const currentRef = this.buildRef(levels);
        if (resolveReference(this.tree, currentRef) === null) {
          // Instance does not exist — do not descend (yields PROMPT_NEW_REPEAT on classification)
          descend = false;
          exitRepeat = true;
        }
      }

      if (descend) {
        const container = this.childrenOf(levels);
        if (i === -1 || container.length > 0) {
          // Descend into first child
          levels.push({ elementIndex: 0, multiplicity: 0 });
          return;
        }
        // Empty group: container.length === 0 — fall through to sibling loop
      }
    }

    // --- Sibling / ascend loop ---
    while (i >= 0) {
      const el = this.elementAt(levels.slice(0, i + 1));
      if (!exitRepeat && el !== null && el.kind === 'repeat') {
        // LINEAR: move to next repeat instance (multiplicity += 1)
        levels[i]!.multiplicity += 1;
        return;
      }

      // Determine parent's children array
      const parentSiblings = i === 0
        ? this.definition.body
        : this.childrenOf(levels.slice(0, i));
      const curElementIndex = levels[i]!.elementIndex;

      if (curElementIndex + 1 >= parentSiblings.length) {
        // End of this level — ascend
        levels.pop();
        i--;
        exitRepeat = false;
      } else {
        // Next sibling
        levels[i]!.elementIndex = curElementIndex + 1;
        levels[i]!.multiplicity = 0;
        return;
      }
    }
    // levels is now empty → caller will return endOfForm
  }

  /**
   * Ported from FormEntryModel.decrementHelper (LINEAR mode, java:672-719).
   * Mutates `levels` in place to retreat to the previous position.
   */
  private decrementHelper(levels: MutableLevel[]): void {
    let i = levels.length - 1;

    if (i !== -1) {
      const curIndex = levels[i]!.elementIndex;
      const curMult = levels[i]!.multiplicity;
      const curEl = this.elementAt(levels);

      // LINEAR: if current leaf is a repeat with multiplicity > 0, go to previous instance
      if (curEl !== null && curEl.kind === 'repeat' && curMult > 0) {
        levels[i]!.multiplicity = curMult - 1;
        // Fall through to descend-to-leaf tail
      } else if (curIndex > 0) {
        // Set to previous sibling
        levels[i]!.elementIndex = curIndex - 1;
        levels[i]!.multiplicity = 0;
        // Apply setRepeatNextMultiplicity — if new leaf is a repeat with instances, set to last
        if (this.setRepeatNextMultiplicity(levels)) return;
        // Fall through to descend-to-leaf tail
      } else {
        // At start of level — ascend to parent
        levels.pop();
        return;
      }
    }

    // --- Descend-to-leaf tail (java:703-718) ---
    // Walk down into the last child until we reach a question (or group with no children)
    let el = i < 0 ? null : this.elementAt(levels);
    while (el === null || el.kind !== 'question') {
      const children = this.childrenOf(levels);
      if (children.length === 0) {
        // No children — stop on the group/repeat itself
        return;
      }
      const subIndex = children.length - 1;
      levels.push({ elementIndex: subIndex, multiplicity: 0 });
      if (this.setRepeatNextMultiplicity(levels)) return;
      el = this.elementAt(levels);
    }
  }

  /**
   * Ported from FormEntryModel.setRepeatNextMultiplicity (LINEAR mode, java:721-742).
   *
   * If the leaf element in `levels` is a repeat, count existing instances and
   * set multiplicity to `count - 1` (last instance) if instances exist, or 0
   * (which will yield PROMPT_NEW_REPEAT) if none.
   *
   * Returns true if the leaf is a repeat (multiplicity was set), false otherwise.
   */
  private setRepeatNextMultiplicity(levels: MutableLevel[]): boolean {
    const leafEl = this.elementAt(levels);
    if (leafEl === null || leafEl.kind !== 'repeat') return false;

    // It's a repeat — count existing instances
    const leafRef = this.buildRef(levels);
    const genericRef = genericize(leafRef);
    const count = countRepeatInstances(this.tree, genericRef);
    if (count > 0) {
      levels[levels.length - 1]!.multiplicity = count - 1; // point at last instance
    } else {
      levels[levels.length - 1]!.multiplicity = 0; // no instances; multiplicity=0 → PROMPT_NEW_REPEAT
    }
    return true;
  }
}
