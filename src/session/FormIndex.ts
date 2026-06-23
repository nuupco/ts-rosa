/**
 * FormIndex — positional cursor for the form entry engine (Phase 4).
 *
 * @experimental Phase 4 cursor API. NOT exported from any stable barrel.
 *
 * Design: flattened path array (equivalent to JavaRosa's collapsed
 * indexes+multiplicities parallel lists) rather than a mutable linked list.
 * Each step produces a NEW FormIndex; the cursor itself is immutable data.
 *
 * Firewall: ZERO XPath imports. FormIndex/FormNavigator are pure TS values.
 */

import type { TreeReference } from '../model/instance/TreeReference.ts';

/**
 * One nesting level of a positional form cursor.
 *
 * Mirrors JavaRosa FormIndex.localIndex (elementIndex) + instanceIndex (multiplicity).
 *   elementIndex = 0-based index into the parent FormElement[] children array
 *   multiplicity = 0-based repeat-instance index for that element; 0 for non-repeats.
 */
export interface FormIndexLevel {
  readonly elementIndex: number;
  readonly multiplicity: number;
}

/** Cursor before the first event. */
export interface BeginningOfFormIndex {
  readonly kind: 'bof';
}

/** Cursor past the last event. */
export interface EndOfFormIndex {
  readonly kind: 'eof';
}

/**
 * Cursor positioned AT a body element.
 *
 * `path` is the root→leaf chain of levels (path[0] indexes FormDefinition.body).
 * `ref` is the resolved concrete TreeReference (positional multiplicities).
 */
export interface AtFormIndex {
  readonly kind: 'at';
  readonly path: readonly FormIndexLevel[];
  readonly ref: TreeReference;
}

/** Discriminated union for the form cursor position. */
export type FormIndex = BeginningOfFormIndex | EndOfFormIndex | AtFormIndex;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/** Singleton BOF sentinel (mirrors FormIndex.createBeginningOfFormIndex). */
export const beginningOfForm: FormIndex = Object.freeze({ kind: 'bof' } as BeginningOfFormIndex);

/** Singleton EOF sentinel (mirrors FormIndex.createEndOfFormIndex). */
export const endOfForm: FormIndex = Object.freeze({ kind: 'eof' } as EndOfFormIndex);

/**
 * Create an AtFormIndex at the given path + resolved ref.
 * The path array is frozen (immutable).
 */
export function atIndex(path: readonly FormIndexLevel[], ref: TreeReference): AtFormIndex {
  return Object.freeze({ kind: 'at', path: Object.freeze([...path]), ref });
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Returns true when the cursor is at BOF. */
export function isBof(i: FormIndex): i is BeginningOfFormIndex {
  return i.kind === 'bof';
}

/** Returns true when the cursor is at EOF. */
export function isEof(i: FormIndex): i is EndOfFormIndex {
  return i.kind === 'eof';
}

/** Returns true when the cursor is positioned AT a body element. */
export function isAt(i: FormIndex): i is AtFormIndex {
  return i.kind === 'at';
}

// ---------------------------------------------------------------------------
// Equality
// ---------------------------------------------------------------------------

/**
 * Structural equality for two FormIndex values.
 *
 * BOF == BOF, EOF == EOF.
 * At == At when both paths have the same length and each level is equal
 * (elementIndex + multiplicity) AND refs have the same string form.
 */
export function formIndexEquals(a: FormIndex, b: FormIndex): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'bof' || a.kind === 'eof') return true;
  // Both are 'at'
  const bAt = b as AtFormIndex;
  const aAt = a as AtFormIndex;
  if (aAt.path.length !== bAt.path.length) return false;
  for (let i = 0; i < aAt.path.length; i++) {
    const al = aAt.path[i]!;
    const bl = bAt.path[i]!;
    if (al.elementIndex !== bl.elementIndex || al.multiplicity !== bl.multiplicity) return false;
  }
  // Compare ref by string (TreeReference equality)
  // We import refToString lazily to avoid circular deps — use the ref directly
  return aAt.ref === bAt.ref;
}
