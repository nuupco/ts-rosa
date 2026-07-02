/**
 * Equivalence: XPathEvalTest.java — evaluation red bar (Phase 2)
 *
 * Source oracle:
 *   reference/javarosa/src/test/java/org/javarosa/xpath/test/XPathEvalTest.java
 *
 * Every test is marked it.fails() because the XPath evaluation engine does
 * not exist yet (Phase 2). When the engine is implemented the it.fails()
 * wrapper must be removed and the tests should pass as-is.
 *
 * Cases NOT ported here (backlog for Phase 2):
 *   - NodeSet / path evaluation requiring a live FormInstance (count(),
 *     count-non-empty(), /data/path references) — needs instance-binding wired.
 *   - Custom IFunctionHandler registration (HANDLER_ADD, HANDLER_PROTO, etc.)
 *     — requires the function-handler extension point.
 *   - Date arithmetic edge cases with DST / timezone — intentionally excluded
 *     by JavaRosa itself ("just too hard").
 *   - Geo functions (geofence) — not in core XPath scope for Phase 2.
 *   - Locale-sensitive round() variants (Polish locale) — multi-locale harness
 *     not yet set up.
 *   - indexed-repeat() with live repeat instance traversal.
 *   - crypto functions (digest, base64).
 */

import { describe, it, expect } from "vitest";
import { evaluateXPath } from "../../../src/xpath/index.ts";

// ---------------------------------------------------------------------------
// Numeric literals
// Source: XPathEvalTest.java numeric_literals()
// ---------------------------------------------------------------------------
describe("XPath eval — numeric literals", () => {
  it("5 → 5.0", () => {
    // JavaRosa: testEval("5", 5.0)
    expect(evaluateXPath("5")).toBe(5.0);
  });

  it("555555.555 → 555555.555", () => {
    expect(evaluateXPath("555555.555")).toBe(555555.555);
  });

  it(".000555 → 0.000555", () => {
    expect(evaluateXPath(".000555")).toBe(0.000555);
  });

  it("0 → 0.0", () => {
    expect(evaluateXPath("0")).toBe(0.0);
  });

  it("-5 → -5.0", () => {
    expect(evaluateXPath("-5")).toBe(-5.0);
  });

  it("1.23e21 scientific literal", () => {
    expect(evaluateXPath("1230000000000000000000")).toBe(1.23e21);
  });
});

// ---------------------------------------------------------------------------
// String literals
// Source: XPathEvalTest.java string_literals()
// ---------------------------------------------------------------------------
describe("XPath eval — string literals", () => {
  it("empty string '' → ''", () => {
    expect(evaluateXPath("''")).toBe("");
  });

  it("double-quoted string", () => {
    expect(evaluateXPath('"test string"')).toBe("test string");
  });

  it("whitespace string '   ' preserves spaces", () => {
    expect(evaluateXPath("'   '")).toBe("   ");
  });
});

