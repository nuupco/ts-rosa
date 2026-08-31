/**
 * FormNavigator — form entry cursor engine (Phase 4).
 *
 * @experimental Phase 4 cursor API. Exported from `src/session/index.ts` /
 * the root `src/index.ts` barrel and covered by `public-api-surface.test.ts`,
 * but the surface may still change without a deprecation path.
 *
 * Owns the mutable cursor (FormIndex) and provides query and navigation
 * methods that mirror JavaRosa FormEntryController + FormEntryModel.
 *
 * Firewall: ZERO XPath imports. Relevance routing goes exclusively through
 * FormEvaluator.isEffectivelyRelevant. The XPathSeam is NOT imported here.
 * indexOf() parsing is isolated to a single parseAbsoluteRef call; no XPath
 * engine internals cross this module boundary.
 */

import type { DataType } from '../model/data/DataType.ts';
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
  refToString,
} from '../model/instance/TreeReference.ts';
import { resolveReference, countRepeatInstances, addRepeatInstance, removeRepeatInstance } from '../model/instance/InstanceTree.ts';
import { level } from '../model/instance/TreeReferenceLevel.ts';
import { INDEX_TEMPLATE } from '../model/instance/multiplicity.ts';


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
   * Returns the TreeReference at the NEXT relevant position without permanently
   * moving the cursor. Mirrors JavaRosa Scenario.nextRef() which does:
   *   silentNext(); ref = refAtIndex(); silentPrev(); return ref.
   *
   * This is relevance-aware (skips non-relevant positions) but NON-MUTATING:
   * it does NOT call createModelIfNecessary (no instance-tree side effects).
   * Returns null when the next relevant position is EOF.
   */
  nextRef(): TreeReference | null {
    // Advance relevance-blind, skip non-relevant positions, but NO side effects.
    // Also skip count-controlled repeat junctions whose multiplicity >= count
    // (mirrors stepToNextEvent's createModelIfNecessary: those junctions are never
    // presented as navigable stops when the count limit is reached).
    let next = this.incrementIndex(this.currentIndex);
    while (isAt(next)) {
      if (!this.isStopRelevant(next)) {
        next = this.incrementIndex(next);
        continue;
      }
      if (this.isExhaustedCountRepeat(next)) {
        next = this.incrementIndex(next);
        continue;
      }
      break;
    }
    if (!isAt(next)) {
      // When EOF would be returned and the next logical position is a
      // repeat junction with no instance, return the junction's own ref.
      // This handles PROMPT_NEW_REPEAT where incrementIndex goes to EOF
      // because no instance exists yet.
      const one = this.incrementIndex(this.currentIndex);
      if (isAt(one) && one.ref) {
        const resolved = this.resolvePath(one.path);
        if (resolved !== null && resolved.element.kind === 'repeat'
            && resolveReference(this.tree, one.ref) === null) {
          return one.ref;
        }
      }
      return null;
    }
    return next.ref;
  }

  /**
   * Returns true when `idx` is a count-controlled repeat junction whose
   * instance does not exist AND whose multiplicity has reached (or exceeded)
   * the count expression value — meaning createModelIfNecessary would skip it.
   * Non-mutating: does NOT create any instances.
   */
  private isExhaustedCountRepeat(idx: AtFormIndex): boolean {
    const resolved = this.resolvePath(idx.path);
    if (resolved === null || resolved.element.kind !== 'repeat') return false;
    const repeat = resolved.element;
    if (repeat.countExpr == null) return false; // not count-controlled
    if (resolveReference(this.tree, idx.ref) !== null) return false; // instance exists — not exhausted
    // Evaluate count with the first existing instance as context (same logic as createModelIfNecessary).
    const lastLvl = idx.ref.levels[idx.ref.levels.length - 1]!;
    const firstInstanceRef = { ...idx.ref, levels: [...idx.ref.levels.slice(0, -1), level(lastLvl.name, 0)] };
    const existingInstance = resolveReference(this.tree, firstInstanceRef);
    let countCtx = existingInstance;
    if (countCtx === null && idx.ref.levels.length > 1) {
      const parentRef = { ...idx.ref, levels: idx.ref.levels.slice(0, -1) };
      const parentNode = resolveReference(this.tree, parentRef);
      if (parentNode !== null) {
        countCtx = parentNode.children.find((c) => c.multiplicity !== INDEX_TEMPLATE) ?? null;
      }
    }
    const countVal = this.evaluator.evaluateOnInstance(repeat.countExpr, countCtx);
    const count = typeof countVal === 'number' ? countVal : Number(countVal);
    if (isNaN(count)) return false;
    const lastLevel = idx.path[idx.path.length - 1];
    const multiplicity = lastLevel?.multiplicity ?? 0;
    // Exhausted when multiplicity >= count (no more instances to create)
    return multiplicity >= count;
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
   *
   * After landing on a new position, calls createModelIfNecessary to
   * auto-create repeat instances when jr:count controls the repeat size
   * (mirrors JR FormEntryModel.setQuestionIndex → createModelIfNecessary).
   */
  stepToNextEvent(): FormEntryEvent {
    let next = this.incrementIndex(this.currentIndex);
    while (isAt(next)) {
      if (!this.isStopRelevant(next)) {
        next = this.incrementIndex(next);
        continue;
      }
      // Skip exhausted count-controlled repeat junctions (same logic as nextRef).
      // createModelIfNecessary will not create an instance for these, so they must
      // not be presented as navigable stops.
      if (this.isExhaustedCountRepeat(next)) {
        next = this.incrementIndex(next);
        continue;
      }
      break;
    }
    this.currentIndex = next;
    if (isAt(next)) {
      this.createModelIfNecessary(next);
    }
    return this.eventAt(next);
  }

  /**
   * Mirrors JavaRosa FormEntryModel.createModelIfNecessary.
   * If the position is a count-controlled repeat (jr:count) and the instance
   * at the current multiplicity doesn't exist yet AND multiplicity < count,
   * auto-create the repeat instance.
   *
   * This enables navigation INTO count-controlled repeats via next() without
   * requiring an explicit createNewRepeat() call (matching JR behavior).
   */
  private createModelIfNecessary(idx: AtFormIndex): void {
    const resolved = this.resolvePath(idx.path);
    if (resolved === null || resolved.element.kind !== 'repeat') return;

    const repeat = resolved.element;

    // Check if the instance already exists
    if (resolveReference(this.tree, idx.ref) !== null) return;

    if (repeat.countExpr != null) {
      // Evaluate the count expression with context = an existing instance of the repeat
      const lastLvl = idx.ref.levels[idx.ref.levels.length - 1]!;
      const firstInstanceRef = { ...idx.ref, levels: [...idx.ref.levels.slice(0, -1), level(lastLvl.name, 0)] };
      const existingInstance = resolveReference(this.tree, firstInstanceRef);

      let contextNode = existingInstance;
      if (contextNode === null && idx.ref.levels.length > 1) {
        const parentRef = { ...idx.ref, levels: idx.ref.levels.slice(0, -1) };
        const parentNode = resolveReference(this.tree, parentRef);
        if (parentNode !== null && parentNode.children.length > 0) {
          contextNode = parentNode.children.find((c) => c.multiplicity !== INDEX_TEMPLATE) ?? null;
        }
      }
      const countVal = this.evaluator.evaluateOnInstance(repeat.countExpr, contextNode);
      const count = typeof countVal === 'number' ? countVal : Number(countVal);
      if (isNaN(count) || count <= 0) return;

      const lastLevel = idx.path[idx.path.length - 1];
      const multiplicity = lastLevel?.multiplicity ?? 0;

      if (multiplicity < count) {
        const node = addRepeatInstance(this.tree, idx.ref);
        if (node !== null) {
          this.evaluator.initializeRepeatInstance(idx.ref);
        }
      }
    }
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
  // Prompt API (Slice 4.5)
  // ---------------------------------------------------------------------------

  /**
   * @experimental
   * Returns a question wrapper for the element at the given index (defaults to
   * current cursor). Returns null when not at a question position.
   *
   * The returned object exposes:
   *   - getLabelInnerText(): label text with <output> replaced by ${n} placeholders
   *   - getControlType(): the control type string (e.g. 'input', 'select1')
   *
   * R4.5.2: walks FormDefinition.body via resolvePath — O(depth). No XPath eval.
   * R4.5.8: does NOT trigger XPath evaluation or modify InstanceTree.
   */
  getQuestionAtIndex(idx?: FormIndex): { getLabelInnerText(): string | null; getControlType(): string; getDataType(): DataType | null; getHintText(): string | null; getRangeBounds(): { start?: number; end?: number; step?: number } | null; getAppearance(): string | null; getMediatype(): string | null; getQuestionText(): string | null; getSubstitutedHintText(): string | null } | null {
    const target = idx ?? this.currentIndex;
    if (!isAt(target)) return null;
    const resolved = this.resolvePath(target.path);
    if (resolved === null || resolved.element.kind !== 'question') return null;
    const element = resolved.element;
    const contextRef = resolved.ref;
    const evaluator = this.evaluator;
    return {
      getLabelInnerText(): string | null {
        return element.labelInnerText;
      },
      getControlType(): string {
        return element.controlType;
      },
      getDataType(): DataType | null {
        return element.binding?.dataType ?? null;
      },
      getHintText(): string | null {
        return element.hintText ?? null;
      },
      /**
       * Resolves the question label through itext (when driven by
       * <label ref="jr:itext('id')"/>) in the currently active language,
       * falling back to the raw label placeholder template otherwise, then
       * substitutes every <output> placeholder against the current instance
       * data using this question's own context node (repeat-relative
       * outputs resolve per-instance). Evaluated fresh on every read — no
       * caching (JavaRosa FormEntryPrompt#getQuestionText parity).
       * Added in output-label-substitution PR1 (itext-only); extended with
       * substitution in PR3.
       */
      getQuestionText(): string | null {
        if (element.labelItextId != null) {
          const resolved = evaluator.resolveItextWithOutputs(element.labelItextId);
          if (resolved !== null) {
            return evaluator.substituteText(resolved.text, resolved.outputs, contextRef);
          }
        }
        return evaluator.substituteText(element.labelInnerText, element.labelOutputs ?? [], contextRef);
      },
      /**
       * Resolves the question hint through itext (when driven by
       * <hint ref="jr:itext('id')"/>) in the currently active language,
       * falling back to the raw hint placeholder template otherwise, then
       * substitutes every <output> placeholder the same way as
       * getQuestionText(). Added in output-label-substitution PR1
       * (itext-only); extended with substitution in PR3.
       */
      getSubstitutedHintText(): string | null {
        if (element.hintItextId != null) {
          const resolved = evaluator.resolveItextWithOutputs(element.hintItextId);
          if (resolved !== null) {
            return evaluator.substituteText(resolved.text, resolved.outputs, contextRef);
          }
        }
        return evaluator.substituteText(element.hintInnerText ?? element.hintText ?? null, element.hintOutputs ?? [], contextRef);
      },
      getRangeBounds(): { start?: number; end?: number; step?: number } | null {
        if (element.rangeStart === undefined && element.rangeEnd === undefined && element.rangeStep === undefined) {
          return null;
        }
        const bounds: { start?: number; end?: number; step?: number } = {};
        if (element.rangeStart !== undefined) bounds.start = element.rangeStart;
        if (element.rangeEnd !== undefined) bounds.end = element.rangeEnd;
        if (element.rangeStep !== undefined) bounds.step = element.rangeStep;
        return bounds;
      },
      getAppearance(): string | null {
        return element.appearance ?? null;
      },
      getMediatype(): string | null {
        return element.mediatype ?? null;
      },
    };
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

  /**
   * @experimental
   * Deletes the repeat instance referenced by `idx` (defaults to the current
   * cursor) and returns the FormEntryEvent for the post-removal cursor
   * position. Mirrors JavaRosa FormEntryController.deleteRepeat(FormIndex) /
   * FormDef.deleteRepeat, composed from two existing, unchanged primitives:
   *
   *   1. removeRepeatInstance(tree, ref) — splices the instance and
   *      re-indexes sibling multiplicities (data layer, unchanged).
   *   2. evaluator.triggerRepeatRemoval(genericRef) — re-runs the DAG
   *      cascade so relevant/required/calculate/constraint are recomputed
   *      (unchanged; full-DAG-rerun cost is a known, accepted limitation).
   *
   * No new recomputation logic is introduced.
   *
   * Cursor re-mapping (design decision 3, JavaRosa-pinned): let `m` be the
   * removed instance's multiplicity. The cursor is rebuilt via
   * buildFormIndex + eventAt reclassification in every case, never reused
   * as-is:
   *   (a) cursor was AT or inside the removed instance (multiplicity === m)
   *       -> truncated to the repeat level at multiplicity m (now the
   *       shifted-down sibling, or empty -> PROMPT_NEW_REPEAT).
   *   (b) cursor was in a later sibling (multiplicity > m) -> same logical
   *       node, multiplicity decremented by 1 to track the re-index.
   *   (c) cursor was in an earlier sibling, outside the repeat entirely, or
   *       otherwise unrelated -> unchanged position, ref regenerated fresh.
   *
   * Throws (fail loudly, no silent no-op / soft-result object) when:
   *   - idx is BOF/EOF (not resolvable)
   *   - idx's path has no repeat ancestor
   *   - the resolved repeat's countExpr is non-null (jr:count-bound; count
   *     is engine-controlled, matches JavaRosa/Collect semantics)
   *   - removeRepeatInstance returns null (out-of-range multiplicity / no
   *     backing instance, e.g. a PROMPT_NEW_REPEAT slot)
   * All validation throws happen BEFORE removeRepeatInstance / cascade /
   * cache invalidation are called — no partial mutation on rejection.
   *
   * Zero XPath imports (firewall preserved) — reuses genericize, buildRef,
   * buildFormIndex, elementAt, eventAt already available in this module.
   */
  deleteRepeat(idx?: FormIndex): FormEntryEvent {
    const target = idx ?? this.currentIndex;
    if (!isAt(target)) {
      throw new Error(`deleteRepeat: index is not resolvable: ${target.kind}`);
    }

    const path = target.path;

    // Leaf→root walk to find the innermost repeat level (mirrors jumpToNewRepeatPrompt).
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
      throw new Error(`deleteRepeat: index does not reference a repeat instance: ${refToString(target.ref)}`);
    }

    const levels: MutableLevel[] = path
      .slice(0, repeatLevel + 1)
      .map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
    const repeatRef = this.buildRef(levels);
    const repeatElement = this.elementAt(levels); // known to be kind === 'repeat'

    if (repeatElement !== null && repeatElement.kind === 'repeat' && repeatElement.countExpr != null) {
      throw new Error(`deleteRepeat: repeat is count-bound (jr:count) and cannot be manually deleted: ${refToString(repeatRef)}`);
    }

    const removed = removeRepeatInstance(this.tree, repeatRef);
    if (removed === null) {
      throw new Error(`deleteRepeat: no repeat instance exists at index: ${refToString(repeatRef)}`);
    }

    this.evaluator.triggerRepeatRemoval(genericize(repeatRef));
    this.evaluator.invalidateChoiceCache();

    const removedMultiplicity = levels[levels.length - 1]!.multiplicity;
    const newIndex = this.remapCursorAfterRemoval(levels, repeatLevel, removedMultiplicity);
    this.currentIndex = newIndex;
    return this.eventAt(newIndex);
  }

  /**
   * Rebuild `this.currentIndex` after a repeat instance removal, per design
   * decision 3 (cases a-d). ALWAYS rebuilds through buildFormIndex (never
   * reuses the old immutable ref) and classifies via eventAt at the call
   * site (deleteRepeat).
   */
  private remapCursorAfterRemoval(
    removedAncestorLevels: readonly MutableLevel[],
    repeatLevel: number,
    removedMultiplicity: number,
  ): FormIndex {
    if (!isAt(this.currentIndex)) {
      // BOF/EOF cursor is unaffected by a repeat removal elsewhere in the form.
      return this.currentIndex;
    }

    const curPath = this.currentIndex.path;
    const sameFamily = curPath.length > repeatLevel
      && this.pathPrefixMatches(curPath, removedAncestorLevels, repeatLevel)
      && curPath[repeatLevel]!.elementIndex === removedAncestorLevels[repeatLevel]!.elementIndex;

    if (!sameFamily) {
      // (c) unrelated — regenerate the ref fresh but keep the same logical position.
      const unchangedLevels: MutableLevel[] = curPath.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
      return this.buildFormIndex(unchangedLevels);
    }

    const curMultiplicity = curPath[repeatLevel]!.multiplicity;
    if (curMultiplicity === removedMultiplicity) {
      // (a) cursor was at/inside the removed instance — truncate to the repeat
      // level at the same multiplicity slot (now the shifted sibling, or empty).
      return this.buildFormIndex(removedAncestorLevels.map((l) => ({ ...l })));
    }
    if (curMultiplicity > removedMultiplicity) {
      // (b) sibling after the removed one — same logical node, shifted down by 1.
      const shiftedLevels: MutableLevel[] = curPath.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
      shiftedLevels[repeatLevel]!.multiplicity -= 1;
      return this.buildFormIndex(shiftedLevels);
    }
    // (c) sibling before the removed one — unaffected, regenerate ref fresh.
    const unchangedLevels: MutableLevel[] = curPath.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
    return this.buildFormIndex(unchangedLevels);
  }

  /** Returns true when curPath[0..upTo-1] equals ancestorLevels[0..upTo-1] (elementIndex + multiplicity). */
  private pathPrefixMatches(
    curPath: readonly FormIndexLevel[],
    ancestorLevels: readonly MutableLevel[],
    upTo: number,
  ): boolean {
    for (let i = 0; i < upTo; i++) {
      if (curPath[i]!.elementIndex !== ancestorLevels[i]!.elementIndex || curPath[i]!.multiplicity !== ancestorLevels[i]!.multiplicity) {
        return false;
      }
    }
    return true;
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
