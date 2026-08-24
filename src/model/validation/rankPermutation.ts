/**
 * checkRankPermutation — pure predicate validating that a rank answer is
 * exactly a permutation of its question's choice set.
 *
 * Model-layer, side-effect-free: no TreeReference, no XPath, no FormEvaluator
 * dependency. See sdd/rank-validation design §2.1 / ADR-3.
 */

/** Why a rank answer is not a permutation of its choice set. */
export type RankViolationKind =
  | "duplicate" // a token appears more than once (relative to the choice multiset)
  | "missing" // a choice value is absent from the answer
  | "foreign"; // a token is not a choice value

export interface RankPermutationViolation {
  readonly kind: RankViolationKind;
  /** The offending token(s)/value(s), stable-ordered, for debugging. */
  readonly tokens: readonly string[];
}

export type RankPermutationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly violations: readonly RankPermutationViolation[] };

/**
 * Validate that `tokens` is exactly a permutation of `choiceValues`.
 *
 * - Exact string equality; no trimming, no case folding, no normalization.
 * - Empty `tokens` -> `{ valid: true }` unconditionally (blank-vs-required is
 *   owned by the `required` rule, not this predicate).
 * - `choiceValues` is compared as a multiset: duplicate choice values (a
 *   form-authoring error) require the answer to reproduce the same multiset.
 * - Violation order: duplicate (first-occurrence order in the answer), then
 *   missing (choice declaration order), then foreign (answer order).
 */
export function checkRankPermutation(
  tokens: readonly string[],
  choiceValues: readonly string[],
): RankPermutationResult {
  if (tokens.length === 0) {
    return { valid: true };
  }

  const answerCounts = new Map<string, number>();
  for (const token of tokens) {
    answerCounts.set(token, (answerCounts.get(token) ?? 0) + 1);
  }

  const choiceCounts = new Map<string, number>();
  for (const value of choiceValues) {
    choiceCounts.set(value, (choiceCounts.get(value) ?? 0) + 1);
  }

  // duplicate: answer count exceeds choice count, in first-occurrence order.
  const duplicateTokens: string[] = [];
  const seenForDuplicate = new Set<string>();
  for (const token of tokens) {
    if (seenForDuplicate.has(token)) continue;
    seenForDuplicate.add(token);
    const answerCount = answerCounts.get(token) ?? 0;
    const choiceCount = choiceCounts.get(token) ?? 0;
    if (answerCount > choiceCount && choiceCount > 0) {
      duplicateTokens.push(token);
    }
  }

  // missing: choice count exceeds answer count, in choice declaration order.
  const missingTokens: string[] = [];
  const seenForMissing = new Set<string>();
  for (const value of choiceValues) {
    if (seenForMissing.has(value)) continue;
    seenForMissing.add(value);
    const choiceCount = choiceCounts.get(value) ?? 0;
    const answerCount = answerCounts.get(value) ?? 0;
    if (answerCount < choiceCount) {
      missingTokens.push(value);
    }
  }

  // foreign: token not present in choiceValues at all, in answer order.
  const foreignTokens: string[] = [];
  const seenForForeign = new Set<string>();
  for (const token of tokens) {
    if (seenForForeign.has(token)) continue;
    seenForForeign.add(token);
    if (!choiceCounts.has(token)) {
      foreignTokens.push(token);
    }
  }

  const violations: RankPermutationViolation[] = [];
  if (duplicateTokens.length > 0) {
    violations.push({ kind: "duplicate", tokens: duplicateTokens });
  }
  if (missingTokens.length > 0) {
    violations.push({ kind: "missing", tokens: missingTokens });
  }
  if (foreignTokens.length > 0) {
    violations.push({ kind: "foreign", tokens: foreignTokens });
  }

  if (violations.length === 0) {
    return { valid: true };
  }
  return { valid: false, violations };
}