// ---------------------------------------------------------------------------
// Arithmetic operators
// Source: XPathEvalTest.java math_operators()
// ---------------------------------------------------------------------------
describe("XPath eval — arithmetic operators", () => {
  it("5.5 + 5.5 → 11.0", () => {
    expect(evaluateXPath("5.5 + 5.5")).toBe(11.0);
  });

  it("0 + 0 → 0.0", () => {
    expect(evaluateXPath("0 + 0")).toBe(0.0);
  });

  it("6.1 - 7.8 → -1.7 (float rounding handled)", () => {
    expect(evaluateXPath("6.1 - 7.8")).toBeCloseTo(-1.7, 10);
  });

  it("-3 + 4 → 1.0", () => {
    expect(evaluateXPath("-3 + 4")).toBe(1.0);
  });

  it("1 - 2 - 3 → -4.0 (left-associative)", () => {
    expect(evaluateXPath("1 - 2 - 3")).toBe(-4.0);
  });

  it("1 - (2 - 3) → 2.0 (parentheses override associativity)", () => {
    expect(evaluateXPath("1 - (2 - 3)")).toBe(2.0);
  });

  it("-(8*5) → -40.0", () => {
    expect(evaluateXPath("-(8*5)")).toBe(-40.0);
  });

  it("-'19' coerces string to number → -19.0", () => {
    // JavaRosa: testEval("-'19'", -19.0)
    expect(evaluateXPath("-'19'")).toBe(-19.0);
  });

  it("1.1 * -1.1 → -1.21", () => {
    expect(evaluateXPath("1.1 * -1.1")).toBeCloseTo(-1.21, 10);
  });

  it("-10 div -4 → 2.5", () => {
    expect(evaluateXPath("-10 div -4")).toBe(2.5);
  });

  it("2 * 3 div 8 * 2 → 1.5 (left-associative)", () => {
    expect(evaluateXPath("2 * 3 div 8 * 2")).toBe(1.5);
  });

  it("3 + 3 * 3 → 12.0 (mul before add)", () => {
    expect(evaluateXPath("3 + 3 * 3")).toBe(12.0);
  });

  it("1 div 0 → Infinity", () => {
    expect(evaluateXPath("1 div 0")).toBe(Infinity);
  });

  it("-1 div 0 → -Infinity", () => {
    expect(evaluateXPath("-1 div 0")).toBe(-Infinity);
  });

  it("0 div 0 → NaN", () => {
    expect(evaluateXPath("0 div 0")).toBeNaN();
  });

  it("3.1 mod 3.1 → 0.0", () => {
    expect(evaluateXPath("3.1 mod 3.1")).toBe(0.0);
  });

  it("5 mod 3.1 → 1.9", () => {
    expect(evaluateXPath("5 mod 3.1")).toBeCloseTo(1.9, 10);
  });

  it("-5 mod 3 → -2.0 (sign follows dividend)", () => {
    expect(evaluateXPath("-5 mod 3")).toBe(-2.0);
  });

  it("5 mod 0 → NaN", () => {
    expect(evaluateXPath("5 mod 0")).toBeNaN();
  });

  it("'123' * '456' → 56088.0 (string coercion)", () => {
    expect(evaluateXPath("'123' * '456'")).toBe(56088.0);
  });

  it("5 * (6 + 7) → 65.0", () => {
    expect(evaluateXPath("5 * (6 + 7)")).toBe(65.0);
  });
});

