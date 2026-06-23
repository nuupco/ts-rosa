/**
 * Equivalence tests: boolean codec vs JavaRosa BooleanData.
 *
 * JavaRosa source: org.javarosa.core.model.data.BooleanData
 *
 * Behaviour documented in JavaRosa:
 *   - BooleanData.cast("1")  → true
 *   - BooleanData.cast("0")  → false
 *   - BooleanData.uncast()   → "1" (true) | "0" (false)
 *   - BooleanData.getDisplayText() → "True" | "False"
 *
 * No dedicated BooleanDataTest file exists in the JavaRosa test suite.
 * These cases are derived from BooleanData.java source behaviour and
 * AnswerDataFactory.templateByDataType (BOOLEAN → BooleanData).
 */

import { describe, expect, it } from "vitest";
import { cast, uncast } from "../../../src/model/data/codecs.ts";

describe("BooleanData equivalence — JavaRosa BooleanData.java", () => {
  // -------------------------------------------------------------------------
  // cast: "1" / "0" round-trip  (BooleanData.cast)
  // -------------------------------------------------------------------------

  it('cast("1") → true', () => {
    const v = cast("boolean", "1");
    expect(v).not.toBeNull();
    expect(v!.kind).toBe("boolean");
    expect(v!.value).toBe(true);
  });

  it('cast("0") → false', () => {
    const v = cast("boolean", "0");
    expect(v).not.toBeNull();
    expect(v!.kind).toBe("boolean");
    expect(v!.value).toBe(false);
  });

  // -------------------------------------------------------------------------
  // uncast: BooleanData.uncast() → "1" | "0"  (NOT "true"/"false")
  // JavaRosa: return new UncastData(data ? "1" : "0");
  // -------------------------------------------------------------------------

  it("uncast true → \"1\" (JavaRosa wire format)", () => {
    const v = cast("boolean", "1");
    expect(uncast(v!)).toBe("1");
  });

  it("uncast false → \"0\" (JavaRosa wire format)", () => {
    const v = cast("boolean", "0");
    expect(uncast(v!)).toBe("0");
  });

  // -------------------------------------------------------------------------
  // displayText: BooleanData.getDisplayText() → "True" | "False" (capital)
  // -------------------------------------------------------------------------

  it('displayText for true → "True"', () => {
    const v = cast("boolean", "1");
    expect(v!.displayText).toBe("True");
  });

  it('displayText for false → "False"', () => {
    const v = cast("boolean", "0");
    expect(v!.displayText).toBe("False");
  });

  // -------------------------------------------------------------------------
  // round-trip: cast → uncast → cast must preserve value
  // -------------------------------------------------------------------------

  it("round-trip: true → \"1\" → true", () => {
    const v1 = cast("boolean", "1");
    const raw = uncast(v1!);
    const v2 = cast("boolean", raw);
    expect(v2!.value).toBe(true);
  });

  it("round-trip: false → \"0\" → false", () => {
    const v1 = cast("boolean", "0");
    const raw = uncast(v1!);
    const v2 = cast("boolean", raw);
    expect(v2!.value).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Edge: empty string → null (no answer)
  // -------------------------------------------------------------------------

  it('cast("") → null (no answer)', () => {
    expect(cast("boolean", "")).toBeNull();
  });
});
