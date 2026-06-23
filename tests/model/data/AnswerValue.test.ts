import { describe, it, expect, expectTypeOf } from "vitest";
import type { AnswerValue, GeoPoint, SelectChoiceRef } from "../../../src/model/data/AnswerValue.ts";

describe("AnswerValue discriminated union", () => {
  it("string variant: kind, value, displayText", () => {
    const v: AnswerValue = { kind: "string", value: "hello", displayText: "hello" };
    expect(v.kind).toBe("string");
    expect(v.value).toBe("hello");
    expect(v.displayText).toBe("hello");
  });

  it("int variant: kind, value, displayText", () => {
    const v: AnswerValue = { kind: "int", value: 42, displayText: "42" };
    expect(v.kind).toBe("int");
    expect(v.value).toBe(42);
    expect(v.displayText).toBe("42");
  });

  it("decimal variant", () => {
    const v: AnswerValue = { kind: "decimal", value: 3.14, displayText: "3.14" };
    expect(v.kind).toBe("decimal");
    expect(v.value).toBe(3.14);
  });

  it("boolean variant: true", () => {
    const v: AnswerValue = { kind: "boolean", value: true, displayText: "true" };
    expect(v.kind).toBe("boolean");
    expect(v.value).toBe(true);
    expect(v.displayText).toBe("true");
  });

  it("date variant: value is a Date, displayText is YYYY-MM-DD", () => {
    const d = new Date("2024-03-15T00:00:00Z");
    const v: AnswerValue = { kind: "date", value: d, displayText: "2024-03-15" };
    expect(v.kind).toBe("date");
    expect(v.value).toBeInstanceOf(Date);
    expect(v.displayText).toBe("2024-03-15");
  });

  it("time variant: value is a Date", () => {
    const d = new Date("1970-01-01T10:30:00Z");
    const v: AnswerValue = { kind: "time", value: d, displayText: "10:30:00" };
    expect(v.kind).toBe("time");
    expect(v.value).toBeInstanceOf(Date);
  });

  it("dateTime variant: displayText is ISO string", () => {
    const d = new Date("2024-03-15T10:00:00.000Z");
    const v: AnswerValue = { kind: "dateTime", value: d, displayText: d.toISOString() };
    expect(v.kind).toBe("dateTime");
    expect(v.displayText).toBe("2024-03-15T10:00:00.000Z");
  });

  it("selectOne variant: value is string", () => {
    const v: AnswerValue = { kind: "selectOne", value: "choice-a", displayText: "choice-a" };
    expect(v.kind).toBe("selectOne");
    expect(v.value).toBe("choice-a");
  });

  it("selectMulti variant: value is string[], displayText is space-joined", () => {
    const v: AnswerValue = { kind: "selectMulti", value: ["a", "b"], displayText: "a b" };
    expect(v.kind).toBe("selectMulti");
    expect(v.value).toEqual(["a", "b"]);
    expect(v.displayText).toBe("a b");
  });

  it("geopoint variant: value is GeoPoint", () => {
    const gp: GeoPoint = { lat: 1.0, lon: 2.0, alt: 3.0, acc: 4.0 };
    const v: AnswerValue = { kind: "geopoint", value: gp, displayText: "1.0 2.0 3.0 4.0" };
    expect(v.kind).toBe("geopoint");
    expect(v.value).toEqual({ lat: 1.0, lon: 2.0, alt: 3.0, acc: 4.0 });
  });

  it("binary variant: value is string (filename/ref)", () => {
    const v: AnswerValue = { kind: "binary", value: "file.jpg", displayText: "file.jpg" };
    expect(v.kind).toBe("binary");
    expect(v.value).toBe("file.jpg");
  });

  it("unsupported variant: value is raw string", () => {
    const v: AnswerValue = { kind: "unsupported", value: "raw", displayText: "raw" };
    expect(v.kind).toBe("unsupported");
    expect(v.value).toBe("raw");
    expect(v.displayText).toBe("raw");
  });

  it("exhaustive switch compiles — all kinds covered", () => {
    function assertExhaustive(v: AnswerValue): string {
      switch (v.kind) {
        case "string":      return v.value;
        case "int":         return String(v.value);
        case "decimal":     return String(v.value);
        case "boolean":     return String(v.value);
        case "date":        return v.displayText;
        case "time":        return v.displayText;
        case "dateTime":    return v.displayText;
        case "selectOne":   return v.value;
        case "selectMulti": return v.value.join(" ");
        case "geopoint":    return v.displayText;
        case "binary":      return v.value;
        case "long":        return String(v.value);
        case "geoshape":    return v.displayText;
        case "geotrace":    return v.displayText;
        case "uncast":      return v.value;
        case "unsupported": return v.value;
      }
    }
    expectTypeOf(assertExhaustive).toBeFunction();
  });

  it("SelectChoiceRef is a string type alias", () => {
    const ref: SelectChoiceRef = "choice-token";
    expect(typeof ref).toBe("string");
  });

  it("GeoPoint has lat, lon, alt, acc fields", () => {
    const gp: GeoPoint = { lat: 10, lon: 20, alt: 30, acc: 5 };
    expect(gp.lat).toBe(10);
    expect(gp.lon).toBe(20);
    expect(gp.alt).toBe(30);
    expect(gp.acc).toBe(5);
  });
});
