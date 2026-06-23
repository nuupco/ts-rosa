/**
 * Equivalence: ODK/XPath function tests — red bar (Phase 2)
 *
 * Sources:
 *   - reference/javarosa/src/test/java/org/javarosa/xpath/test/XPathEvalTest.java
 *     (boolean_functions, date_functions, regex)
 *   - reference/javarosa/src/test/java/org/javarosa/xpath/expr/IndexedRepeatTest.java
 *   - reference/javarosa/src/test/java/org/javarosa/xpath/expr/ToDateTest.java
 *
 * Every test is marked it.fails() because the XPath evaluation engine does
 * not exist yet (Phase 2). When the engine is implemented the it.fails()
 * wrapper must be removed.
 *
 * Cases NOT ported here (backlog for Phase 2):
 *   - format-date() with full locale/timezone coverage — requires date-time
 *     infrastructure; only one representative case ported.
 *   - date-time(), decimal-date-time(), decimal-time() — date-time parsing
 *     with offset handling; DST is intentionally excluded per JavaRosa itself.
 *   - indexed-repeat() with live FormInstance traversal — requires the
 *     instance-binding seam (XPath eval against a real tree).
 *   - coalesce() with instance node references.
 *   - count(), sum(), position() — require nodeset support.
 *   - today(), now() — non-deterministic; test via mocking in Phase 2.
 *   - uuid() — non-deterministic; format-only assertion in Phase 2.
 *   - randomize() — non-deterministic; covered in IndexedRepeatTest / RandomizeTest.
 *   - checklist() full coverage — variadic boolean logic; partial below.
 *   - Geo functions (geofence, area, distance) — separate Phase.
 *   - Crypto (digest, base64-decode, extract-signed) — security feature.
 */

import { describe, it, expect } from "vitest";
import { evaluateXPath } from "../../../src/xpath/index.ts";

/**
 * Assert that evaluating `expr` throws a SEMANTIC/TYPE error (not just the stub's
 * "not implemented" error). This fails today and passes once the real engine is wired.
 */
function expectEvalError(expr: string): void {
  let thrown: unknown;
  try {
    evaluateXPath(expr);
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).not.toContain("not implemented");
}

// ---------------------------------------------------------------------------
// if() — ODK conditional
// Source: XPathEvalTest.java boolean_functions()
// ---------------------------------------------------------------------------
describe("XPath functions — if()", () => {
  it("if(true(), 5, 'abc') → 5.0", () => {
    // JavaRosa: testEval("if(true(), 5, 'abc')", 5.0)
    expect(evaluateXPath("if(true(), 5, 'abc')")).toBe(5.0);
  });

  it("if(false(), 5, 'abc') → 'abc'", () => {
    expect(evaluateXPath("if(false(), 5, 'abc')")).toBe("abc");
  });

  it("if(6 > 7, 5, 'abc') → 'abc' (false branch)", () => {
    expect(evaluateXPath("if(6 > 7, 5, 'abc')")).toBe("abc");
  });

  it("if('', 5, 'abc') → 'abc' (empty string is falsy)", () => {
    expect(evaluateXPath("if('', 5, 'abc')")).toBe("abc");
  });
});

