/**
 * FormEntryEvent — inbound cursor-position axis for form entry (Phase 4).
 *
 * @experimental Phase 4 cursor API. NOT exported from any stable barrel.
 *
 * Firewall: COMPLETELY separate from FormEvent (Phase 3, outbound change
 * notifications). These are TWO DISTINCT AXES — never merge them.
 *   FormEvent    = outbound, "what changed" (value-changed/state-changed/repeat-*)
 *   FormEntryEvent = inbound, "where is the cursor" (BOF/EOF/QUESTION/GROUP/REPEAT)
 *
 * Numeric codes mirror JavaRosa FormEntryController.EVENT_* constants for
 * direct equivalence assertions in ported tests.
 *
 * Slice 4.1: bof/eof/question/group variants only.
 * Slice 4.4: repeat/prompt-new-repeat variants added.
 */

import type { FormIndex, AtFormIndex } from './FormIndex.ts';

/**
 * Numeric event codes — mirrors JavaRosa FormEntryController.EVENT_* constants.
 * REPEAT_JUNCTURE (32) is omitted; NON_LINEAR mode is out of scope.
 */
export const FORM_ENTRY_EVENT = {
  BEGINNING_OF_FORM: 0,
  END_OF_FORM: 1,
  PROMPT_NEW_REPEAT: 2,
  QUESTION: 4,
  GROUP: 8,
  REPEAT: 16,
} as const;

/**
 * Discriminated union for form entry cursor events.
 *
 * Each variant carries the FormIndex it was produced from, plus the numeric
 * code that matches JavaRosa EVENT_* for direct equivalence assertions.
 *
 * Slice 4.1: only bof/eof/question/group variants are instantiated by
 * FormNavigator. The repeat/prompt-new-repeat variants are added in Slice 4.4.
 */
export type FormEntryEvent =
  | { readonly kind: 'beginning-of-form'; readonly code: 0;  readonly index: FormIndex }
  | { readonly kind: 'end-of-form';       readonly code: 1;  readonly index: FormIndex }
  | { readonly kind: 'prompt-new-repeat'; readonly code: 2;  readonly index: AtFormIndex }
  | { readonly kind: 'question';          readonly code: 4;  readonly index: AtFormIndex }
  | { readonly kind: 'group';             readonly code: 8;  readonly index: AtFormIndex }
  | { readonly kind: 'repeat';            readonly code: 16; readonly index: AtFormIndex };
