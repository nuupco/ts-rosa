import { describe, it, expectTypeOf } from "vitest";
import type { DataType } from "../../../src/model/data/DataType.ts";
import { dataTypeFromXsdName } from "../../../src/model/data/DataType.ts";

describe("DataType", () => {
  it("exhaustive switch compiles — every member is covered", () => {
    // This is a compile-time test: the function below must compile with no
    // default case. If any member is missing from the union the switch becomes
    // non-exhaustive and TypeScript emits an error.
    function assertExhaustive(t: DataType): string {
      switch (t) {
        case "string":    return "string";
        case "int":       return "int";
        case "decimal":   return "decimal";
        case "boolean":   return "boolean";
        case "date":      return "date";
        case "time":      return "time";
        case "dateTime":  return "dateTime";
        case "selectOne": return "selectOne";
        case "selectMulti": return "selectMulti";
        case "geopoint":  return "geopoint";
        case "binary":    return "binary";
        case "unsupported": return "unsupported";
      }
    }
    // The function must be used so TS doesn't prune it
    expectTypeOf(assertExhaustive).toBeFunction();
  });

  it("DataType includes every required member", () => {
    // Runtime-level confirmation: each literal is assignable to DataType.
    const members: DataType[] = [
      "string", "int", "decimal", "boolean",
      "date", "time", "dateTime",
      "selectOne", "selectMulti",
      "geopoint", "binary", "unsupported",
    ];
    // All 12 members present
    expect(members.length).toBe(12);
  });

  describe("dataTypeFromXsdName", () => {
    it("maps xsd:string to 'string'", () => {
      expect(dataTypeFromXsdName("xsd:string")).toBe("string");
    });
    it("maps xsd:int to 'int'", () => {
      expect(dataTypeFromXsdName("xsd:int")).toBe("int");
    });
    it("maps xsd:integer to 'int'", () => {
      expect(dataTypeFromXsdName("xsd:integer")).toBe("int");
    });
    it("maps xsd:decimal to 'decimal'", () => {
      expect(dataTypeFromXsdName("xsd:decimal")).toBe("decimal");
    });
    it("maps xsd:boolean to 'boolean'", () => {
      expect(dataTypeFromXsdName("xsd:boolean")).toBe("boolean");
    });
    it("maps xsd:date to 'date'", () => {
      expect(dataTypeFromXsdName("xsd:date")).toBe("date");
    });
    it("maps xsd:time to 'time'", () => {
      expect(dataTypeFromXsdName("xsd:time")).toBe("time");
    });
    it("maps xsd:dateTime to 'dateTime'", () => {
      expect(dataTypeFromXsdName("xsd:dateTime")).toBe("dateTime");
    });
    it("maps select1 to 'selectOne'", () => {
      expect(dataTypeFromXsdName("select1")).toBe("selectOne");
    });
    it("maps select to 'selectMulti'", () => {
      expect(dataTypeFromXsdName("select")).toBe("selectMulti");
    });
    it("maps geopoint to 'geopoint'", () => {
      expect(dataTypeFromXsdName("geopoint")).toBe("geopoint");
    });
    it("maps binary to 'binary'", () => {
      expect(dataTypeFromXsdName("binary")).toBe("binary");
    });
    it("maps null to 'string' (default)", () => {
      expect(dataTypeFromXsdName(null)).toBe("string");
    });
    it("maps empty string to 'string'", () => {
      expect(dataTypeFromXsdName("")).toBe("string");
    });
    it("maps unknown xsd type to 'unsupported'", () => {
      expect(dataTypeFromXsdName("xsd:fooBar")).toBe("unsupported");
    });
  });
});

// bring in expect for runtime assertions
import { expect } from "vitest";
