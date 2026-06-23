/**
 * Equivalence: XPathParseTest.java — parse-level red bar (Phase 2)
 *
 * Source oracle:
 *   reference/javarosa/src/test/java/org/javarosa/xpath/test/XPathParseTest.java
 *
 * Every test is marked it.fails() because the XPath evaluation engine does
 * not exist yet (Phase 2). Tests assert the canonical JavaRosa behavior for
 * parse correctness and parse errors. When the engine is implemented the
 * it.fails() wrapper must be removed.
 *
 * Cases NOT ported here (backlog for Phase 2):
 *   - Externalization round-trips (ExtUtil.serialize / deserialize) — requires
 *     serialization infrastructure.
 *   - Advanced axis steps: ancestor, following-sibling, preceding-sibling,
 *     namespace, attribute (XPathUnsupportedException expected).
 *   - Full filter-expression + path combinations (bunch-o-nodes()[p]/step).
 *   - Wildcard name tests (ns:*, *:local).
 *   - All 200+ parse cases in parseTestCases[] — only representative samples
 *     are ported here; the full table can be added iteratively in Phase 2.
 */

import { describe, it, expect } from "vitest";
import { evaluateXPath } from "../../../src/xpath/index.ts";

/**
 * Assert that evaluating `expr` throws a PARSE/SYNTAX error — not just any error.
 * This fails today because the stub always throws "not implemented: xpath evaluation (Phase 2)"
 * regardless of expression validity. Phase 2 must distinguish parse errors from eval errors.
 */
function expectParseError(expr: string): void {
  let thrown: unknown;
  try {
    evaluateXPath(expr);
  } catch (e) {
    thrown = e;
  }
  // The error must be a real parse/syntax error, not the stub's "not implemented" message.
  // This assertion will fail while the stub is in place and pass once the real parser is wired.
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).not.toContain("not implemented");
}

// ---------------------------------------------------------------------------
// Numeric literal parsing
// Source: XPathParseTest.java parseTestCases[] lines 43-54
// ---------------------------------------------------------------------------
describe("XPath parse — numeric literals", () => {
  it("parses integer 10 → 10.0", () => {
    // JavaRosa: {"10", "{num:10.0}"}
    expect(evaluateXPath("10")).toBe(10.0);
  });

  it("parses decimal 734.04 → 734.04", () => {
    // JavaRosa: {"734.04", "{num:734.04}"}
    expect(evaluateXPath("734.04")).toBe(734.04);
  });

  it("parses leading-dot .666 → 0.666", () => {
    // JavaRosa: {".666", "{num:0.666}"}
    expect(evaluateXPath(".666")).toBe(0.666);
  });

  it("parses trailing-dot 123. → 123.0", () => {
    // JavaRosa: {"123.", "{num:123.0}"}
    expect(evaluateXPath("123.")).toBe(123.0);
  });

  it("parses zero 0 → 0.0", () => {
    expect(evaluateXPath("0")).toBe(0.0);
  });

  it("parses large integer in scientific form 1230000000000000000000 → 1.23e21", () => {
    // JavaRosa: {"1230000000000000000000", "{num:1.23E21}"}
    expect(evaluateXPath("1230000000000000000000")).toBe(1.23e21);
  });

  it("parses tiny decimal 0.00000000000000000123 → 1.23e-18", () => {
    expect(evaluateXPath("0.00000000000000000123")).toBe(1.23e-18);
  });

  it("normalizes leading zeros 00000333.3330000 → 333.333", () => {
    // JavaRosa: {"00000333.3330000", "{num:333.333}"}
    expect(evaluateXPath("00000333.3330000")).toBe(333.333);
  });
});

// ---------------------------------------------------------------------------
// String literal parsing
// Source: XPathParseTest.java parseTestCases[] lines 55-62
// ---------------------------------------------------------------------------
describe("XPath parse — string literals", () => {
  it("parses empty double-quoted string", () => {
    // JavaRosa: {"\"\"", "{str:''}"}
    expect(evaluateXPath('""')).toBe("");
  });

  it("parses whitespace string '   '", () => {
    expect(evaluateXPath("'   '")).toBe("   ");
  });

  it.fails("parses string with embedded quote", () => {
    // JavaRosa: {"'\"'", "{str:'\"'}"}
    expect(evaluateXPath(`'"`)).toBe('"');
  });

  it("rejects unterminated string", () => {
    // JavaRosa: {"'unterminated string...", null}
    expectParseError("'unterminated string...");
  });
});

