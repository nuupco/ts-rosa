/**
 * Equivalence tests — secondary instances in calculate expressions
 *
 * Sources:
 *   - reference/javarosa: PredicateCachingTest.java (equivalence predicate tests)
 *   - reference/web-forms: secondary-instances.test.ts (inline DSL variants),
 *                          calculate.test.ts MultiplePredicateTest.java section
 *
 * All tests were promoted from `it.fails` to plain `it()` and are GREEN as of
 * Phase 5 slice 5b (commit 1361c42), which implemented the instance() XPath
 * function and secondary instance loading.
 *
 * NOTE: Tests using external XML fixture files (two-secondary-instances.xml,
 * repeat-secondary-instance.xml) are NOT ported here because the file-loading
 * path is not yet available and those fixtures would need to be created.
 * They are documented in the backlog below.
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
  instance,
  bind,
  input,
  t,
  title,
} from "../../harness/XFormsElement.ts";
import { Scenario } from "../../harness/Scenario.ts";
import "../../harness/matchers.ts";

// ---------------------------------------------------------------------------
// Region: Multiple predicates on secondary instance
// ---------------------------------------------------------------------------

describe("Equivalence — secondary instances: multiple predicates in calculate", () => {
  it(
    // Source: web-forms/calculate.test.ts MultiplePredicateTest.java
    //   "support multiple predicates in one part of path"
    "calculate with two predicates on single path segment returns the matching item id",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Multiple predicate test"),
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
                .calculate(
                  "instance('instance')/root/item[value = 'A'][count = /data/input]/id",
                ),
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

  it(
    // Source: web-forms/calculate.test.ts MultiplePredicateTest.java
    //   "support multiple predicates in multiple parts of path"
    "calculate with predicates on multiple path segments returns the correct count",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Multiple predicate multi-segment test"),
            model(
              mainInstance(
                t('data id="some-form"', t("calc"), t("input")),
              ),
              instance(
                "instance",
                t(
                  "item",
                  t("name", "Bob Smith"),
                  t("yob", "1966"),
                  t("child", t("name", "Sally Smith"), t("yob", "1988")),
                  t("child", t("name", "Kwame Smith"), t("yob", "1990")),
                ),
                t(
                  "item",
                  t("name", "Hu Xao"),
                  t("yob", "1972"),
                  t("child", t("name", "Foo Bar"), t("yob", "1988")),
                  t("child", t("name", "Foo2 Bar"), t("yob", "2008")),
                ),
                t(
                  "item",
                  t("name", "Baz Quux"),
                  t("yob", "1968"),
                  t("child", t("name", "Baz2 Quux"), t("yob", "1988")),
                  t("child", t("name", "Baz3 Quux"), t("yob", "1988")),
                ),
              ),
              bind("/data/calc")
                .type("string")
                .calculate(
                  "count(instance('instance')/root/item[yob < 1970]/child[yob = 1988])",
                ),
              bind("/data/input").type("string"),
            ),
          ),
          body(input("/data/input")),
        ),
      );

      // Items born before 1970: Bob Smith (1966), Baz Quux (1968)
      // Their children born in 1988: Sally Smith (Bob) + Baz2 Quux (Baz) + Baz3 Quux (Baz) = 3
      expect(scenario.answerOf("/data/calc")).intAnswer(3);
    },
  );
});

/*
 * ============================================================================
 * BACKLOG — Cases NOT ported in this file
 * ============================================================================
 *
 * 1. Equivalent predicate expressions on different secondary instances
 *    (web-forms/secondary-instances.test.ts "are not confused" / "produces
 *    distinct results from each secondary instance")
 *    Requires external fixture files (two-secondary-instances.xml,
 *    two-secondary-instances-alt.xml).  Fixture creation deferred to a
 *    dedicated secondary-instance fixtures slice.
 *
 * 2. Equivalent predicate expressions in repeat + secondary instance
 *    (web-forms/secondary-instances.test.ts
 *    "recomputes separately within each respective repeat instance")
 *    Requires repeat-secondary-instance.xml external fixture.  Same deferral.
 *
 * 3. Dynamic select choices populated from secondary instance (choicesOf)
 *    Requires choicesOf() + instance() function + select1dynamic DSL.
 *    Deferred — separate Phase 3 secondary-instance/choices slice.
 *
 * 4. pulldata() function
 *    Source: web-forms/xpath/functions/pulldata.test.ts
 *    Out of scope for Phase 3 initial secondary-instance slice.
 * ============================================================================
 */
