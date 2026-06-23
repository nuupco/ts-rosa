/**
 * Equivalence: SelectOneDataTests.java + MultipleItemsDataTests.java
 *
 * Sources:
 *   reference/javarosa/src/test/java/org/javarosa/core/model/data/test/SelectOneDataTests.java
 *   reference/javarosa/src/test/java/org/javarosa/core/model/data/test/MultipleItemsDataTests.java
 *
 * Maps JavaRosa SelectOneData / MultipleItemsData to our cast/uncast for "selectOne" / "selectMulti".
 *
 * Key behavioral contracts ported:
 *   - getValue returns the stored selection token
 *   - successive "setValue" updates to new selection
 *   - null guard: empty raw → null
 *   - SelectMulti: tokens are space-separated on the wire; getValue returns the ordered list
 *   - MultipleItemsData immutability: external mutations of source list don't affect stored value
 */

import { describe, it, expect } from "vitest";
import { cast, uncast } from "../../../src/model/data/codecs.ts";

describe("JR equivalence: SelectOneData", () => {
  it("getValue returns the correct selection token (JR: testGetData)", () => {
    const data = cast("selectOne", "Selection1");
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("selectOne");
    expect(data!.value).toBe("Selection1");
  });

  it("successive casts return updated token (JR: testSetData)", () => {
    let data = cast("selectOne", "Selection1");
    expect(data!.value).toBe("Selection1");

    data = cast("selectOne", "Selection2");
    expect(data!.value).toBe("Selection2");
    expect(data!.value).not.toBe("Selection1");

    data = cast("selectOne", "Selection1");
    expect(data!.value).toBe("Selection1");
    expect(data!.value).not.toBe("Selection2");
  });

  it("null guard: empty/whitespace-only raw → null (JR: testNullData)", () => {
    expect(cast("selectOne", "")).toBeNull();
    expect(cast("selectOne", "   ")).toBeNull();
  });
});

describe("JR equivalence: MultipleItemsData (selectMulti)", () => {
  it("getValue returns the correct list of tokens (JR: testGetData via SelectOneData)", () => {
    const data = cast("selectMulti", "Selection1 Selection2");
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("selectMulti");
    expect(data!.value).toEqual(["Selection1", "Selection2"]);
  });

  it("successive casts return updated list (JR: testSetData)", () => {
    let data = cast("selectMulti", "Selection1 Selection2");
    expect(data!.value).toEqual(["Selection1", "Selection2"]);

    data = cast("selectMulti", "Selection2 Selection3");
    expect(data!.value).toEqual(["Selection2", "Selection3"]);
    expect(data!.value).not.toEqual(["Selection1", "Selection2"]);

    data = cast("selectMulti", "Selection1 Selection2");
    expect(data!.value).toEqual(["Selection1", "Selection2"]);
  });

  it("null guard: empty raw → null (JR: testNullData)", () => {
    expect(cast("selectMulti", "")).toBeNull();
    expect(cast("selectMulti", "   ")).toBeNull();
  });

  it("immutability: the value array is independent from subsequent operations (JR: testVectorImmutability)", () => {
    // JavaRosa stores a defensive copy of the list.
    // Our cast always creates a new array from split tokens — immutability is structural.
    const raw = "Selection1 Selection2";
    const dataA = cast("selectMulti", raw);
    const dataB = cast("selectMulti", raw);
    expect(dataA!.value).toEqual(dataB!.value);
    // They are distinct array references
    expect(dataA!.value).not.toBe(dataB!.value);
  });

  it("round-trip: uncast produces original space-separated wire format (JR: wire format)", () => {
    const wire = "Selection1 Selection2 Selection3";
    const data = cast("selectMulti", wire);
    expect(uncast(data!)).toBe(wire);
  });
});