// ---------------------------------------------------------------------------
// Comparison operators
// Source: XPathEvalTest.java strange_operators() and odd_comparisons()
// ---------------------------------------------------------------------------
describe("XPath eval — comparison operators", () => {
  it("4 < 5 → true", () => {
    expect(evaluateXPath("4 < 5")).toBe(true);
  });

  it("5 < 5 → false", () => {
    expect(evaluateXPath("5 < 5")).toBe(false);
  });

  it("6 < 5 → false", () => {
    expect(evaluateXPath("6 < 5")).toBe(false);
  });

  it("4 <= 5 → true", () => {
    expect(evaluateXPath("4 <= 5")).toBe(true);
  });

  it("5 <= 5 → true", () => {
    expect(evaluateXPath("5 <= 5")).toBe(true);
  });

  it("6 > 5 → true", () => {
    expect(evaluateXPath("6 > 5")).toBe(true);
  });

  it("5 >= 5 → true", () => {
    expect(evaluateXPath("5 >= 5")).toBe(true);
  });

  it("-3 > -6 → true", () => {
    expect(evaluateXPath("-3 > -6")).toBe(true);
  });

  it("3 = 3 → true", () => {
    expect(evaluateXPath("3 = 3")).toBe(true);
  });

  it("3 = 4 → false", () => {
    expect(evaluateXPath("3 = 4")).toBe(false);
  });

  it("3 != 4 → true", () => {
    expect(evaluateXPath("3 != 4")).toBe(true);
  });

  it("'abc' = 'abc' → true", () => {
    expect(evaluateXPath("'abc' = 'abc'")).toBe(true);
  });

  it("'abc' = 'def' → false", () => {
    expect(evaluateXPath("'abc' = 'def'")).toBe(false);
  });

  it("6.1 - 7.8 = -1.7 → true (float equality handling)", () => {
    // JavaRosa: testEval("6.1 - 7.8 = -1.7", TRUE)
    expect(evaluateXPath("6.1 - 7.8 = -1.7")).toBe(true);
  });

  it("'-17' > '-172' → true (numeric comparison, not string)", () => {
    // JavaRosa: testEval("'-17' > '-172'", TRUE) — no string comparison: converted to number
    expect(evaluateXPath("'-17' > '-172'")).toBe(true);
  });

  it("'abc' < 'abcd' → false (NaN comparison)", () => {
    // JavaRosa: testEval("'abc' < 'abcd'", FALSE) — no string comparison: converted to NaN
    expect(evaluateXPath("'abc' < 'abcd'")).toBe(false);
  });

  it("true() = 17 → true (boolean-to-number coercion)", () => {
    // JavaRosa: testEval("true() = 17", TRUE)
    expect(evaluateXPath("true() = 17")).toBe(true);
  });

  it("0 = false() → true", () => {
    expect(evaluateXPath("0 = false()")).toBe(true);
  });

  it("17 = '17.0000000' → true (cross-type numeric equality)", () => {
    expect(evaluateXPath("17 = '17.0000000'")).toBe(true);
  });

  it("'0017.' = 17 → true (string to number coercion)", () => {
    expect(evaluateXPath("'0017.' = 17")).toBe(true);
  });

  it("'017.' = '17.000' → false (both strings, no cross-coercion)", () => {
    expect(evaluateXPath("'017.' = '17.000'")).toBe(false);
  });

  it("3 < 4 < 5 → true (left-assoc chained comparison)", () => {
    // JavaRosa: testEval("3 < 4 < 5", TRUE) — (3<4)=true, true<5 → 1<5 → true
    expect(evaluateXPath("3 < 4 < 5")).toBe(true);
  });

  it("-3 < 3 = 6 >= 6 → true (precedence chain)", () => {
    expect(evaluateXPath("-3 < 3 = 6 >= 6")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Boolean operators and short-circuit
// Source: XPathEvalTest.java strange_operators()
// ---------------------------------------------------------------------------
describe("XPath eval — boolean operators", () => {
  it("true() and true() → true", () => {
    expect(evaluateXPath("true() and true()")).toBe(true);
  });

  it("true() and false() → false", () => {
    expect(evaluateXPath("true() and false()")).toBe(false);
  });

  it("false() and false() → false", () => {
    expect(evaluateXPath("false() and false()")).toBe(false);
  });

  it("true() or false() → true", () => {
    expect(evaluateXPath("true() or false()")).toBe(true);
  });

  it("false() or false() → false", () => {
    expect(evaluateXPath("false() or false()")).toBe(false);
  });

  it("true() or true() and false() → true (and before or)", () => {
    expect(evaluateXPath("true() or true() and false()")).toBe(true);
  });

  it("(true() or true()) and false() → false", () => {
    expect(evaluateXPath("(true() or true()) and false()")).toBe(false);
  });

  it("true() or date('') short-circuits (does not eval right side)", () => {
    // JavaRosa: testEval("true() or date('')", TRUE) — short-circuiting
    expect(evaluateXPath("true() or date('')")).toBe(true);
  });

  it("false() and date('') short-circuits", () => {
    // JavaRosa: testEval("false() and date('')", FALSE) — short-circuiting
    expect(evaluateXPath("false() and date('')")).toBe(false);
  });

  it("'' or 17 → true (empty string is falsy, 17 is truthy)", () => {
    expect(evaluateXPath("'' or 17")).toBe(true);
  });

  it("false() or 0 + 2 → true", () => {
    // JavaRosa: testEval("false() or 0 + 2", TRUE) — precedence: or < +
    expect(evaluateXPath("false() or 0 + 2")).toBe(true);
  });

  it("(false() or 0) + 2 → 2.0", () => {
    // JavaRosa: testEval("(false() or 0) + 2", 2.0)
    expect(evaluateXPath("(false() or 0) + 2")).toBe(2.0);
  });

  it("false() and false() < true() → false", () => {
    expect(evaluateXPath("false() and false() < true()")).toBe(false);
  });

  it("(false() and false()) < true() → true", () => {
    expect(evaluateXPath("(false() and false()) < true()")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Type conversion functions: boolean(), number(), string()
// Source: XPathEvalTest.java type_conversions()
// ---------------------------------------------------------------------------
describe("XPath eval — type conversions", () => {
  // boolean()
  it("boolean(true()) → true", () => {
    expect(evaluateXPath("boolean(true())")).toBe(true);
  });

  it("boolean(false()) → false", () => {
    expect(evaluateXPath("boolean(false())")).toBe(false);
  });

  it("boolean(1) → true", () => {
    expect(evaluateXPath("boolean(1)")).toBe(true);
  });

  it("boolean(0) → false", () => {
    expect(evaluateXPath("boolean(0)")).toBe(false);
  });

  it("boolean('') → false", () => {
    expect(evaluateXPath("boolean('')")).toBe(false);
  });

  it("boolean('asdf') → true", () => {
    expect(evaluateXPath("boolean('asdf')")).toBe(true);
  });

  it("boolean('false') → true (non-empty string)", () => {
    // JavaRosa: testEval("boolean('false')", TRUE)
    expect(evaluateXPath("boolean('false')")).toBe(true);
  });

  it("boolean(1 div 0) → true (Infinity is truthy)", () => {
    expect(evaluateXPath("boolean(1 div 0)")).toBe(true);
  });

  it("boolean(number('NaN')) → false", () => {
    expect(evaluateXPath("boolean(number('NaN'))")).toBe(false);
  });

  // number()
  it("number(true()) → 1.0", () => {
    expect(evaluateXPath("number(true())")).toBe(1.0);
  });

  it("number(false()) → 0.0", () => {
    expect(evaluateXPath("number(false())")).toBe(0.0);
  });

  it("number('100') → 100.0", () => {
    expect(evaluateXPath("number('100')")).toBe(100.0);
  });

  it("number('not a number') → NaN", () => {
    expect(evaluateXPath("number('not a number')")).toBeNaN();
  });

  it("number(' -12345.6789  ') trims and parses → -12345.6789", () => {
    // String-to-number parse must be exact (IEEE 754 representable); .toBe not toBeCloseTo.
    expect(evaluateXPath("number(' -12345.6789  ')")).toBe(-12345.6789);
  });

  it("number('NaN') → NaN", () => {
    expect(evaluateXPath("number('NaN')")).toBeNaN();
  });

  it("number('Infinity') → NaN (not a valid number literal)", () => {
    // JavaRosa: testEval("number('Infinity')", NaN)
    expect(evaluateXPath("number('Infinity')")).toBeNaN();
  });

  it("number('1.1e6') → NaN (scientific notation not supported in number())", () => {
    expect(evaluateXPath("number('1.1e6')")).toBeNaN();
  });

  it("number(1 div 0) → Infinity", () => {
    expect(evaluateXPath("number(1 div 0)")).toBe(Infinity);
  });

  it("number(-1 div 0) → -Infinity", () => {
    expect(evaluateXPath("number(-1 div 0)")).toBe(-Infinity);
  });

  // string()
  it("string(true()) → 'true'", () => {
    expect(evaluateXPath("string(true())")).toBe("true");
  });

  it("string(false()) → 'false'", () => {
    expect(evaluateXPath("string(false())")).toBe("false");
  });

  it("string(number('NaN')) → 'NaN'", () => {
    expect(evaluateXPath("string(number('NaN'))")).toBe("NaN");
  });

  it("string(1 div 0) → 'Infinity'", () => {
    expect(evaluateXPath("string(1 div 0)")).toBe("Infinity");
  });

  it("string(-1 div 0) → '-Infinity'", () => {
    expect(evaluateXPath("string(-1 div 0)")).toBe("-Infinity");
  });

  it("string(0) → '0'", () => {
    expect(evaluateXPath("string(0)")).toBe("0");
  });

  it("string(-0) → '0' (negative zero prints as 0)", () => {
    expect(evaluateXPath("string(-0)")).toBe("0");
  });

  it("string(123456.0000) → '123456' (no trailing zeros)", () => {
    expect(evaluateXPath("string(123456.0000)")).toBe("123456");
  });

  it("string(.557586) → '0.557586'", () => {
    expect(evaluateXPath("string(.557586)")).toBe("0.557586");
  });

  it("string('a string') → 'a string'", () => {
    expect(evaluateXPath("string('a string')")).toBe("a string");
  });

  it("true() + 8 → 9.0 (boolean coerced to 1)", () => {
    // JavaRosa: testEval("true() + 8", 9.0)
    expect(evaluateXPath("true() + 8")).toBe(9.0);
  });
});

// ---------------------------------------------------------------------------
// not() function
// Source: XPathEvalTest.java boolean_functions()
// ---------------------------------------------------------------------------
describe("XPath eval — not()", () => {
  it("not(true()) → false", () => {
    expect(evaluateXPath("not(true())")).toBe(false);
  });

  it("not(false()) → true", () => {
    expect(evaluateXPath("not(false())")).toBe(true);
  });

  it("not('') → true (empty string is falsy)", () => {
    expect(evaluateXPath("not('')")).toBe(true);
  });

  it("not(contains('a', 'b')) → true", () => {
    expect(evaluateXPath("not(contains('a', 'b'))")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// String functions: contains, starts-with, concat, substring
// Source: XPathEvalTest.java substring_functions() and type_conversions()
// ---------------------------------------------------------------------------
describe("XPath eval — string functions", () => {
  it("contains('a', 'a') → true", () => {
    expect(evaluateXPath("contains('a', 'a')")).toBe(true);
  });

  it("contains('a', 'b') → false", () => {
    expect(evaluateXPath("contains('a', 'b')")).toBe(false);
  });

  it("contains('abc', 'b') → true", () => {
    expect(evaluateXPath("contains('abc', 'b')")).toBe(true);
  });

  it("contains('abc', 'bcd') → false", () => {
    expect(evaluateXPath("contains('abc', 'bcd')")).toBe(false);
  });

  it("starts-with('abc', 'a') → true", () => {
    expect(evaluateXPath("starts-with('abc', 'a')")).toBe(true);
  });

  it("starts-with('', 'a') → false", () => {
    expect(evaluateXPath("starts-with('', 'a')")).toBe(false);
  });

  it("starts-with('', '') → true", () => {
    expect(evaluateXPath("starts-with('', '')")).toBe(true);
  });

  it("concat() → ''", () => {
    // JavaRosa: testEval("concat()", "", ec, "")
    expect(evaluateXPath("concat()")).toBe("");
  });

  it("concat('a') → 'a'", () => {
    expect(evaluateXPath("concat('a')")).toBe("a");
  });

  it("concat('a','b','') → 'ab'", () => {
    expect(evaluateXPath("concat('a','b','')")).toBe("ab");
  });

  it("concat('ab','cde','','fgh') → 'abcdefgh'", () => {
    expect(evaluateXPath("concat('ab','cde','','fgh')")).toBe("abcdefgh");
  });

  it("substring-before('hello','l') → 'he'", () => {
    expect(evaluateXPath("substring-before('hello','l')")).toBe("he");
  });

  it("substring-before('hello','q') → ''", () => {
    expect(evaluateXPath("substring-before('hello','q')")).toBe("");
  });

  it("substring-after('hello','l') → 'lo'", () => {
    expect(evaluateXPath("substring-after('hello','l')")).toBe("lo");
  });

  it("substring-after('hello','') → 'hello'", () => {
    expect(evaluateXPath("substring-after('hello','')")).toBe("hello");
  });

  it("substr('hello',0) → 'hello' (ODK substr, 0-indexed)", () => {
    // JavaRosa: testEval("substr('hello',0)", "hello")
    expect(evaluateXPath("substr('hello',0)")).toBe("hello");
  });

  it("substr('hello',1) → 'ello'", () => {
    expect(evaluateXPath("substr('hello',1)")).toBe("ello");
  });

  it("substr('hello',1,4) → 'ell'", () => {
    expect(evaluateXPath("substr('hello',1,4)")).toBe("ell");
  });

  it("substr('hello',-2) → 'lo' (negative offset from end)", () => {
    expect(evaluateXPath("substr('hello',-2)")).toBe("lo");
  });

  it("normalize-space('') → ''", () => {
    expect(evaluateXPath("normalize-space('')")).toBe("");
  });

  it("normalize-space('  a    b  ') → 'a b'", () => {
    expect(evaluateXPath("normalize-space(' a    b ')")).toBe("a b");
  });

  it("string-length('cocotero') → 8.0", () => {
    expect(evaluateXPath("string-length('cocotero')")).toBe(8.0);
  });

  it("translate('hello','l','L') → 'heLLo'", () => {
    expect(evaluateXPath("translate('hello','l','L')")).toBe("heLLo");
  });

  it("translate('hello','l','') removes chars → 'heo'", () => {
    expect(evaluateXPath("translate('hello','l','')")).toBe("heo");
  });

  it("translate('2019/01/02','/','-') → '2019-01-02'", () => {
    expect(evaluateXPath("translate('2019/01/02','/','-')")).toBe("2019-01-02");
  });
});

// ---------------------------------------------------------------------------
// Math functions
// Source: XPathEvalTest.java math_functions()
// ---------------------------------------------------------------------------
describe("XPath eval — math functions", () => {
  it("abs(-3.5) → 3.5", () => {
    expect(evaluateXPath("abs(-3.5)")).toBe(3.5);
  });

  it("round('14.29123456789') → 14.0", () => {
    expect(evaluateXPath("round('14.29123456789')")).toBe(14.0);
  });

  it("round('14.6') → 15.0", () => {
    expect(evaluateXPath("round('14.6')")).toBe(15.0);
  });

  it("round('14.29123456789', 2) → 14.29", () => {
    expect(evaluateXPath("round('14.29123456789', 2)")).toBe(14.29);
  });

  it("round('-0.5') → -0.0", () => {
    // JavaRosa: testEval("round('-0.5')", -0.0)
    expect(evaluateXPath("round('-0.5')")).toBe(-0.0);
  });

  it("round('NaN') → NaN", () => {
    expect(evaluateXPath("round('NaN')")).toBeNaN();
  });

  it("pow(2, 2) → 4.0", () => {
    expect(evaluateXPath("pow(2, 2)")).toBe(4.0);
  });

  it("pow(2, 0) → 1.0", () => {
    expect(evaluateXPath("pow(2, 0)")).toBe(1.0);
  });

  it("pow(-1, 2) → 1.0", () => {
    expect(evaluateXPath("pow(-1, 2)")).toBe(1.0);
  });

  it("sqrt(9) → 3.0", () => {
    expect(evaluateXPath("sqrt(9)")).toBe(3.0);
  });

  it("pi() → Math.PI", () => {
    expect(evaluateXPath("pi()")).toBeCloseTo(Math.PI, 10);
  });
});

// ---------------------------------------------------------------------------
// boolean-from-string() — ODK extension
// Source: XPathEvalTest.java boolean_functions()
// ---------------------------------------------------------------------------
describe("XPath eval — boolean-from-string()", () => {
  it("boolean-from-string('true') → true", () => {
    expect(evaluateXPath("boolean-from-string('true')")).toBe(true);
  });

  it("boolean-from-string('false') → false", () => {
    expect(evaluateXPath("boolean-from-string('false')")).toBe(false);
  });

  it("boolean-from-string('whatever') → false", () => {
    expect(evaluateXPath("boolean-from-string('whatever')")).toBe(false);
  });

  it("boolean-from-string('1') → true", () => {
    expect(evaluateXPath("boolean-from-string('1')")).toBe(true);
  });

  it("boolean-from-string('0') → false", () => {
    expect(evaluateXPath("boolean-from-string('0')")).toBe(false);
  });

  it("boolean-from-string(1.0001) → false (not exactly 1)", () => {
    expect(evaluateXPath("boolean-from-string(1.0001)")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Variable references ($name) — XPath variable-references change
// Source: XPathEvalTest.java variables() — bound number, bound string,
// arithmetic coercion, unbound throws. These are NEW cases (previously
// backlogged, not converted from any existing it.fails()).
// ---------------------------------------------------------------------------
describe("XPath eval — variable references ($name)", () => {
  it("$var_float_five resolves a bound numeric variable to its value", () => {
    expect(
      evaluateXPath("$var_float_five", {
        variables: new Map([["var_float_five", 5.0]]),
      } as never),
    ).toBe(5.0);
  });

  it("$var_float_five + 1 applies automatic XPath coercion in arithmetic", () => {
    expect(
      evaluateXPath("$var_float_five + 1", {
        variables: new Map([["var_float_five", 5.0]]),
      } as never),
    ).toBe(6.0);
  });

  it("$var_name resolves a bound string variable to its value", () => {
    expect(
      evaluateXPath("$var_name", {
        variables: new Map([["var_name", "hello"]]),
      } as never),
    ).toBe("hello");
  });

  it("$count + 1 coerces a bound string variable to a number", () => {
    expect(
      evaluateXPath("$count + 1", {
        variables: new Map([["count", "5"]]),
      } as never),
    ).toBe(6);
  });

  it("referencing an unbound variable throws", () => {
    expect(() => evaluateXPath("$unknown_var")).toThrow();
  });

  it("a partially-bound expression fails on the unbound reference, not masked by the bound one", () => {
    expect(() =>
      evaluateXPath("$bound_var + $unbound_var", {
        variables: new Map([["bound_var", 1]]),
      } as never),
    ).toThrow(/unbound_var/);
  });
});
