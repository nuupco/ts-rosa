/**
 * Equivalence tests — repeat groups (create, remove, calculate cascade)
 *
 * Sources:
 *   - reference/javarosa: TriggerableDagTest.java (//region Adding or deleting repeats)
 *   - reference/web-forms: repeat.test.ts (Tests ported from JavaRosa - repeats)
 *
 * ALL tests are `it.fails` — Scenario.createNewRepeat(), removeRepeat(), and
 * next() throw "not implemented".
 *
 * ACTIVATION (Phase 3): remove `.fails` as repeat management slices are
 * implemented.  Each test cites its source.
 *
 * Backlog — NOT ported (see bottom of file).
 */

import { describe, it, expect } from "vitest";
import {
  html,
  head,
  body,
  model,
  mainInstance,
  bind,
  input,
  repeat,
  t,
  title,
} from "../../harness/XFormsElement.ts";
import { Scenario } from "../../harness/Scenario.ts";
import "../../harness/matchers.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mirrors web-forms range() helper: [startInclusive, endExclusive) */
function range(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => i + start);
}

// ---------------------------------------------------------------------------
// Region: Adding a repeat instance — calculate cascade
// ---------------------------------------------------------------------------

describe("Equivalence — repeat: adding instances updates calculate cascade", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 createNewRepeat + calculate DAG is implemented
    // Source: TriggerableDagTest.java#addingRepeatInstance_updatesCalculationCascade (L785)
    // web-forms: repeat.test.ts "updates calculation cascade"
    "adding a repeat instance triggers the inner calculate cascade",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Add repeat instance"),
            model(
              mainInstance(
                t(
                  'data id="repeat-calcs"',
                  t("repeat", t("inner1"), t("inner2"), t("inner3")),
                ),
              ),
              bind("/data/repeat/inner2").calculate("2 * ../inner1"),
              bind("/data/repeat/inner3").calculate("2 * ../inner2"),
            ),
          ),
          body(
            repeat("/data/repeat", input("/data/repeat/inner1")),
          ),
        ),
      );

      scenario.next("/data/repeat[1]");
      scenario.next("/data/repeat[1]/inner1");
      scenario.answer(0);

      expect(scenario.answerOf("/data/repeat[1]/inner2")).intAnswer(0);
      expect(scenario.answerOf("/data/repeat[1]/inner3")).intAnswer(0);

      scenario.next("/data/repeat");
      scenario.createNewRepeat("/data/repeat");
      scenario.next("/data/repeat[2]/inner1");

      scenario.answer(1);

      expect(scenario.answerOf("/data/repeat[2]/inner2")).intAnswer(2);
      expect(scenario.answerOf("/data/repeat[2]/inner3")).intAnswer(4);
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Count outside repeat used inside
// ---------------------------------------------------------------------------

