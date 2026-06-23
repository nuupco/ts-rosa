/**
 * Equivalence: DecimalData (JavaRosa DecimalData.java)
 *
 * Sources: reference/javarosa/src/main/java/org/javarosa/core/model/data/DecimalData.java
 *          (no dedicated test file; behavior derived from source + JR format contract)
 *
 * Key JR contract:
 *   getDisplayText()  → String.valueOf(d)  (Java double → always has decimal point if whole, e.g. "1.0")
 *   uncast()          → getValue().toString() which is also String.valueOf(d)
 *   cast(UncastData)  → Double.parseDouble(data.value)
 */

import { describe, it, expect } from "vitest";
import { cast, uncast } from "../../../src/model/data/codecs.ts";

describe("JR equivalence: DecimalData", () => {
  it("cast parses a decimal value correctly (JR: DecimalData.cast)", () => {
    const data = cast("decimal", "3.14");
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("decimal");
    expect(data!.value as number).toBeCloseTo(3.14);
  });

  it("displayText for whole-number decimal includes decimal point (JR: String.valueOf(1.0) → '1.0')", () => {
    const data = cast("decimal", "1.0");
    expect(data).not.toBeNull();
    // JavaRosa: String.valueOf(1.0) → "1.0", NOT "1"
    expect(data!.displayText).toBe("1.0");
  });

  it("displayText for fractional decimal preserves fraction (JR: String.valueOf(1.5) → '1.5')", () => {
    const data = cast("decimal", "1.5");
    expect(data!.displayText).toBe("1.5");
  });

  it("uncast of a whole-number decimal includes decimal point (JR: uncast → '1.0')", () => {
    const data = cast("decimal", "1.0");
    expect(uncast(data!)).toBe("1.0");
  });

  it("null guard: empty raw string → null (no value produced)", () => {
    expect(cast("decimal", "")).toBeNull();
  });

  it("null guard: invalid raw string → null", () => {
    expect(cast("decimal", "abc")).toBeNull();
  });

  it("round-trip: cast then uncast preserves value for common decimals", () => {
    for (const raw of ["0.0", "3.14", "-2.5", "100.0"]) {
      const data = cast("decimal", raw);
      expect(data).not.toBeNull();
      expect(uncast(data!)).toBe(raw);
    }
  });
});
