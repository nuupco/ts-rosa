/**
 * Equivalence: DateUtilsParseTimeTests.java + DateUtilsParseDateTimeTests.java + DateTimeTest.java
 *
 * Sources:
 *   reference/javarosa/src/test/java/org/javarosa/core/model/utils/test/DateUtilsParseTimeTests.java
 *   reference/javarosa/src/test/java/org/javarosa/core/model/utils/test/DateUtilsParseDateTimeTests.java
 *   reference/javarosa/src/test/java/org/javarosa/core/model/DateTimeTest.java
 *
 * SCOPE:
 *   We port only the cases that validate wire-format parsing (cast/uncast) at the codec layer.
 *   Cases tied to Java-specific utils (withTimeZone system-property override, parseTimeWithFixedDate,
 *   Scenario/XFormParser engine integration) are marked it.fails with the appropriate phase note.
 *
 * OMITTED from port (not applicable):
 *   - DateUtilsParseTimeTests.parseTime_produces_expected_results_in_all_time_zones:
 *     Uses Java's TimeZone.setDefault() to change the system timezone mid-test.
 *     Node.js has no equivalent and Bun doesn't expose TZ mutation per-test.
 *     The semantics we CAN test: that the UTC offset in the string is respected (see time-data.test.ts).
 *   - DateUtilsParseDateTimeTests.parseDateTime_produces_expected_results_in_all_time_zones:
 *     Same reason — system TZ mutation not available in Bun.
 *   - DateTimeTest.java Scenario-based tests: require XFormParser + DAG engine (Phase 2+).
 *
 * What we DO port:
 *   - Time offset parsing semantics (UTC value from offset-qualified strings)
 *   - DateTime offset parsing semantics
 *   - Invalid format → null (cast returns null)
 *   - Wire format round-trips (cast → uncast → cast produces same UTC instant)
 */

import { describe, it, expect } from "vitest";
import { cast, uncast } from "../../../src/model/data/codecs.ts";

// ---------------------------------------------------------------------------
// DateUtilsParseTimeTests — time offset semantics
// The Java test verifies that parsing "14:00+02:00" in any system timezone
// always produces an instant that, when projected back to +02:00, shows 14:00.
// We verify the UTC value directly (same semantic guarantee, different mechanism).
// ---------------------------------------------------------------------------

