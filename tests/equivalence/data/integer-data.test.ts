/**
 * Equivalence: IntegerDataTests.java
 *
 * Sources: reference/javarosa/src/test/java/org/javarosa/core/model/data/test/IntegerDataTests.java
 *
 * Maps JavaRosa IntegerData (getValue/setValue/null-guard) to our cast/uncast codecs
 * for type "int".  The "mutable value" and "null throws" behaviors translate to:
 *   - cast("int", raw) always returns a new object (no aliasing)
 *   - cast("int", "") → null  (null-like, no stored value)
 */

import { describe, it, expect } from "vitest";
import { cast, uncast } from "../../../src/model/data/codecs.ts";

describe("JR equivalence: IntegerData", () => {
  it("getValue returns the correct integer (JR: testGetData)", () => {
    const data = cast("int", "1");
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("int");
    expect(data!.value).toBe(1);
  });

  it("setValue updates to new value (JR: testSetData — set two then back)", () => {
    let data = cast("int", "1");
    expect(data!.value).toBe(1);

    data = cast("int", "2");
    expect(data!.value).toBe(2);
    expect(data!.value).not.toBe(1);

    data = cast("int", "1");
    expect(data!.value).toBe(1);
    expect(data!.value).not.toBe(2);
  });

  it("null input produces no value — no stored state is corrupted (JR: testNullData)", () => {
    // JavaRosa throws NullPointerException and preserves the old value.
    // In our functional model cast("int", "") returns null, and the
    // previously cast value is a separate immutable object — it cannot be mutated.
    const data = cast("int", "1");
    expect(data).not.toBeNull();

    const nullResult = cast("int", "");
    expect(nullResult).toBeNull(); // analogous to NPE guard: no value produced

    // previously obtained value is still intact
    expect(data!.value).toBe(1);
  });
});
