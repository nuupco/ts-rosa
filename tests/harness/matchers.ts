/**
 * Custom Vitest matchers for ts-rosa test harness.
 *
 * Semantically equivalent to the JavaRosa Hamcrest matchers in:
 *   - org.javarosa.core.test.AnswerDataMatchers
 *   - org.javarosa.core.test.FormDefMatchers
 *   - org.javarosa.core.test.QuestionDefMatchers
 *
 * Registration: call `expect.extend(tsRosaMatchers)` or import this
 * module (side-effect import registers automatically via expect.extend).
 *
 * Comparison semantics:
 *   - stringAnswer  : strict string equality on .value
 *   - intAnswer     : strict number equality on .value
 *   - booleanAnswer : strict boolean equality on .value
 *   - dateAnswer    : Date equality by .getTime() on .value
 *   - answerText    : strict string equality on .displayText
 *   - answer        : deep equality on .value (mirrors JavaRosa answer(T))
 *   - validForm     : .validate() returns null (no validation errors)
 *   - invalidForm   : .validate() returns non-null
 *   - questionWithText : strict equality on .labelText
 */

import { expect } from "vitest";

// ---------------------------------------------------------------------------
// Shape interfaces (structural typing — no engine deps)
// ---------------------------------------------------------------------------

interface HasValue<T> {
  value: T;
}

interface HasDisplayText {
  displayText: string;
}

interface AnswerData<T> extends HasValue<T>, HasDisplayText {}

interface FormLike {
  validate(): unknown | null;
}

interface QuestionLike {
  labelText: string;
}

// ---------------------------------------------------------------------------
// Matcher implementations
// ---------------------------------------------------------------------------

export const tsRosaMatchers = {
  /**
   * Passes when the received object's `.value` strictly equals `expected`.
   * Mirrors JavaRosa `AnswerDataMatchers.stringAnswer(String)`.
   */
  stringAnswer(received: AnswerData<string>, expected: string) {
    const pass = received.value === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected string answer NOT to be "${expected}", but it was`
          : `Expected string answer "${expected}", but received "${received.value}" (displayText: "${received.displayText}")`,
    };
  },

  /**
   * Passes when the received object's `.value` strictly equals `expected`.
   * Mirrors JavaRosa `AnswerDataMatchers.intAnswer(int)`.
   */
  intAnswer(received: AnswerData<number>, expected: number) {
    const pass = received.value === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected int answer NOT to be ${expected}, but it was`
          : `Expected int answer ${expected}, but received ${received.value}`,
    };
  },

  /**
   * Passes when the received object's `.value` strictly equals `expected`.
   * Mirrors JavaRosa `AnswerDataMatchers.booleanAnswer(boolean)`.
   */
  booleanAnswer(received: AnswerData<boolean>, expected: boolean) {
    const pass = received.value === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected boolean answer NOT to be ${expected}, but it was`
          : `Expected boolean answer ${expected}, but received ${received.value}`,
    };
  },

  /**
   * Passes when the received object's `.value` is a Date with the same
   * millisecond timestamp as `expected`.
   * No direct JavaRosa counterpart (DateData comparison).
   */
  dateAnswer(received: AnswerData<Date>, expected: Date) {
    const pass = received.value.getTime() === expected.getTime();
    return {
      pass,
      message: () =>
        pass
          ? `Expected date answer NOT to be ${expected.toISOString()}, but it was`
          : `Expected date answer ${expected.toISOString()}, but received ${received.value.toISOString()}`,
    };
  },

  /**
   * Passes when the received object's `.displayText` equals `expected`.
   * Mirrors JavaRosa `AnswerDataMatchers.answerText(String)`.
   */
  answerText(received: HasDisplayText, expected: string) {
    const pass = received.displayText === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected display text NOT to be "${expected}", but it was`
          : `Expected display text "${expected}", but received "${received.displayText}"`,
    };
  },

  /**
   * Passes when the received object's `.value` deep-equals `expected.value`.
   * Mirrors JavaRosa `AnswerDataMatchers.answer(T)`.
   */
  answer(received: HasValue<unknown>, expected: HasValue<unknown>) {
    // Use JSON-based deep equality for plain values; handles primitives,
    // arrays, and plain objects but not Dates/RegExp. For answer data
    // in XForms context, this is sufficient — complex objects use typed matchers.
    const pass =
      JSON.stringify(received.value) === JSON.stringify(expected.value);
    return {
      pass,
      message: () =>
        pass
          ? `Expected answer value NOT to deep-equal ${JSON.stringify(expected.value)}, but it did`
          : `Expected answer value ${JSON.stringify(expected.value)}, but received ${JSON.stringify(received.value)}`,
    };
  },

  /**
   * Passes when the received form-like object's `.validate()` returns null.
   * Mirrors JavaRosa `FormDefMatchers.valid()`.
   */
  validForm(received: FormLike) {
    const result = received.validate();
    const pass = result === null;
    return {
      pass,
      message: () =>
        pass
          ? "Expected form NOT to be valid, but it was"
          : `Expected form to be valid, but validate() returned ${JSON.stringify(result)}`,
    };
  },

  /**
   * Passes when the received form-like object's `.validate()` returns non-null.
   * Inverse of validForm.
   */
  invalidForm(received: FormLike) {
    const result = received.validate();
    const pass = result !== null;
    return {
      pass,
      message: () =>
        pass
          ? "Expected form NOT to be invalid, but validate() returned null"
          : "Expected form to be invalid, but validate() returned null",
    };
  },

  /**
   * Passes when the received TreeElement-like object's `.isRelevant` is false.
   * Mirrors JavaRosa `QuestionDefMatchers.nonRelevant()`.
   */
  nonRelevant(received: { isRelevant: boolean }) {
    const pass = received.isRelevant === false;
    return {
      pass,
      message: () =>
        pass
          ? "Expected node NOT to be non-relevant, but it was"
          : `Expected node to be non-relevant, but isRelevant=${received.isRelevant}`,
    };
  },

  /**
   * Passes when the received TreeElement-like object's `.isRelevant` is true.
   * Mirrors JavaRosa `QuestionDefMatchers.relevant()`.
   */
  relevant(received: { isRelevant: boolean }) {
    const pass = received.isRelevant === true;
    return {
      pass,
      message: () =>
        pass
          ? "Expected node NOT to be relevant, but it was"
          : `Expected node to be relevant, but isRelevant=${received.isRelevant}`,
    };
  },

  /**
   * Passes when the received question-like object's `.labelText` equals `expected`.
   * Mirrors JavaRosa `QuestionDefMatchers` label checks.
   */
  questionWithText(received: QuestionLike, expected: string) {
    const pass = received.labelText === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected question label NOT to be "${expected}", but it was`
          : `Expected question label "${expected}", but received "${received.labelText}"`,
    };
  },
};

// ---------------------------------------------------------------------------
// TypeScript interface augmentation for expect().matcherName()
// ---------------------------------------------------------------------------

interface CustomMatchers<R = unknown> {
  stringAnswer(expected: string): R;
  intAnswer(expected: number): R;
  booleanAnswer(expected: boolean): R;
  dateAnswer(expected: Date): R;
  answerText(expected: string): R;
  answer(expected: HasValue<unknown>): R;
  validForm(): R;
  invalidForm(): R;
  questionWithText(expected: string): R;
  nonRelevant(): R;
  relevant(): R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

// ---------------------------------------------------------------------------
// Auto-register on import (side-effect)
// ---------------------------------------------------------------------------

expect.extend(tsRosaMatchers);
