/**
 * Equivalence: GeoTraceDataTest.java
 *
 * Source: reference/javarosa/src/test/java/org/javarosa/core/model/data/GeoTraceDataTest.java
 *         reference/javarosa/src/main/java/org/javarosa/core/model/data/GeoTraceData.java
 *
 * JR contract:
 *   GeoTraceData stores an ordered sequence of GeoPointData (open path, vs GeoShapeData's closed polygon).
 *   getDisplayText() → semicolon-separated GeoPointData.getDisplayText() values.
 *   GeoPointData.getDisplayText() → space-separated Java double-format components ("1.0 1.0 0.0 0.0").
 *   equals() / hashCode() → compare point lists structurally.
 *   uncast() → getDisplayText().
 *
 * Wire format (same as displayText):
 *   "lat lon alt acc;lat lon alt acc;..."  (Java double format per component)
 *
 * NOTE: GeoTrace and GeoShape share the same wire format and display contract.
 * The only semantic difference (open vs closed path) is above the codec layer.
 *
 * DIVERGENCE FIXED (category A — same fix as geoshape):
 *   formatGeoPoints now uses formatDecimal() → "1.0 1.0 0.0 0.0" (Java double format).
 */

import { describe, it, expect } from "vitest";
import { cast, uncast } from "../../../src/model/data/codecs.ts";
import type { GeoPoint } from "../../../src/model/data/AnswerValue.ts";

describe("JR equivalence: GeoTraceData", () => {
  // -------------------------------------------------------------------------
  // GeoTraceDataTest.java: equals_comparesPoints
  // -------------------------------------------------------------------------

  it("equals: same points produce structurally equal values (JR: equals_comparesPoints)", () => {
    const wire = "0.0 0.0 0.0 0.0;1.0 1.0 0.0 0.0";
    const a = cast("geotrace", wire);
    const b = cast("geotrace", wire);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const pa = a!.value as readonly GeoPoint[];
    const pb = b!.value as readonly GeoPoint[];
    expect(pa.length).toBe(pb.length);
    for (let i = 0; i < pa.length; i++) {
      expect(pa[i]!.lat).toBe(pb[i]!.lat);
      expect(pa[i]!.lon).toBe(pb[i]!.lon);
      expect(pa[i]!.alt).toBe(pb[i]!.alt);
      expect(pa[i]!.acc).toBe(pb[i]!.acc);
    }
  });

  it("equals: same object reference is equal to itself (JR: assertThat(data, equalTo(data)))", () => {
    const wire = "0.0 0.0 0.0 0.0;1.0 1.0 0.0 0.0";
    const a = cast("geotrace", wire);
    expect(a).not.toBeNull();
    const pts = a!.value as readonly GeoPoint[];
    expect(pts).toBe(pts);
  });

  it("equals: different points are not equal (JR: not(equalTo(data2)))", () => {
    const a = cast("geotrace", "0.0 0.0 0.0 0.0;1.0 1.0 0.0 0.0");
    const b = cast("geotrace", "0.0 0.0 0.0 0.0;2.0 2.0 0.0 0.0");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const pa = a!.value as readonly GeoPoint[];
    const pb = b!.value as readonly GeoPoint[];
    expect(pa[1]!.lat).not.toBe(pb[1]!.lat);
  });

  // -------------------------------------------------------------------------
  // GeoTraceDataTest.java: hashCode_isTheSameForTheSamePoints
  // -------------------------------------------------------------------------

  it("same points produce same displayText (JR: hashCode_isTheSameForTheSamePoints — structural identity)", () => {
    const wire = "0.0 0.0 0.0 0.0;1.0 1.0 0.0 0.0";
    const a = cast("geotrace", wire);
    const b = cast("geotrace", wire);
    expect(uncast(a!)).toBe(uncast(b!));
    expect(a!.displayText).toBe(b!.displayText);
  });

  it("different points produce different displayText (JR: not(equalTo(data2)).hashCode())", () => {
    const a = cast("geotrace", "0.0 0.0 0.0 0.0;1.0 1.0 0.0 0.0");
    const b = cast("geotrace", "0.0 0.0 0.0 0.0;2.0 2.0 0.0 0.0");
    expect(uncast(a!)).not.toBe(uncast(b!));
  });

  // -------------------------------------------------------------------------
  // GeoTraceDataTest.java: getDisplayText_returnsSemicolonSeparatedPoints
  // -------------------------------------------------------------------------

  it("getDisplayText returns semicolon-separated points with Java double format (JR: getDisplayText_returnsSemicolonSeparatedPoints)", () => {
    // JR: data = new GeoTraceData({[1,1,0,0],[2,2,0,0]})
    //     data.getDisplayText() → "1.0 1.0 0.0 0.0;2.0 2.0 0.0 0.0"
    const data = cast("geotrace", "1.0 1.0 0.0 0.0;2.0 2.0 0.0 0.0");
    expect(data).not.toBeNull();
    expect(data!.displayText).toBe("1.0 1.0 0.0 0.0;2.0 2.0 0.0 0.0");
  });

  it("displayText of integer-input points uses Java double format", () => {
    const data = cast("geotrace", "1 1 0 0;2 2 0 0");
    expect(data).not.toBeNull();
    expect(data!.displayText).toBe("1.0 1.0 0.0 0.0;2.0 2.0 0.0 0.0");
  });

  // -------------------------------------------------------------------------
  // uncast round-trip
  // -------------------------------------------------------------------------

  it("uncast round-trip produces canonical wire format (JR: uncast() → getDisplayText())", () => {
    const wire = "1.0 1.0 0.0 0.0;2.0 2.0 0.0 0.0";
    const data = cast("geotrace", wire);
    expect(data).not.toBeNull();
    expect(uncast(data!)).toBe(wire);
  });

  it("empty string → null (no geotrace)", () => {
    expect(cast("geotrace", "")).toBeNull();
  });
});
