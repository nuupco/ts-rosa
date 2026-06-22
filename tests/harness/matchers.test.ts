/**
 * Tests for custom Vitest matchers (Task 5).
 *
 * These tests exercise the matchers directly against plain values/objects —
 * Scenario is not yet live, so no Scenario instance is needed here.
 *
 * Semantic contract:
 *   - stringAnswer(expected)  → received.value === expected (string equality)
 *   - intAnswer(expected)     → received.value === expected (number equality)
 *   - booleanAnswer(expected) → received.value === expected (boolean equality)
 *   - dateAnswer(expected)    → received.value.getTime() === expected.getTime()
 *   - answerText(expected)    → received.displayText === expected (display text equality)
 *   - answer(expected)        → received.value deep-equals expected.value
 *   - validForm()             → received.validate() === null
 *   - invalidForm()           → received.validate() !== null
 *   - questionWithText(text)  → received.labelText === text
 */

import { expect, describe, it } from "vitest";
import "./matchers.ts";

// ---------------------------------------------------------------------------
// AnswerData shape used by all answer matchers
// ---------------------------------------------------------------------------

interface AnswerData<T> {
  value: T;
  displayText: string;
}

function stringData(value: string): AnswerData<string> {
  return { value, displayText: value };
}

function intData(value: number): AnswerData<number> {
  return { value, displayText: String(value) };
}

function boolData(value: boolean): AnswerData<boolean> {
  return { value, displayText: String(value) };
}

function dateData(value: Date): AnswerData<Date> {
  return { value, displayText: value.toISOString() };
}

// ---------------------------------------------------------------------------
// stringAnswer
// ---------------------------------------------------------------------------

describe("stringAnswer matcher", () => {
  it("passes when string value matches", () => {
    expect(stringData("hello")).stringAnswer("hello");
  });

  it("fails when string value does not match", () => {
    expect(() => {
      expect(stringData("hello")).stringAnswer("world");
    }).toThrow();
  });

  it("supports .not", () => {
    expect(stringData("hello")).not.stringAnswer("world");
  });
});

// ---------------------------------------------------------------------------
// intAnswer
// ---------------------------------------------------------------------------

describe("intAnswer matcher", () => {
  it("passes when integer value matches", () => {
    expect(intData(42)).intAnswer(42);
  });

  it("fails when integer value does not match", () => {
    expect(() => {
      expect(intData(42)).intAnswer(7);
    }).toThrow();
  });

  it("supports .not", () => {
    expect(intData(42)).not.intAnswer(7);
  });
});

// ---------------------------------------------------------------------------
// booleanAnswer
// ---------------------------------------------------------------------------

describe("booleanAnswer matcher", () => {
  it("passes for true", () => {
    expect(boolData(true)).booleanAnswer(true);
  });

  it("passes for false", () => {
    expect(boolData(false)).booleanAnswer(false);
  });

  it("fails when boolean does not match", () => {
    expect(() => {
      expect(boolData(true)).booleanAnswer(false);
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// dateAnswer
// ---------------------------------------------------------------------------

describe("dateAnswer matcher", () => {
  it("passes when dates have the same time value", () => {
    const d = new Date("2024-01-15T00:00:00Z");
    expect(dateData(d)).dateAnswer(new Date("2024-01-15T00:00:00Z"));
  });

  it("fails when dates differ", () => {
    expect(() => {
      const d = new Date("2024-01-15T00:00:00Z");
      expect(dateData(d)).dateAnswer(new Date("2024-01-16T00:00:00Z"));
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// answerText
// ---------------------------------------------------------------------------

describe("answerText matcher", () => {
  it("passes when displayText matches", () => {
    expect(stringData("foo")).answerText("foo");
  });

  it("fails when displayText does not match", () => {
    expect(() => {
      expect(stringData("foo")).answerText("bar");
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// answer (generic value equality)
// ---------------------------------------------------------------------------

describe("answer matcher", () => {
  it("passes when values are equal", () => {
    expect(stringData("x")).answer(stringData("x"));
  });

  it("fails when values differ", () => {
    expect(() => {
      expect(stringData("x")).answer(stringData("y"));
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// validForm / invalidForm
// ---------------------------------------------------------------------------

describe("validForm / invalidForm matchers", () => {
  it("validForm passes when validate() returns null", () => {
    const form = { validate: () => null };
    expect(form).validForm();
  });

  it("invalidForm passes when validate() returns non-null", () => {
    const form = { validate: () => ({ failedPrompt: "/data/q", outcome: 2 }) };
    expect(form).invalidForm();
  });

  it("validForm fails when form is invalid", () => {
    expect(() => {
      const form = { validate: () => ({ failedPrompt: "/data/q", outcome: 2 }) };
      expect(form).validForm();
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// questionWithText
// ---------------------------------------------------------------------------

describe("questionWithText matcher", () => {
  it("passes when labelText matches", () => {
    const question = { labelText: "What is your name?" };
    expect(question).questionWithText("What is your name?");
  });

  it("fails when labelText does not match", () => {
    expect(() => {
      const question = { labelText: "What is your name?" };
      expect(question).questionWithText("Something else");
    }).toThrow();
  });
});
