/**
 * Native shim for ODK/JavaRosa `regex(value, pattern)`.
 *
 * JavaRosa semantics: full match (Matcher.matches()), NOT partial.
 * The vendor string.ts implementation uses `new RegExp(pattern).test(str)` which
 * is a partial (substring) match. This shim anchors the pattern so the entire
 * input must match, reproducing the JavaRosa contract.
 *
 * Anchoring strategy (ADR-5):
 *   anchorPattern(raw) → `^(?:<raw>)$`
 *
 *   - The non-capturing group `(?:...)` is MANDATORY: it ensures top-level
 *     alternation binds correctly.  Without it, `a|b` becomes `^a|b$` which
 *     means `^a` OR `b$` — wrong.  With the group, `^(?:a|b)$` requires the
 *     entire input to be either `a` or `b`.
 *
 *   - Already-anchored patterns (e.g. `^a$`) are wrapped unconditionally:
 *     `^(?:^a$)$` is semantically equivalent to `^a$` because redundant
 *     anchors inside a non-multiline regex are harmless.  This avoids fragile
 *     anchor-detection parsing and keeps the implementation minimal.
 *
 *   - Empty pattern `''` becomes `^(?:)$` which matches only the empty string.
 *
 * No flags: matches Java Matcher.matches() single-line, case-sensitive default.
 *
 * JS RegExp engine note: this shim changes only anchoring; the underlying
 * engine remains JS (same as the vendor). Unicode property escapes (\p{...})
 * and POSIX classes are JS-semantics, not Java — this is a pre-existing known
 * deviation that the vendor already had.
 *
 * Phase 6, Slice 6d (REQ-6D-1 through REQ-6D-5).
 */

import { BooleanFunction } from '../vendor/xpath/evaluator/functions/BooleanFunction.ts';

/**
 * Wraps a raw XPath regex pattern in `^(?:<raw>)$` to enforce full-match
 * semantics consistent with JavaRosa's Matcher.matches().
 *
 * The non-capturing group protects alternation from incorrect anchor binding.
 * Unconditional wrapping is safe even for pre-anchored patterns: `^(?:^a$)$`
 * behaves identically to `^a$` in a non-multiline JS RegExp.
 */
export function anchorPattern(raw: string): string {
  return `^(?:${raw})$`;
}

export const regex = new BooleanFunction(
  'regex',
  [
    { arityType: 'required', typeHint: 'string' },
    { arityType: 'required', typeHint: 'string' },
  ],
  (context, [valueExpression, patternExpression]): boolean => {
    const value = valueExpression!.evaluate(context).toString();
    const raw = patternExpression!.evaluate(context).toString();
    return new RegExp(anchorPattern(raw)).test(value);
  }
);