describe("Equivalence — repeat: count outside repeat propagates inside", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 repeat count calculate is implemented
    // Source: TriggerableDagTest.java#addingOrRemovingRepeatInstance_updatesReferenceToCountInside
    // web-forms: repeat.test.ts "updates reference to count inside"
    "count(/data/repeat) outside is propagated to inner-count after add and remove",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Count outside repeat used inside"),
            model(
              mainInstance(
                t(
                  'data id="outside-used-inside"',
                  t("count"),
                  t('repeat jr:template=""', t("question"), t("inner-count")),
                ),
              ),
              bind("/data/count").type("int").calculate("count(/data/repeat)"),
              bind("/data/repeat/inner-count").type("int").calculate("/data/count"),
            ),
          ),
          body(repeat("/data/repeat", input("/data/repeat/question"))),
        ),
      );

      range(1, 6).forEach((n) => {
        scenario.next("/data/repeat");
        scenario.createNewRepeat("/data/repeat");

        expect(scenario.answerOf("/data/count")).intAnswer(n);

        scenario.next(`/data/repeat[${n}]/question`);
      });

      range(1, 6).forEach((n) => {
        expect(scenario.answerOf(`/data/repeat[${n}]/inner-count`)).intAnswer(5);
      });

      scenario.removeRepeat("/data/repeat[5]");

      range(1, 5).forEach((n) => {
        expect(scenario.answerOf(`/data/repeat[${n}]/inner-count`)).intAnswer(4);
      });
    },
  );

  it.fails(
    // ACTIVATE: remove .fails when Phase 3 repeat count is implemented
    // Source: TriggerableDagTest.java#addingOrRemovingRepeatInstance_updatesRepeatCount_insideAndOutsideRepeat
    // web-forms: repeat.test.ts "updates repeat count, inside and outside repeat"
    "count(/data/repeat) is updated inside and outside repeat on add and remove",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Count outside repeat used inside"),
            model(
              mainInstance(
                t(
                  'data id="outside-used-inside"',
                  t("count"),
                  t('repeat jr:template=""', t("question"), t("inner-count")),
                ),
              ),
              bind("/data/count").type("int").calculate("count(/data/repeat)"),
              bind("/data/repeat/inner-count")
                .type("int")
                .calculate("count(/data/repeat)"),
            ),
          ),
          body(repeat("/data/repeat", input("/data/repeat/question"))),
        ),
      );

      range(1, 6).forEach((n) => {
        scenario.next("/data/repeat");
        scenario.createNewRepeat("/data/repeat");

        expect(scenario.answerOf(`/data/repeat[${n}]/inner-count`)).intAnswer(n);

        scenario.next(`/data/repeat[${n}]/question`);
      });

      range(1, 6).forEach((n) => {
        expect(scenario.answerOf(`/data/repeat[${n}]/inner-count`)).intAnswer(5);
      });

      scenario.removeRepeat("/data/repeat[5]");

      range(1, 5).forEach((n) => {
        expect(scenario.answerOf(`/data/repeat[${n}]/inner-count`)).intAnswer(4);
      });
    },
  );
});

// ---------------------------------------------------------------------------
// Region: countRepeatInstancesOf
// ---------------------------------------------------------------------------

describe("Equivalence — repeat: countRepeatInstancesOf", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 countRepeatInstancesOf is implemented
    // Source: TriggerableDagTest.java (repeat count assertions)
    "countRepeatInstancesOf returns the correct count after adding instances",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Repeat count"),
            model(
              mainInstance(
                t('data id="repeat-count"', t("rep", t("val"))),
              ),
            ),
          ),
          body(repeat("/data/rep", input("/data/rep/val"))),
        ),
      );

      // One template instance by default
      expect(scenario.countRepeatInstancesOf("/data/rep")).toBe(1);

      scenario.createNewRepeat("/data/rep");
      expect(scenario.countRepeatInstancesOf("/data/rep")).toBe(2);

      scenario.createNewRepeat("/data/rep");
      expect(scenario.countRepeatInstancesOf("/data/rep")).toBe(3);

      scenario.removeRepeat("/data/rep[2]");
      expect(scenario.countRepeatInstancesOf("/data/rep")).toBe(2);
    },
  );
});

/*
 * ============================================================================
 * BACKLOG — Cases NOT ported in this file
 * ============================================================================
 *
 * 1. Absolute path in repeat calculate (known JavaRosa legacy behavior, not
 *    aligned with web-forms).
 *    Source: web-forms/repeat.test.ts "(absolute path, from JavaRosa)" — marked
 *    it.fails in web-forms itself.  Will be revisited per ODK alignment decision.
 *
 * 2. Repeat count inside repeat only (absolute vs relative semantics)
 *    Source: web-forms/repeat.test.ts "updates repeat count, inside repeat"
 *    Deferred pending context-aware XPath evaluation in repeats.
 *
 * 3. Nested repeats and outer sum
 *    Source: web-forms/repeat.test.ts "with reference to repeat in repeat, and outer sum"
 *    Requires nested repeat support — Phase 3+ scope.
 *
 * 4. jr:count / minCount / maxCount repeat constraints
 *    Requires additional bind attribute parsing — separate Phase 3 slice.
 *
 * 5. Repeat template (jr:template="") removal semantics
 *    Out of scope for initial repeat management slice.
 * ============================================================================
 */
