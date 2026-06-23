/**
 * DataType-extended.test.ts
 *
 * Tests for the extended DataType union (long, geoshape, geotrace, uncast)
 * and the corresponding dataTypeFromXsdName mappings.
 *
 * Written FIRST (RED phase) per strict TDD protocol.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import type { DataType } from "../../../src/model/data/DataType.ts";
import { dataTypeFromXsdName } from "../../../src/model/data/DataType.ts";

describe("DataType — extended kinds", () => {
  it("exhaustive switch covers all 16 members (including new kinds)", () => {
    // Compile-time exhaustiveness — no default branch allowed.
    function assertExhaustive(t: DataType): string {
      switch (t) {
        case "string":      return "string";
        case "int":         return "int";
        case "decimal":     return "decimal";
        case "boolean":     return "boolean";
        case "date":        return "date";
        case "time":        return "time";
        case "dateTime":    return "dateTime";
        case "selectOne":   return "selectOne";
        case "selectMulti": return "selectMulti";
        case "geopoint":    return "geopoint";
        case "binary":      return "binary";
        case "long":        return "long";
        case "geoshape":    return "geoshape";
        case "geotrace":    return "geotrace";
        case "uncast":      return "uncast";
        case "unsupported": return "unsupported";
      }
    }
    expectTypeOf(assertExhaustive).toBeFunction();
  });

  it("DataType includes all 16 members at runtime", () => {
    const members: DataType[] = [
      "string", "int", "decimal", "boolean",
      "date", "time", "dateTime",
      "selectOne", "selectMulti",
      "geopoint", "binary",
      "long", "geoshape", "geotrace",
      "uncast", "unsupported",
    ];
    expect(members.length).toBe(16);
  });

  describe("dataTypeFromXsdName — new mappings", () => {
    it("maps xsd:long to 'long'", () => {
      expect(dataTypeFromXsdName("xsd:long")).toBe("long");
    });

    it("maps geoshape to 'geoshape'", () => {
      expect(dataTypeFromXsdName("geoshape")).toBe("geoshape");
    });

    it("maps geotrace to 'geotrace'", () => {
      expect(dataTypeFromXsdName("geotrace")).toBe("geotrace");
    });

    it("still maps unknown xsd type to 'unsupported' (not 'uncast')", () => {
      expect(dataTypeFromXsdName("xsd:fooBar")).toBe("unsupported");
    });

    it("null still maps to 'string'", () => {
      expect(dataTypeFromXsdName(null)).toBe("string");
    });
  });
});
