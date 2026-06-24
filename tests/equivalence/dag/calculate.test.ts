/**
 * Equivalence tests — DAG calculate
 *
 * Sources:
 *   - reference/javarosa: TriggerableDagTest.java (order_of_the_DAG_is_ensured,
 *     and cascade-calculate variants)
 *   - reference/web-forms: calculate.test.ts (TriggerableDagTest.java,
 *     MultiplePredicateTest.java sections)
 *
 * ALL tests are `it.fails` because the reactive DAG engine (Phase 3) does not
 * exist yet.  Scenario.answer() does not trigger recalculation.
 *
 * ACTIVATION (Phase 3): remove `.fails` from each test as its slice is
 * implemented.  Each test cites its source method so the regression can be
 * traced back.
 *
 * Backlog — NOT ported here (see README at bottom of file):
 *   - jr:itext function in calculate (requires itext/translation engine)
 *   - Multiple predicates on secondary instances (requires secondary instance
 *     XPath bridge — ported to secondary-instances/ instead)
 *   - indexed-repeat XPath function (ported to repeat/indexed-repeat.test.ts)
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
  instance,
  select1,
  item,
  t,
  title,
} from "../../harness/XFormsElement.ts";
import { Scenario } from "../../harness/Scenario.ts";
import "../../harness/matchers.ts";

// ---------------------------------------------------------------------------
// Region: Basic calculate cascade
// ---------------------------------------------------------------------------

describe("Equivalence — DAG calculate cascade", () => {
  it(
    // Source: TriggerableDagTest.java#order_of_the_DAG_is_ensured
    // web-forms: calculate.test.ts "recomputes calculate expressions when their dependencies are updated"
    "cascaded calculates use upstream updated values in dependency order",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t('data id="some-form"', t("a", "2"), t("b"), t("c")),
              ),
              bind("/data/a").type("int"),
              bind("/data/b").type("int").calculate("/data/a * 3"),
              bind("/data/c").type("int").calculate("(/data/a + /data/b) * 5"),
            ),
          ),
          body(input("/data/a")),
        ),
      );

      // Initial values computed on load
      expect(scenario.answerOf("/data/a")).intAnswer(2);
      expect(scenario.answerOf("/data/b")).intAnswer(6);
      expect(scenario.answerOf("/data/c")).intAnswer(40);

      // After answering /data/a, b and c must cascade
      scenario.answer("/data/a", 3);

      expect(scenario.answerOf("/data/a")).intAnswer(3);
      expect(scenario.answerOf("/data/b")).intAnswer(9);
      // c = (3 + 9) * 5 = 60 — must use updated b, not stale b
      expect(scenario.answerOf("/data/c")).intAnswer(60);
    },
  );

  it(
    // Source: TriggerableDagTest.java (calculate with intermediate dependency)
    // web-forms: calculate.test.ts (same fixture)
    "calculate on a field that depends on another calculate is recomputed transitively",
    () => {
      // d = a + b + c  where b = a * 2, c = b * 2
      const scenario = Scenario.init(
        html(
          head(
            title("Transitive calc"),
            model(
              mainInstance(
                t('data id="transitive-calc"', t("a", "1"), t("b"), t("c"), t("d")),
              ),
              bind("/data/a").type("int"),
              bind("/data/b").type("int").calculate("/data/a * 2"),
              bind("/data/c").type("int").calculate("/data/b * 2"),
              bind("/data/d").type("int").calculate("/data/a + /data/b + /data/c"),
            ),
          ),
          body(input("/data/a")),
        ),
      );

      // Initial: a=1 → b=2 → c=4 → d=7
      expect(scenario.answerOf("/data/b")).intAnswer(2);
      expect(scenario.answerOf("/data/c")).intAnswer(4);
      expect(scenario.answerOf("/data/d")).intAnswer(7);

      // Change a=3 → b=6 → c=12 → d=21
      scenario.answer("/data/a", 3);

      expect(scenario.answerOf("/data/b")).intAnswer(6);
      expect(scenario.answerOf("/data/c")).intAnswer(12);
      expect(scenario.answerOf("/data/d")).intAnswer(21);
    },
  );

  it(
    // Source: web-forms/calculate.test.ts MultiplePredicateTest.java
    //   "support multiple predicates in one part of path"
    "calculate with multiple predicates on secondary instance returns correct value",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t('data id="some-form"', t("calc"), t("input")),
              ),
              instance(
                "instance",
                t("item", t("value", "A"), t("count", "2"), t("id", "A2")),
                t("item", t("value", "A"), t("count", "3"), t("id", "A3")),
                t("item", t("value", "B"), t("count", "2"), t("id", "B2")),
              ),
              bind("/data/calc")
                .type("string")
                .calculate("instance('instance')/root/item[value = 'A'][count = /data/input]/id"),
              bind("/data/input").type("string"),
            ),
          ),
          body(input("/data/input")),
        ),
      );

      scenario.answer("/data/input", "3");
      expect(scenario.answerOf("/data/calc")).stringAnswer("A3");

      scenario.answer("/data/input", "2");
      expect(scenario.answerOf("/data/calc")).stringAnswer("A2");

      // No match → empty string
      scenario.answer("/data/input", "7");
      expect(scenario.answerOf("/data/calc")).stringAnswer("");
    },
  );
});

/*
 * ============================================================================
 * BACKLOG — Cases NOT ported in this file
 * ============================================================================
 *
 * 1. jr:itext function in calculate
 *    Requires the itext/translation engine (not in scope for Phase 3 calculate
 *    slice).  Source: web-forms/calculate.test.ts "jr:itext function in
 *    calculate expressions".
 *
 * 2. Multiple predicates on multiple secondary-instance paths
 *    Ported to tests/equivalence/secondary-instances/calculate-predicates.test.ts
 *    because it requires the secondary instance XPath bridge.
 *
 * 3. indexed-repeat function in calculate
 *    Ported to tests/equivalence/repeat/indexed-repeat.test.ts.
 * ============================================================================
 */
