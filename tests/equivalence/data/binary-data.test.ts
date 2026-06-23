/**
 * Equivalence tests: binary codec vs JavaRosa binary type handling.
 *
 * JavaRosa source: AnswerDataFactory.java (BINARY → UncastData), TypeMappings.java
 *
 * NOTE: JavaRosa has NO dedicated BinaryData class.
 * AnswerDataFactory.templateByDataType(BINARY) → new UncastData()
 * This means binary is treated as a raw string (URI / file reference passthrough).
 * There are no dedicated BinaryDataTests in the JavaRosa test suite.
 * These cases are derived from AnswerDataFactory.java source behaviour
 * and the JavaRosa audit §3.3 documentation.
 *
 * Our 'binary' kind mirrors this: cast stores raw string, uncast returns it unchanged.
 */

import { describe, expect, it } from "vitest";
import { cast, uncast } from "../../../src/model/data/codecs.ts";

describe("binary data equivalence — JavaRosa AnswerDataFactory (BINARY → UncastData)", () => {
  // -------------------------------------------------------------------------
  // cast: raw string passthrough (JavaRosa: UncastData stores raw as-is)
  // -------------------------------------------------------------------------

  it("cast of a URI string is stored as-is", () => {
    const uri = "jr://file/photo.jpg";
    const v = cast("binary", uri);
    expect(v).not.toBeNull();
    expect(v!.kind).toBe("binary");
    expect(v!.value).toBe(uri);
  });

  it("cast of an empty string returns a binary value (not null) — passthrough", () => {
    // Binary is a reference; empty string is a valid (empty) reference.
    const v = cast("binary", "");
    expect(v).not.toBeNull();
    expect(v!.kind).toBe("binary");
    expect(v!.value).toBe("");
  });

  it("cast of arbitrary string stores value unchanged", () => {
    const raw = "some-arbitrary-value";
    const v = cast("binary", raw);
    expect(v!.value).toBe(raw);
  });

  // -------------------------------------------------------------------------
  // displayText: binary has no display transformation — mirrors raw value
  // (JavaRosa UncastData.getDisplayText() → the raw string itself)
  // -------------------------------------------------------------------------

  it("displayText equals the raw value", () => {
    const uri = "jr://file/audio.mp3";
    const v = cast("binary", uri);
    expect(v!.displayText).toBe(uri);
  });

  // -------------------------------------------------------------------------
  // uncast: returns the raw string unchanged (round-trip)
  // -------------------------------------------------------------------------

  it("uncast returns the original URI string", () => {
    const uri = "jr://file/photo.jpg";
    const v = cast("binary", uri);
    expect(uncast(v!)).toBe(uri);
  });

  it("round-trip: cast → uncast → cast preserves value", () => {
    const uri = "jr://file/signature.png";
    const v1 = cast("binary", uri);
    const raw = uncast(v1!);
    const v2 = cast("binary", raw);
    expect(v2!.value).toBe(uri);
  });
});