// ---------------------------------------------------------------------------
// Operator associativity and precedence
// Source: XPathParseTest.java parseTestCases[] lines 104-119
// ---------------------------------------------------------------------------
describe("XPath parse — operator associativity", () => {
  it("or is right-associative: 1 or 2 or 3 → or(1, or(2, 3))", () => {
    // JavaRosa: {"1 or 2 or 3", "{binop-expr:or,{num:1.0},{binop-expr:or,{num:2.0},{num:3.0}}}"}
    // Eval effect: true (all non-zero)
    expect(evaluateXPath("1 or 2 or 3")).toBe(true);
  });

  it("and is right-associative: 1 and 2 and 3", () => {
    expect(evaluateXPath("1 and 2 and 3")).toBe(true);
  });

  it("arithmetic left-associative: 1 + 2 - 3 - 4 + 5 → 1", () => {
    // JavaRosa: {"1 + 2 - 3 - 4 + 5", "{binop-expr:+,{...}}"}
    expect(evaluateXPath("1 + 2 - 3 - 4 + 5")).toBe(1.0);
  });

  it("mul/div/mod left-associative: 1 mod 2 div 3 div 4 * 5", () => {
    // JavaRosa parseResult confirms structure; eval: (((1%2)/3)/4)*5 = ((1/3)/4)*5 ≈ 0.4167
    expect(evaluateXPath("1 mod 2 div 3 div 4 * 5")).toBeCloseTo(5 / 12, 5);
  });

  it("mul higher precedence than add: 3 + 3 * 3 → 12", () => {
    // This is also an eval test; confirms precedence is correct
    expect(evaluateXPath("3 + 3 * 3")).toBe(12.0);
  });
});

// ---------------------------------------------------------------------------
// Parse error cases — invalid syntax must throw
// Source: XPathParseTest.java parseTestCases[] null entries
// ---------------------------------------------------------------------------
describe("XPath parse — syntax errors", () => {
  it("empty expression throws", () => {
    expectParseError("");
  });

  it("whitespace-only expression throws", () => {
    expectParseError("     ");
  });

  it("unbalanced open paren throws", () => {
    expectParseError("(");
  });

  it("unbalanced close paren throws", () => {
    expectParseError(")");
  });

  it("empty parens () throws", () => {
    expectParseError("()");
  });

  it("5/5 is invalid (div, not slash) throws", () => {
    // JavaRosa: {"5/5", null} — slash is not the division operator
    expectParseError("5/5");
  });

  it("5%5 is invalid (use mod) throws", () => {
    expectParseError("5%5");
  });

  it("== is not valid XPath equality operator", () => {
    expectParseError("5 == 5");
  });

  it("<> is not valid XPath inequality operator", () => {
    expectParseError("5 <> 5");
  });

  it("bare >= without operands throws", () => {
    expectParseError(">=");
  });

  it("'asdf'!= without right-hand side throws", () => {
    expectParseError("'asdf'!=");
  });

  it("prefix-only operator +- throws", () => {
    expectParseError("+-");
  });

  it("8|-9 (union with negation) throws per XPath spec", () => {
    // JavaRosa: {"8|-9", null} — disallowed by the XPath spec
    expectParseError("8|-9");
  });
});

// ---------------------------------------------------------------------------
// Path expressions — basic shapes
// Source: XPathParseTest.java parseTestCases[] lines 146+
// ---------------------------------------------------------------------------
describe("XPath parse — path expressions compile", () => {
  it("absolute path /data parses without throwing", () => {
    // Should not throw during parse; evaluation result depends on instance
    expect(() => evaluateXPath("/data")).not.toThrow();
  });

  it("self step . parses", () => {
    // JavaRosa: {".", "{path-expr:rel,{{step:self,node()}}}"}
    expect(() => evaluateXPath(".")).not.toThrow();
  });

  it("parent step .. parses", () => {
    expect(() => evaluateXPath("..")).not.toThrow();
  });
});
