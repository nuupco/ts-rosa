import { describe, it, expect } from "vitest";
import {
  cast, uncast,
  stringValue, intValue, decimalValue, booleanValue,
  dateValue, selectOneValue, selectMultiValue,
} from "../../../src/model/data/codecs.ts";

describe("codecs: cast", () => {
  it("cast('string', 'hello') → {kind:'string', value:'hello', displayText:'hello'}", () => {
    const v = cast("string", "hello");
    expect(v).not.toBeNull();
    expect(v!.kind).toBe("string");
    expect(v!.value).toBe("hello");
    expect(v!.displayText).toBe("hello");
  });

  it("cast('int', '7') → value 7", () => {
    const v = cast("int", "7");
    expect(v!.kind).toBe("int");
    expect(v!.value).toBe(7);
    expect(v!.displayText).toBe("7");
  });

  it("cast('decimal', '3.14') → value 3.14", () => {
    const v = cast("decimal", "3.14");
    expect(v!.kind).toBe("decimal");
    expect((v!.value as number)).toBeCloseTo(3.14);
  });

  // JavaRosa BooleanData.cast(): "1" → true, "0" → false (NOT "true"/"false")
  it("cast('boolean', '1') → value true", () => {
    const v = cast("boolean", "1");
    expect(v!.kind).toBe("boolean");
    expect(v!.value).toBe(true);
  });

  it("cast('boolean', '0') → value false", () => {
    const v = cast("boolean", "0");
    expect(v!.value).toBe(false);
  });

  it("cast('boolean', 'true') → null (JavaRosa only accepts '1'/'0')", () => {
    expect(cast("boolean", "true")).toBeNull();
  });

  it("cast('date', '2024-03-15') → Date UTC midnight", () => {
    const v = cast("date", "2024-03-15");
    expect(v!.kind).toBe("date");
    const d = v!.value as Date;
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toBe("2024-03-15T00:00:00.000Z");
    expect(v!.displayText).toBe("2024-03-15");
  });

  it("cast('dateTime', '2024-03-15T10:00:00Z') → Date", () => {
    const v = cast("dateTime", "2024-03-15T10:00:00Z");
    expect(v!.kind).toBe("dateTime");
    expect(v!.value).toBeInstanceOf(Date);
    expect(v!.displayText).toBe("2024-03-15T10:00:00.000Z");
  });

  it("cast('selectOne', 'choice-a') → value 'choice-a'", () => {
    const v = cast("selectOne", "choice-a");
    expect(v!.kind).toBe("selectOne");
    expect(v!.value).toBe("choice-a");
  });

  it("cast('selectMulti', 'a b') → value ['a','b']", () => {
    const v = cast("selectMulti", "a b");
    expect(v!.kind).toBe("selectMulti");
    expect(v!.value).toEqual(["a", "b"]);
    expect(v!.displayText).toBe("a b");
  });

  it("cast('unsupported', 'raw-str') → value 'raw-str'", () => {
    const v = cast("unsupported", "raw-str");
    expect(v!.kind).toBe("unsupported");
    expect(v!.value).toBe("raw-str");
    expect(v!.displayText).toBe("raw-str");
  });

  it("cast('int', '') → null (empty = no answer)", () => {
    expect(cast("int", "")).toBeNull();
  });

  it("cast('date', '') → null", () => {
    expect(cast("date", "")).toBeNull();
  });

  it("cast('boolean', '') → null", () => {
    expect(cast("boolean", "")).toBeNull();
  });

  it("cast('decimal', '') → null", () => {
    expect(cast("decimal", "")).toBeNull();
  });

  it("cast('selectMulti', '') → null", () => {
    expect(cast("selectMulti", "")).toBeNull();
  });
});

describe("codecs: uncast", () => {
  it("uncast(cast('string', 'hello')) round-trip", () => {
    expect(uncast(cast("string", "hello")!)).toBe("hello");
  });

  it("uncast(cast('int', '7')) round-trip", () => {
    expect(uncast(cast("int", "7")!)).toBe("7");
  });

  it("uncast(cast('decimal', '3.14')) round-trip", () => {
    expect(uncast(cast("decimal", "3.14")!)).toBe("3.14");
  });

  // JavaRosa BooleanData.uncast() → "1" | "0"
  it("uncast(cast('boolean', '1')) round-trip → \"1\"", () => {
    expect(uncast(cast("boolean", "1")!)).toBe("1");
  });

  it("uncast(cast('boolean', '0')) round-trip → \"0\"", () => {
    expect(uncast(cast("boolean", "0")!)).toBe("0");
  });

  it("uncast(cast('date', '2024-03-15')) round-trip", () => {
    expect(uncast(cast("date", "2024-03-15")!)).toBe("2024-03-15");
  });

  it("uncast(cast('dateTime', '2024-03-15T10:00:00.000Z')) round-trip", () => {
    expect(uncast(cast("dateTime", "2024-03-15T10:00:00.000Z")!)).toBe("2024-03-15T10:00:00.000Z");
  });

  it("uncast(cast('selectOne', 'choice-a')) round-trip", () => {
    expect(uncast(cast("selectOne", "choice-a")!)).toBe("choice-a");
  });

  it("uncast(cast('selectMulti', 'a b')) round-trip → 'a b'", () => {
    expect(uncast(cast("selectMulti", "a b")!)).toBe("a b");
  });

  it("uncast of unsupported variant", () => {
    const v = cast("unsupported", "raw-str")!;
    expect(uncast(v)).toBe("raw-str");
  });
});

describe("codecs: convenience constructors", () => {
  it("stringValue('hello')", () => {
    const v = stringValue("hello");
    expect(v.kind).toBe("string");
    expect(v.value).toBe("hello");
    expect(v.displayText).toBe("hello");
  });

  it("intValue(42)", () => {
    const v = intValue(42);
    expect(v.kind).toBe("int");
    expect(v.value).toBe(42);
    expect(v.displayText).toBe("42");
  });

  it("decimalValue(1.5)", () => {
    const v = decimalValue(1.5);
    expect(v.kind).toBe("decimal");
    expect(v.value).toBe(1.5);
  });

  it("booleanValue(true)", () => {
    const v = booleanValue(true);
    expect(v.kind).toBe("boolean");
    expect(v.value).toBe(true);
    // JavaRosa BooleanData.getDisplayText() → "True" (capital T)
    expect(v.displayText).toBe("True");
  });

  it("dateValue(date)", () => {
    const d = new Date("2024-01-01T00:00:00Z");
    const v = dateValue(d);
    expect(v.kind).toBe("date");
    // Defensive copy: value has same time but is a different reference
    expect(v.value).toStrictEqual(d);
    expect(v.displayText).toBe("2024-01-01");
  });

  it("selectOneValue('token')", () => {
    const v = selectOneValue("token");
    expect(v.kind).toBe("selectOne");
    expect(v.value).toBe("token");
    expect(v.displayText).toBe("token");
  });

  it("selectMultiValue(['a','b'])", () => {
    const v = selectMultiValue(["a", "b"]);
    expect(v.kind).toBe("selectMulti");
    expect(v.value).toEqual(["a", "b"]);
    expect(v.displayText).toBe("a b");
  });
});
