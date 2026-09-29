/**
 * Unit tests: XPath number→string conversion (`NumberEvaluation.stringValue`,
 * `src/xpath/vendor/xpath/evaluations/NumberEvaluation.ts:24`).
 *
 * Context: `odd/tasks/time-codec-offset-aware.md` Part 3. These tests document
 * the CURRENT, confirmed-correct behavior — `String(value)`, JS's own
 * spec-compliant shortest-round-trip decimal representation, matching the
 * vendored upstream reference implementation
 * (`reference/web-forms/packages/xpath/src/evaluations/NumberEvaluation.ts:21`)
 * exactly. Investigation found no formatting defect: `0.0029088000000000004`
 * is the shortest string that round-trips to the exact IEEE-754 double
 * produced by `7.272/25*0.01` — the imprecision is baked into the arithmetic
 * itself, not introduced by string conversion. See the task doc for the full
 * writeup and recommendation.
 */
import { describe, expect, it } from "vitest";
import { evaluateXPath } from "../../../src/xpath/index.ts";

describe("XPath number→string conversion", () => {
  it("keeps an exact/clean decimal result exact", () => {
    expect(evaluateXPath("string(0.5)")).toBe("0.5");
  });

  it("reproduces the known floating-point noise case (7.272 div 25 * 0.01)", () => {
    // Matches plain Node.js `7.272/25*0.01` exactly — confirmed independently,
    // standard IEEE-754 double imprecision, not a string-conversion bug.
    expect(evaluateXPath("string(7.272 div 25 * 0.01)")).toBe(
      "0.0029088000000000004"
    );
  });

  it("formats a very small number in scientific notation, matching JS String()", () => {
    expect(evaluateXPath("string(0.0000001)")).toBe(String(0.0000001));
    expect(evaluateXPath("string(0.0000001)")).toBe("1e-7");
  });

  it("formats a very large number, matching JS String()", () => {
    expect(evaluateXPath("string(100000000000000000000000)")).toBe(
      String(100000000000000000000000)
    );
  });

  it("formats a negative number", () => {
    expect(evaluateXPath("string(-3.14)")).toBe("-3.14");
  });

  /**
   * Part 4: port JavaRosa's `XPathFuncExpr.toString(Object)` guard clauses
   * (https://github.com/getodk/javarosa/blob/master/src/main/java/org/javarosa/xpath/expr/XPathFuncExpr.java#L804):
   * snap-to-zero for `|d| < 1e-12`, and near-integer truncation (toward
   * zero, matching Java's `(int) d` cast) for `|d - (int) d| < 1e-12`.
   */
  it("snaps a sub-epsilon nonzero value to '0'", () => {
    expect(evaluateXPath("string(0.0000000000001)")).toBe("0"); // 1e-13
  });

  it("snaps a negative sub-epsilon value to '0'", () => {
    expect(evaluateXPath("string(-0.0000000000001)")).toBe("0"); // -1e-13
  });

  it("truncates a positive near-integer value to the whole number", () => {
    // 7 + 1e-13: within 1e-12 of 7, should truncate (not round) to "7".
    expect(evaluateXPath("string(7.0000000000001)")).toBe("7");
  });

  it("truncates a negative near-integer value toward zero", () => {
    // -7 - 1e-13: within 1e-12 of -7. Java's (int) cast truncates toward
    // zero (like Math.trunc), so this must produce "-7", not "-8".
    expect(evaluateXPath("string(-7.0000000000001)")).toBe("-7");
  });
});
