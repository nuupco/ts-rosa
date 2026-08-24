/**
 * Unit tests — checkRankPermutation (pure predicate)
 *
 * Source: sdd/rank-validation design §2.1.
 * The predicate distinguishes duplicate/missing/foreign violations, treats
 * choiceValues as a multiset, and never rejects an empty answer.
 */

import { describe, it, expect } from "vitest";
import { checkRankPermutation } from "../../../../src/model/validation/rankPermutation.ts";

describe("checkRankPermutation", () => {
  it("returns valid: true for an exact permutation (any order)", () => {
    const result = checkRankPermutation(["b", "a", "c"], ["a", "b", "c"]);
    expect(result).toEqual({ valid: true });
  });

  it("reports a duplicate token", () => {
    const result = checkRankPermutation(["a", "b", "b"], ["a", "b", "c"]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toEqual([
        { kind: "duplicate", tokens: ["b"] },
        { kind: "missing", tokens: ["c"] },
      ]);
    }
  });

  it("reports a missing token", () => {
    const result = checkRankPermutation(["a", "c"], ["a", "b", "c"]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toEqual([{ kind: "missing", tokens: ["b"] }]);
    }
  });

  it("reports a foreign token", () => {
    const result = checkRankPermutation(["a", "b", "z"], ["a", "b", "c"]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toEqual([
        { kind: "missing", tokens: ["c"] },
        { kind: "foreign", tokens: ["z"] },
      ]);
    }
  });

  it("reports multiple simultaneous violation kinds, in documented order (duplicate, missing, foreign)", () => {
    // choices: a, b, c, d. answer: a a z (duplicate 'a', missing 'b','c','d', foreign 'z')
    const result = checkRankPermutation(["a", "a", "z"], ["a", "b", "c", "d"]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toEqual([
        { kind: "duplicate", tokens: ["a"] },
        { kind: "missing", tokens: ["b", "c", "d"] },
        { kind: "foreign", tokens: ["z"] },
      ]);
    }
  });

  it("returns valid: true unconditionally for empty tokens, even against non-empty choiceValues", () => {
    const result = checkRankPermutation([], ["a", "b", "c"]);
    expect(result).toEqual({ valid: true });
  });

  it("treats duplicate values within choiceValues as a multiset (malformed choice set)", () => {
    // choices: [a, a, b] (multiset: a x2, b x1) — answer must match multiset exactly
    const validAnswer = checkRankPermutation(["a", "a", "b"], ["a", "a", "b"]);
    expect(validAnswer).toEqual({ valid: true });

    // a single 'a' against a multiset requiring two 'a's → missing one more 'a'
    const invalidAnswer = checkRankPermutation(["a", "b"], ["a", "a", "b"]);
    expect(invalidAnswer.valid).toBe(false);
    if (!invalidAnswer.valid) {
      expect(invalidAnswer.violations).toEqual([{ kind: "missing", tokens: ["a"] }]);
    }
  });

  it("orders duplicate tokens by first-occurrence order in the answer", () => {
    const result = checkRankPermutation(["c", "a", "c", "a"], ["a", "c"]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toEqual([{ kind: "duplicate", tokens: ["c", "a"] }]);
    }
  });

  it("orders missing tokens by choice declaration order", () => {
    const result = checkRankPermutation([], ["z", "a", "m"]);
    // empty tokens short-circuits to valid, so use a non-empty subset instead
    expect(result).toEqual({ valid: true });

    const partial = checkRankPermutation(["a"], ["z", "a", "m"]);
    expect(partial.valid).toBe(false);
    if (!partial.valid) {
      expect(partial.violations).toEqual([{ kind: "missing", tokens: ["z", "m"] }]);
    }
  });

  it("orders foreign tokens by answer order", () => {
    const result = checkRankPermutation(["z", "y"], ["z", "y"].concat([])); // choices == tokens minus foreign check
    // Use choices that don't include y/z at all except partially to force foreign ordering
    const partial = checkRankPermutation(["z", "y"], ["z"]);
    expect(partial.valid).toBe(false);
    if (!partial.valid) {
      expect(partial.violations).toEqual([{ kind: "foreign", tokens: ["y"] }]);
    }
    expect(result).toEqual({ valid: true });
  });
});