// ---------------------------------------------------------------------------
// selected() — multi-select value matching
// Source: XPathEvalTest.java boolean_functions()
// ---------------------------------------------------------------------------
describe("XPath functions — selected()", () => {
  it("selected('apple baby crimson', 'apple') → true", () => {
    expect(evaluateXPath("selected('apple baby crimson', 'apple')")).toBe(true);
  });

  it("selected('apple baby crimson', 'baby') → true", () => {
    expect(evaluateXPath("selected('apple baby crimson', 'baby')")).toBe(true);
  });

  it("selected('apple baby crimson', 'crimson') → true", () => {
    expect(evaluateXPath("selected('apple baby crimson', 'crimson')")).toBe(true);
  });

  it("selected('apple baby crimson', '  baby  ') → true (trims whitespace)", () => {
    // JavaRosa: testEval("selected('apple baby crimson', '  baby  ')", TRUE)
    expect(evaluateXPath("selected('apple baby crimson', '  baby  ')")).toBe(true);
  });

  it("selected('apple baby crimson', 'babby') → false (partial match fails)", () => {
    expect(evaluateXPath("selected('apple baby crimson', 'babby')")).toBe(false);
  });

  it("selected('apple baby crimson', 'bab') → false (prefix match fails)", () => {
    expect(evaluateXPath("selected('apple baby crimson', 'bab')")).toBe(false);
  });

  it("selected('', 'apple') → false", () => {
    expect(evaluateXPath("selected('', 'apple')")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// count-selected() and selected-at()
// Source: XPathEvalTest.java boolean_functions()
// ---------------------------------------------------------------------------
describe("XPath functions — count-selected() / selected-at()", () => {
  it("count-selected('apple baby crimson') → 3.0", () => {
    expect(evaluateXPath("count-selected('apple baby crimson')")).toBe(3.0);
  });

  it("count-selected('') → 0.0", () => {
    expect(evaluateXPath("count-selected('')")).toBe(0.0);
  });

  it("selected-at('apple baby crimson', 2) → 'crimson' (1-indexed)", () => {
    // JavaRosa: testEval("selected-at('apple baby crimson', 2)", "crimson")
    expect(evaluateXPath("selected-at('apple baby crimson', 2)")).toBe("crimson");
  });

  it("selected-at('apple baby', 2) → '' (out-of-bounds → empty)", () => {
    expect(evaluateXPath("selected-at('apple baby', 2)")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// checklist() — ODK checkbox validation
// Source: XPathEvalTest.java boolean_functions()
// ---------------------------------------------------------------------------
describe("XPath functions — checklist()", () => {
  it("checklist(1, 3, 'foo', 'bar') → true (2 selected, in [1,3])", () => {
    // JavaRosa: testEval("checklist(1, 3, 'foo', 'bar')", true)
    expect(evaluateXPath("checklist(1, 3, 'foo', 'bar')")).toBe(true);
  });

  it("checklist(-1, 1, 'foo', 'bar') → false (2 selected > max 1)", () => {
    expect(evaluateXPath("checklist(-1, 1, 'foo', 'bar')")).toBe(false);
  });

  it("checklist(3, 5, 'foo', 'bar') → false (2 selected < min 3)", () => {
    expect(evaluateXPath("checklist(3, 5, 'foo', 'bar')")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// coalesce() — return first non-empty
// Not in XPathEvalTest directly but standard ODK function; canonical behavior:
// coalesce('', 'fallback') = 'fallback'
// ---------------------------------------------------------------------------
describe("XPath functions — coalesce()", () => {
  it("coalesce('value', 'fallback') → 'value' (first non-empty wins)", () => {
    expect(evaluateXPath("coalesce('value', 'fallback')")).toBe("value");
  });

  it("coalesce('', 'fallback') → 'fallback'", () => {
    expect(evaluateXPath("coalesce('', 'fallback')")).toBe("fallback");
  });

  it("coalesce('', '') → ''", () => {
    expect(evaluateXPath("coalesce('', '')")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// regex() — ODK regex match
// Source: XPathEvalTest.java regex()
// ---------------------------------------------------------------------------
describe("XPath functions — regex()", () => {
  it("regex('12345','[0-9]+') → true", () => {
    // JavaRosa: testEval("regex('12345','[0-9]+')", null, ec, TRUE)
    expect(evaluateXPath("regex('12345','[0-9]+')")).toBe(true);
  });

  it("regex('abc','[0-9]+') → false", () => {
    expect(evaluateXPath("regex('abc','[0-9]+')")).toBe(false);
  });

  it("regex('hello world','\\\\w+') → true", () => {
    expect(evaluateXPath("regex('hello world','\\w+')")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// date() and number(date())
// Source: XPathEvalTest.java date_functions(), type_conversions()
// Note: DST/timezone edge cases intentionally excluded per JavaRosa comment.
// ---------------------------------------------------------------------------
describe("XPath functions — date()", () => {
  it("date(0) → epoch 1970-01-01", () => {
    // JavaRosa: testEval("date(0)", DateUtils.getDate(1970, 1, 1))
    // In XPath, date(0) should return a value that string() gives "1970-01-01"
    expect(evaluateXPath("string(date(0))")).toBe("1970-01-01");
  });

  it("date(1) → 1970-01-02 (days since epoch)", () => {
    expect(evaluateXPath("string(date(1))")).toBe("1970-01-02");
  });

  it("date(-1) → 1969-12-31", () => {
    expect(evaluateXPath("string(date(-1))")).toBe("1969-12-31");
  });

  it("date('2000-01-01') → parses to date value", () => {
    expect(evaluateXPath("string(date('2000-01-01'))")).toBe("2000-01-01");
  });

  it("number(date('1970-01-01')) → 0.0 (days since epoch)", () => {
    // JavaRosa: testEval("number(date('1970-01-01'))", 0.0)
    expect(evaluateXPath("number(date('1970-01-01'))")).toBe(0.0);
  });

  it("number(date('1970-01-02')) → 1.0", () => {
    expect(evaluateXPath("number(date('1970-01-02'))")).toBe(1.0);
  });

  it("number(date('1969-12-31')) → -1.0", () => {
    expect(evaluateXPath("number(date('1969-12-31'))")).toBe(-1.0);
  });

  it("number(date('2008-09-05')) → 14127.0", () => {
    expect(evaluateXPath("number(date('2008-09-05'))")).toBe(14127.0);
  });

  it("date('1983-09-31') throws — invalid date", () => {
    // JavaRosa: testEval("date('1983-09-31')", new XPathTypeMismatchException())
    expectEvalError("date('1983-09-31')");
  });

  it("date('not a date') throws", () => {
    expectEvalError("date('not a date')");
  });

  it("date(true()) throws — boolean not convertible to date", () => {
    expectEvalError("date(true())");
  });

  it("format-date formats to custom pattern", () => {
    // JavaRosa: testEval("format-date('2018-01-02T10:20:30.123', \"%Y-%m-%e %H:%M:%S\")", "2018-01-2 10:20:30")
    expect(
      evaluateXPath("format-date('2018-01-02T10:20:30.123', \"%Y-%m-%e %H:%M:%S\")")
    ).toBe("2018-01-2 10:20:30");
  });
});

// ---------------------------------------------------------------------------
// true() / false() / not()
// Source: XPathEvalTest.java boolean_functions() and type_conversions()
// ---------------------------------------------------------------------------
describe("XPath functions — true() / false()", () => {
  it("true() → true", () => {
    expect(evaluateXPath("true()")).toBe(true);
  });

  it("false() → false", () => {
    expect(evaluateXPath("false()")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ends-with() — XPath 2.0 function adopted by ODK
// Source: XPathEvalTest.java substring_functions()
// ---------------------------------------------------------------------------
describe("XPath functions — ends-with()", () => {
  it("ends-with('abc', 'c') → true", () => {
    expect(evaluateXPath("ends-with('abc', 'c')")).toBe(true);
  });

  it("ends-with('abc', 'a') → false", () => {
    expect(evaluateXPath("ends-with('abc', 'a')")).toBe(false);
  });

  it("ends-with('', '') → true", () => {
    expect(evaluateXPath("ends-with('', '')")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// indexed-repeat() — ODK repeat navigation
// Source: IndexedRepeatTest.java / XPathEvalTest.java node_referencing()
// NOTE: These tests require a live instance and are more complex.
// The signatures below match the expected API shape; instance-binding
// is part of Phase 2 scope.
// ---------------------------------------------------------------------------
describe("XPath functions — indexed-repeat() (instance-binding required)", () => {
  it.fails("indexed-repeat with numeric index returns correct node value", () => {
    // JavaRosa: indexed-repeat(/data/repeat/name, /data/repeat, 1)
    // → string value of /data/repeat[1]/name node
    // Once Phase 2 wires instance evaluation, this must return a string.
    // Today the stub throws, so this assertion fails (it.fails is correct).
    const result = evaluateXPath("indexed-repeat(/data/repeat/name, /data/repeat, 1)");
    expect(typeof result).toBe("string");
  });
});
