/**
 * Equivalence: StringDataTests.java
 *
 * Sources: reference/javarosa/src/test/java/org/javarosa/core/model/data/test/StringDataTests.java
 *
 * Maps JavaRosa StringData (getValue/setValue/null-guard) to cast/uncast for type "string".
 */

import { describe, it, expect } from "vitest";
import { cast } from "../../../src/model/data/codecs.ts";

describe("JR equivalence: StringData", () => {
  const A = "string A";
  const B = "string B";

  it("getValue returns the stored string (JR: testGetData)", () => {
    const data = cast("string", A);
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("string");
    expect(data!.value).toBe(A);
  });

  it("successive casts return the new value (JR: testSetData)", () => {
    let data = cast("string", A);
    expect(data!.value).toBe(A);

    data = cast("string", B);
    expect(data!.value).toBe(B);
    expect(data!.value).not.toBe(A);

    data = cast("string", A);
    expect(data!.value).toBe(A);
    expect(data!.value).not.toBe(B);
  });

  it("null guard: empty raw string still produces a value for string type (JR: testNullData semantics)", () => {
    // StringData accepts empty strings — they are valid string values.
    // JavaRosa StringData.setValue(null) throws NPE; our cast("string", "") doesn't throw
    // but also does not produce null — an empty string IS a valid string answer.
    // We verify the previously obtained value is unaffected (immutable object).
    const data = cast("string", A);
    expect(data!.value).toBe(A);

    // empty string is valid for string type
    const empty = cast("string", "");
    expect(empty).not.toBeNull();
    expect(empty!.value).toBe("");

    // original remains intact
    expect(data!.value).toBe(A);
  });
});