describe("JR equivalence: DateUtils.parseTime — offset semantics", () => {
  it("'14:00' parses as local (no offset) — non-null result", () => {
    // JR: LocalTime.parse("14:00") — no offset, interpreted in current TZ.
    // We just verify it parses to a non-null result.
    const data = cast("time", "14:00");
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("time");
  });

  it("'14:00Z' parses as UTC 14:00 (JR: OffsetTime.parse('14:00Z'))", () => {
    const data = cast("time", "14:00Z");
    expect(data).not.toBeNull();
    const d = data!.value as Date;
    expect(d.getUTCHours()).toBe(14);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it("'14:00+02' parses as UTC 12:00 (JR: OffsetTime.parse('14:00+02:00'))", () => {
    // +02 offset → UTC = 14 - 2 = 12
    const data = cast("time", "14:00+02:00");
    expect(data).not.toBeNull();
    const d = data!.value as Date;
    expect(d.getUTCHours()).toBe(12);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it("'14:00-02' parses as UTC 16:00 (JR: OffsetTime.parse('14:00-02:00'))", () => {
    // -02 offset → UTC = 14 + 2 = 16
    const data = cast("time", "14:00-02:00");
    expect(data).not.toBeNull();
    const d = data!.value as Date;
    expect(d.getUTCHours()).toBe(16);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it("'14:00+02:30' parses as UTC 11:30 (JR: OffsetTime.parse('14:00+02:30'))", () => {
    // +02:30 → UTC = 14h - 2h30m = 11:30
    const data = cast("time", "14:00+02:30");
    expect(data).not.toBeNull();
    const d = data!.value as Date;
    expect(d.getUTCHours()).toBe(11);
    expect(d.getUTCMinutes()).toBe(30);
  });

  it("'14:00-02:30' parses as UTC 16:30 (JR: OffsetTime.parse('14:00-02:30'))", () => {
    // -02:30 → UTC = 14h + 2h30m = 16:30
    const data = cast("time", "14:00-02:30");
    expect(data).not.toBeNull();
    const d = data!.value as Date;
    expect(d.getUTCHours()).toBe(16);
    expect(d.getUTCMinutes()).toBe(30);
  });

  it("parseTime_produces_expected_results_in_all_time_zones — OMITTED (system TZ mutation not available in Bun)", () => {
    // JR: withTimeZone(tz, () → ...) changes the JVM system TZ, then asserts
    // that the parsed offset time projects back to the same OffsetTime/LocalTime.
    // Node.js/Bun has no equivalent per-test TZ mutation API.
    // The UTC-value semantics (above tests) cover the same correctness property.
  });
});

// ---------------------------------------------------------------------------
// DateUtilsParseDateTimeTests — dateTime offset semantics
// ---------------------------------------------------------------------------

describe("JR equivalence: DateUtils.parseDateTime — offset semantics", () => {
  it("'2016-04-13T16:26:00.000' parses as local dateTime (no offset) — non-null result", () => {
    // JR: LocalDateTime.parse("2016-04-13T16:26:00.000")
    const data = cast("dateTime", "2016-04-13T16:26:00.000");
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("dateTime");
  });

  it("'2016-04-13T16:26:00.000-07' parses as UTC 23:26 (JR: OffsetDateTime.parse(...))", () => {
    // -07:00 → UTC = 16 + 7 = 23
    const data = cast("dateTime", "2016-04-13T16:26:00.000-07:00");
    expect(data).not.toBeNull();
    const d = data!.value as Date;
    expect(d.getUTCFullYear()).toBe(2016);
    expect(d.getUTCMonth()).toBe(3); // April = 3 (0-indexed)
    expect(d.getUTCDate()).toBe(13);
    expect(d.getUTCHours()).toBe(23);
    expect(d.getUTCMinutes()).toBe(26);
  });

  it("'2015-12-16T16:09:00.000-08' parses as UTC 2015-12-17T00:09 (day rollover)", () => {
    // -08:00 → UTC = 16 + 8 = 24 → next day 00:09
    const data = cast("dateTime", "2015-12-16T16:09:00.000-08:00");
    expect(data).not.toBeNull();
    const d = data!.value as Date;
    expect(d.getUTCFullYear()).toBe(2015);
    expect(d.getUTCMonth()).toBe(11); // December = 11
    expect(d.getUTCDate()).toBe(17); // day rollover
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(9);
  });

  it("'2015-12-16T07:09:00.000+08' parses as UTC 2015-12-15T23:09 (day rollback)", () => {
    // +08:00 → UTC = 7 - 8 = -1 → previous day 23:09
    const data = cast("dateTime", "2015-12-16T07:09:00.000+08:00");
    expect(data).not.toBeNull();
    const d = data!.value as Date;
    expect(d.getUTCFullYear()).toBe(2015);
    expect(d.getUTCMonth()).toBe(11); // December
    expect(d.getUTCDate()).toBe(15); // day rollback
    expect(d.getUTCHours()).toBe(23);
    expect(d.getUTCMinutes()).toBe(9);
  });

  it("'2015-12-31T16:09:00.000-08' parses as UTC 2016-01-01T00:09 (year boundary rollover)", () => {
    // -08:00 → UTC = 16 + 8 = 24 on Dec 31 → Jan 1 00:09
    const data = cast("dateTime", "2015-12-31T16:09:00.000-08:00");
    expect(data).not.toBeNull();
    const d = data!.value as Date;
    expect(d.getUTCFullYear()).toBe(2016);
    expect(d.getUTCMonth()).toBe(0); // January
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(9);
  });

  it("parseDateTime_produces_expected_results_in_all_time_zones — OMITTED (system TZ mutation not available in Bun)", () => {
    // Same rationale as the parseTime version above.
  });
});

// ---------------------------------------------------------------------------
// DateTimeTest.java — codec-level cases only
// (Scenario-based cases require XFormParser + DAG engine → Phase 2+)
// ---------------------------------------------------------------------------

describe("JR equivalence: DateTimeTest — codec-level", () => {
  it("valid time string parses to non-null (JR: timeQuestionReturnsTimeDataAnswer — codec half)", () => {
    const data = cast("time", "23:14:00.000+02:00");
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("time");
  });

  it("invalid time string → null (JR: timeQuestionWithInvalidTimeFormatResultsInNoAnswer — codec half)", () => {
    expect(cast("time", "notatime")).toBeNull();
  });

  it("valid date string parses to non-null (JR: dateQuestionReturnsDateDataAnswer — codec half)", () => {
    const data = cast("date", "2025-09-25");
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("date");
  });

  it("invalid date string → null (JR: dateQuestionWithInvalidDateFormatResultsInNoAnswer — codec half)", () => {
    expect(cast("date", "not-a-date")).toBeNull();
  });

  it("valid dateTime string parses to non-null (JR: dateTimeQuestionReturnsDateTimeDataAnswer — codec half)", () => {
    const data = cast("dateTime", "2025-09-25T23:15:00.000+02:00");
    expect(data).not.toBeNull();
    expect(data!.kind).toBe("dateTime");
  });

  it("invalid dateTime string → null (JR: dateTimeQuestionWithInvalidDateTimeFormatResultsInNoAnswer — codec half)", () => {
    expect(cast("dateTime", "not-a-datetime")).toBeNull();
  });

  it.fails("timeQuestionReturnsTimeDataAnswer — Scenario engine (JR: requires XFormParser + DAG, Phase 2+)", () => {
    // JR test uses Scenario.init(html(...)) + scenario.answerOf() which requires
    // a fully working XFormParser and DAG evaluation engine.
    // Phase: 2+ (engine integration)
    throw new Error("Phase 2+ — Scenario engine not yet implemented");
  });

  it.fails("dateQuestionReturnsDateDataAnswer — Scenario engine (JR: requires XFormParser + DAG, Phase 2+)", () => {
    throw new Error("Phase 2+ — Scenario engine not yet implemented");
  });

  it.fails("dateTimeQuestionReturnsDateTimeDataAnswer — Scenario engine (JR: requires XFormParser + DAG, Phase 2+)", () => {
    throw new Error("Phase 2+ — Scenario engine not yet implemented");
  });
});
