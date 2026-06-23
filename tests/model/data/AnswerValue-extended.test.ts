/**
 * AnswerValue-extended.test.ts
 *
 * Tests for the four new AnswerValue variants:
 *   long, geoshape, geotrace, uncast
 *
 * Written FIRST (RED phase) per strict TDD protocol.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import type { AnswerValue, GeoPoint } from "../../../src/model/data/AnswerValue.ts";

describe("AnswerValue — extended variants", () => {
  it("exhaustive switch compiles over all 16 variants (including new kinds)", () => {
    function assertExhaustive(v: AnswerValue): string {
      switch (v.kind) {
        case "string":      return v.value;
        case "int":         return String(v.value);
        case "decimal":     return String(v.value);
        case "boolean":     return String(v.value);
        case "date":        return v.value.toISOString();
        case "time":        return v.value.toISOString();
        case "dateTime":    return v.value.toISOString();
        case "selectOne":   return v.value;
        case "selectMulti": return v.value.join(" ");
        case "geopoint":    return `${v.value.lat} ${v.value.lon}`;
        case "binary":      return v.value;
        case "long":        return String(v.value);
        case "geoshape":    return v.value.map(p => `${p.lat} ${p.lon}`).join(";");
        case "geotrace":    return v.value.map(p => `${p.lat} ${p.lon}`).join(";");
        case "uncast":      return v.value;
        case "unsupported": return v.value;
      }
    }
    expectTypeOf(assertExhaustive).toBeFunction();
  });

  describe("long variant", () => {
    it("holds a number value", () => {
      const v: AnswerValue = { kind: "long", value: 1234567890, displayText: "1234567890" };
      expect(v.kind).toBe("long");
      expect(v.value).toBe(1234567890);
      expect(v.displayText).toBe("1234567890");
    });

    it("value type is number (not bigint)", () => {
      const v: AnswerValue = { kind: "long", value: 42, displayText: "42" };
      // JS number — consistent with int/decimal
      expect(typeof v.value).toBe("number");
    });
  });

  describe("geoshape variant", () => {
    it("holds a readonly GeoPoint array (polygon)", () => {
      const pts: readonly GeoPoint[] = [
        { lat: 0, lon: 0, alt: 0, acc: 0 },
        { lat: 1, lon: 1, alt: 0, acc: 0 },
        { lat: 0, lon: 1, alt: 0, acc: 0 },
      ];
      const v: AnswerValue = { kind: "geoshape", value: pts, displayText: "0 0 0 0;1 1 0 0;0 1 0 0" };
      expect(v.kind).toBe("geoshape");
      expect(v.value.length).toBe(3);
      expect(v.value[0]).toEqual({ lat: 0, lon: 0, alt: 0, acc: 0 });
    });
  });

  describe("geotrace variant", () => {
    it("holds a readonly GeoPoint array (trace/line)", () => {
      const pts: readonly GeoPoint[] = [
        { lat: 10, lon: 20, alt: 5, acc: 1 },
        { lat: 11, lon: 21, alt: 5, acc: 1 },
      ];
      const v: AnswerValue = { kind: "geotrace", value: pts, displayText: "10 20 5 1;11 21 5 1" };
      expect(v.kind).toBe("geotrace");
      expect(v.value.length).toBe(2);
      expect(v.value[1]).toEqual({ lat: 11, lon: 21, alt: 5, acc: 1 });
    });
  });

  describe("uncast variant", () => {
    it("holds a raw string (no-type intermediary)", () => {
      const v: AnswerValue = { kind: "uncast", value: "raw-text", displayText: "raw-text" };
      expect(v.kind).toBe("uncast");
      expect(v.value).toBe("raw-text");
      expect(v.displayText).toBe("raw-text");
    });
  });
});
