/**
 * codecs-extended.test.ts
 *
 * Tests for cast/uncast and convenience constructors for the four new kinds:
 *   long, geoshape, geotrace, uncast
 *
 * Written FIRST (RED phase) per strict TDD protocol.
 */
import { describe, it, expect } from "vitest";
import { cast, uncast } from "../../../src/model/data/codecs.ts";

describe("codecs — extended kinds", () => {
  // -------------------------------------------------------------------------
  // long
  // -------------------------------------------------------------------------
  describe("long", () => {
    it("cast('long', '42') → kind:long, value:42", () => {
      const v = cast("long", "42");
      expect(v).not.toBeNull();
      expect(v!.kind).toBe("long");
      expect(v!.value).toBe(42);
      expect(v!.displayText).toBe("42");
    });

    it("cast('long', '9007199254740991') → value equals Number.MAX_SAFE_INTEGER", () => {
      const v = cast("long", "9007199254740991");
      expect(v).not.toBeNull();
      expect(v!.value).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("cast('long', '') → null", () => {
      expect(cast("long", "")).toBeNull();
    });

    it("cast('long', 'abc') → null (NaN guard)", () => {
      expect(cast("long", "abc")).toBeNull();
    });

    it("round-trip: uncast(cast('long','123')) === '123'", () => {
      const v = cast("long", "123")!;
      expect(uncast(v)).toBe("123");
    });
  });

  // -------------------------------------------------------------------------
  // geoshape
  // -------------------------------------------------------------------------
  describe("geoshape", () => {
    const raw = "0 0 0 0;1 1 0 0;0 1 0 0";

    it("cast('geoshape', raw) → kind:geoshape with 3 points", () => {
      const v = cast("geoshape", raw);
      expect(v).not.toBeNull();
      expect(v!.kind).toBe("geoshape");
      // @ts-expect-error — narrowing value access via kind not statically safe here
      expect(v!.value.length).toBe(3);
    });

    it("cast('geoshape', raw) first point is {lat:0,lon:0,alt:0,acc:0}", () => {
      const v = cast("geoshape", raw)!;
      // @ts-expect-error — value is readonly GeoPoint[]
      expect(v.value[0]).toEqual({ lat: 0, lon: 0, alt: 0, acc: 0 });
    });

    it("round-trip: uncast(cast('geoshape', raw)) === raw", () => {
      const v = cast("geoshape", raw)!;
      expect(uncast(v)).toBe(raw);
    });

    it("cast('geoshape', '') → null", () => {
      expect(cast("geoshape", "")).toBeNull();
    });

    it("displayText equals the semicolon-separated raw format", () => {
      const v = cast("geoshape", raw)!;
      expect(v.displayText).toBe(raw);
    });
  });

  // -------------------------------------------------------------------------
  // geotrace
  // -------------------------------------------------------------------------
  describe("geotrace", () => {
    const raw = "10 20 5 1;11 21 5 1";

    it("cast('geotrace', raw) → kind:geotrace with 2 points", () => {
      const v = cast("geotrace", raw);
      expect(v).not.toBeNull();
      expect(v!.kind).toBe("geotrace");
      // @ts-expect-error — value is readonly GeoPoint[]
      expect(v!.value.length).toBe(2);
    });

    it("round-trip: uncast(cast('geotrace', raw)) === raw", () => {
      const v = cast("geotrace", raw)!;
      expect(uncast(v)).toBe(raw);
    });

    it("cast('geotrace', '') → null", () => {
      expect(cast("geotrace", "")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // uncast
  // -------------------------------------------------------------------------
  describe("uncast kind", () => {
    it("cast('uncast', 'raw-text') → kind:uncast, value:'raw-text'", () => {
      const v = cast("uncast", "raw-text");
      expect(v).not.toBeNull();
      expect(v!.kind).toBe("uncast");
      expect(v!.value).toBe("raw-text");
      expect(v!.displayText).toBe("raw-text");
    });

    it("cast('uncast', '') → kind:uncast, value:'' (empty string is valid for uncast)", () => {
      // uncast is a raw passthrough — empty string is meaningful (no-answer is null
      // only for typed data; uncast stores the raw value as-is)
      const v = cast("uncast", "");
      expect(v).not.toBeNull();
      expect(v!.kind).toBe("uncast");
      expect(v!.value).toBe("");
    });

    it("round-trip: uncast(cast('uncast', 'hello')) === 'hello'", () => {
      const v = cast("uncast", "hello")!;
      expect(uncast(v)).toBe("hello");
    });
  });
});
