/**
 * Tests: defensive copy of Date values in AnswerValue for kinds: date, time, dateTime.
 *
 * JavaRosa reference: DateData.java, TimeData.java, DateTimeData.java
 * Each wraps a java.util.Date by value — mutation of the external Date after
 * construction does not affect the stored value, and vice versa.
 *
 * Our AnswerValue should provide the same immutability guarantee.
 *
 * Tests cover two directions:
 *   1. Mutating the Date passed to cast() / convenience ctor must NOT affect the stored value.
 *   2. Mutating the Date returned from AnswerValue.value must NOT affect subsequent reads.
 */

import { describe, expect, it } from "vitest";
import { cast, dateValue, uncast } from "../../../src/model/data/codecs.ts";

// ---------------------------------------------------------------------------
// Helper: advance a Date by 1 day in-place
// ---------------------------------------------------------------------------
function advanceDay(d: Date): void {
  d.setUTCDate(d.getUTCDate() + 1);
}

// ---------------------------------------------------------------------------
// Direction 1: mutating the input Date must not corrupt the AnswerValue
// ---------------------------------------------------------------------------

describe("defensive Date copy — input mutation isolation", () => {
  it("cast('date'): mutating the raw string source Date after cast has no effect", () => {
    // cast takes a raw string, so the Date is created internally — this confirms
    // the value returned is not the same reference across two casts.
    const v1 = cast("date", "2024-03-15");
    const v2 = cast("date", "2024-03-15");
    const d = v2!.value as Date;
    advanceDay(d);
    // v1's stored Date must be unchanged
    expect(uncast(v1!)).toBe("2024-03-15");
  });

  it("dateValue(): mutating the Date passed in must not affect the stored value", () => {
    const input = new Date("2024-03-15T00:00:00.000Z");
    const v = dateValue(input);
    // mutate original
    advanceDay(input);
    // stored value must still be 2024-03-15
    expect(uncast(v)).toBe("2024-03-15");
  });

  it("cast('time'): mutating the returned Date does not affect a fresh uncast", () => {
    const v = cast("time", "14:30:00.000Z");
    const d = v!.value as Date;
    // advance by one hour
    d.setUTCHours(d.getUTCHours() + 1);
    // uncast should still yield the original time
    expect(uncast(v!)).toBe("14:30:00.000Z");
  });

  it("cast('dateTime'): mutating the returned Date does not affect a fresh uncast", () => {
    const raw = "2024-03-15T10:00:00.000Z";
    const v = cast("dateTime", raw);
    const d = v!.value as Date;
    advanceDay(d);
    expect(uncast(v!)).toBe(raw);
  });
});

// ---------------------------------------------------------------------------
// Direction 2: returned Date copies must not alias each other or the internal store
// ---------------------------------------------------------------------------

describe("defensive Date copy — output isolation", () => {
  it("cast('date'): two accesses to .value return independent Date objects", () => {
    const v = cast("date", "2024-03-15");
    const d1 = v!.value as Date;
    const d2 = v!.value as Date;
    // Must be different object references (or at least independent by mutation test)
    advanceDay(d1);
    // d2 must not be affected
    expect(d2.getUTCDate()).toBe(15);
  });

  it("cast('time'): two accesses to .value return independent Date objects", () => {
    const v = cast("time", "10:00:00.000Z");
    const d1 = v!.value as Date;
    const d2 = v!.value as Date;
    d1.setUTCHours(23);
    expect(d2.getUTCHours()).toBe(10);
  });

  it("cast('dateTime'): two accesses to .value return independent Date objects", () => {
    const v = cast("dateTime", "2024-03-15T10:00:00.000Z");
    const d1 = v!.value as Date;
    const d2 = v!.value as Date;
    advanceDay(d1);
    expect(d2.getUTCDate()).toBe(15);
  });
});
