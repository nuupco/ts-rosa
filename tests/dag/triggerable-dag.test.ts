/**
 * Ported from:
 *   reference/javarosa/src/test/java/org/javarosa/core/model/TriggerableDagTest.java
 *
 * Pending behaviors documented here: 12 it.fails tests
 *   (DAG ordering: 1, cycle detection: 5, relevance: 3, required+constraint: 3)
 *
 * CONVENTION — it.fails() pattern
 * ================================
 * Every test in this file is wrapped with `it.fails(...)` (Vitest's built-in
 * "expected to fail" wrapper). This is intentional and has two effects:
 *
 *   1. The test PASSES today (GREEN in CI) because Scenario stubs throw
 *      "not implemented: <method>", which satisfies `it.fails` expectations.
 *
 *   2. The test becomes a REGRESSION GATE once the engine is implemented:
 *      remove `.fails` from a test to promote it from "pending behavior" to
 *      "enforced behavior". If the engine is correct the test will pass GREEN;
 *      if not, it will fail RED with a real assertion error.
 *
 * How to activate a test when the engine is ready
 * ------------------------------------------------
 *   - Remove `.fails` from the `it.fails(...)` call
 *   - Remove the `// ACTIVATE: remove .fails when engine is ready` comment
 *   - Run `bun run test` — the test must pass GREEN
 *
 * Source mapping
 * --------------
 * Each test block includes a comment with the original Java test method name
 * so the ported behavior can be traced back to the reference implementation.
 *
 * Fixture policy (Task 7)
 * -----------------------
 * All tests below use the inline XFormsElement DSL exclusively.
 * No external XML fixture files are required; see tests/fixtures/README.md.
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
  select1,
  item,
  group,
  repeat,
  t,
  title,
} from "../harness/XFormsElement.ts";
import { Scenario } from "../harness/Scenario.ts";
import "../harness/matchers.ts";
import { AnswerResult } from "../../src/session/AnswerResult.ts";

// ---------------------------------------------------------------------------
// Helper — mirrors Java buildFormForDagCyclesCheck helper.
// Constructs a minimal form with a single bound field named after the last
// segment of the bind's nodeset. Used in cycle-detection tests.
// ---------------------------------------------------------------------------
function buildFormForDagCyclesCheck(
  ...binds: ReturnType<typeof bind>[]
): ReturnType<typeof html> {
  const fields = binds.map((b) => {
    const parts = b.getNodeset().split("/");
    const name = parts[parts.length - 1] ?? "field";
    return t(name);
  });

  const inputs = binds.map((b) => input(b.getNodeset()));

  return html(
    head(
      title("Some form"),
      model(
        mainInstance(t('data id="some-form"', ...fields)),
        ...binds,
      ),
    ),
    body(...inputs),
  );
}

// ---------------------------------------------------------------------------
// Region: DAG ordering
// ---------------------------------------------------------------------------

describe("TriggerableDag — DAG ordering", () => {
  it(
    // Java: order_of_the_DAG_is_ensured
    "order of the DAG is ensured: cascaded calculates use updated upstream values",
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

      expect(scenario.answerOf("/data/a")).intAnswer(2);
      expect(scenario.answerOf("/data/b")).intAnswer(6);
      expect(scenario.answerOf("/data/c")).intAnswer(40);

      scenario.answer("/data/a", 3);

      expect(scenario.answerOf("/data/a")).intAnswer(3);
      expect(scenario.answerOf("/data/b")).intAnswer(9);
      // c must be recomputed using the updated b value
      expect(scenario.answerOf("/data/c")).intAnswer(60);
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Cycle detection
// ---------------------------------------------------------------------------

describe("TriggerableDag — Cycle detection", () => {
  it(
    // Java: parsing_forms_with_cycles_by_self_reference_in_calculate_should_fail
    "parsing a form with self-reference cycle in calculate should fail",
    () => {
      expect(() =>
        Scenario.init(
          buildFormForDagCyclesCheck(
            bind("/data/count").type("int").calculate(". + 1"),
          ),
        ),
      ).toThrow("Cycle detected");
    },
  );

  it(
    // Java: parsing_forms_with_cycles_in_calculate_should_fail
    "parsing a form with a three-node cycle in calculate should fail",
    () => {
      expect(() =>
        Scenario.init(
          buildFormForDagCyclesCheck(
            bind("/data/a").type("int").calculate("/data/b + 1"),
            bind("/data/b").type("int").calculate("/data/c + 1"),
            bind("/data/c").type("int").calculate("/data/a + 1"),
          ),
        ),
      ).toThrow("Cycle detected");
    },
  );

  it(
    // Java: parsing_forms_with_cycles_by_self_reference_in_relevance_should_fail
    "parsing a form with self-reference cycle in relevant should fail",
    () => {
      expect(() =>
        Scenario.init(
          buildFormForDagCyclesCheck(
            bind("/data/count").type("int").relevant(". > 0"),
          ),
        ),
      ).toThrow("Cycle detected");
    },
  );

  it(
    // Java: parsing_forms_with_cycles_by_self_reference_in_required_condition_should_fail
    "parsing a form with self-reference cycle in required should fail",
    () => {
      expect(() =>
        Scenario.init(
          buildFormForDagCyclesCheck(
            bind("/data/count").type("int").required(". > 10"),
          ),
        ),
      ).toThrow("Cycle detected");
    },
  );

  it(
    // Java: supports_self_references_in_constraints
    "self-references in constraint expressions are supported (not a cycle)",
    () => {
      const scenario = Scenario.init(
        buildFormForDagCyclesCheck(
          bind("/data/count").type("int").constraint(". > 10"),
        ),
      );

      scenario.next();

      // Answer below the constraint threshold — value should be rejected
      const r1 = scenario.answer(5);
      expect(r1).toBe(AnswerResult.CONSTRAINT_VIOLATED);
      expect(scenario.answerOf("/data/count")).toBeNull();

      // Answer above the constraint threshold — value should be accepted
      const r2 = scenario.answer(20);
      expect(r2).toBe(AnswerResult.OK);
      expect(scenario.answerOf("/data/count")).intAnswer(20);

      // Answering below again should be rejected; previous committed value preserved
      scenario.answer(5);
      expect(scenario.answerOf("/data/count")).intAnswer(20);
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Relevance
// ---------------------------------------------------------------------------

describe("TriggerableDag — Relevance", () => {
  it(
    // Java: non_relevance_is_inherited_from_ancestors
    "non-relevance is inherited from ancestor nodes",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t(
                  'data id="some-form"',
                  t("is-group-relevant"),
                  t("is-field-relevant"),
                  t("group", t("field")),
                ),
              ),
              bind("/data/is-group-relevant").type("boolean"),
              bind("/data/is-field-relevant").type("boolean"),
              bind("/data/group").relevant("/data/is-group-relevant"),
              bind("/data/group/field")
                .type("string")
                .relevant("/data/is-field-relevant"),
            ),
          ),
          body(
            input("/data/is-group-relevant"),
            input("/data/is-field-relevant"),
            group("/data/group", input("/data/group/field")),
          ),
        ),
      );

      // Initial state: relevance expressions not satisfied → both non-relevant
      expect(scenario.getAnswerNode("/data/group")).nonRelevant();
      expect(scenario.getAnswerNode("/data/group/field")).nonRelevant();

      // Make both relevant
      scenario.answer("/data/is-group-relevant", true);
      scenario.answer("/data/is-field-relevant", true);
      expect(scenario.getAnswerNode("/data/group")).relevant();
      expect(scenario.getAnswerNode("/data/group/field")).relevant();

      // Make group non-relevant — field must inherit non-relevance
      scenario.answer("/data/is-group-relevant", false);
      expect(scenario.getAnswerNode("/data/group")).nonRelevant();
      expect(scenario.getAnswerNode("/data/group/field")).nonRelevant();
    },
  );

  it(
    // Java: verify_relation_between_calculate_expressions_and_relevancy_conditions
    "calculate expressions inside a non-relevant group return null",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t(
                  'data id="some-form"',
                  t("number1"),
                  t("continue"),
                  t("group", t("number1_x2"), t("number1_x2_x2"), t("number2")),
                ),
              ),
              bind("/data/number1")
                .type("int")
                .constraint(". > 0")
                .required("true()"),
              bind("/data/continue").type("string").required("true()"),
              bind("/data/group").relevant("/data/continue = '1'"),
              bind("/data/group/number1_x2")
                .type("int")
                .calculate("/data/number1 * 2"),
              bind("/data/group/number1_x2_x2")
                .type("int")
                .calculate("/data/group/number1_x2 * 2"),
              bind("/data/group/number2")
                .type("int")
                .relevant("/data/group/number1_x2 > 0")
                .required("true()"),
            ),
          ),
          body(
            input("/data/number1"),
            select1(
              "/data/continue",
              item("1", "Yes"),
              item("0", "No"),
            ),
            group("/data/group", input("/data/group/number2")),
          ),
        ),
      );

      scenario.next();
      scenario.answer(2);

      // Group is non-relevant → number1_x2 calculates but number1_x2_x2 is null
      expect(scenario.answerOf("/data/group/number1_x2")).intAnswer(4);
      expect(scenario.answerOf("/data/group/number1_x2_x2")).toBeNull();

      scenario.next();
      scenario.answer("1"); // continue = "1" → group becomes relevant

      expect(scenario.answerOf("/data/group/number1_x2")).intAnswer(4);
      expect(scenario.answerOf("/data/group/number1_x2_x2")).intAnswer(8);
    },
  );

  it(
    // Java: non_relevant_node_values_are_always_null_regardless_of_their_actual_value
    "non-relevant node values are always null regardless of their stored value",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t(
                  'data id="some-form"',
                  t("relevance-trigger", "1"),
                  t("result"),
                  t("some-field", "42"),
                ),
              ),
              bind("/data/relevance-trigger").type("boolean"),
              bind("/data/result")
                .type("int")
                .calculate(
                  "if(/data/some-field != '', /data/some-field + 33, 33)",
                ),
              bind("/data/some-field")
                .type("int")
                .relevant("/data/relevance-trigger"),
            ),
          ),
          body(input("/data/relevance-trigger")),
        ),
      );

      expect(scenario.answerOf("/data/result")).intAnswer(75);
      expect(scenario.answerOf("/data/some-field")).intAnswer(42);

      scenario.answer("/data/relevance-trigger", false);

      // result recalculates using null for the non-relevant field → 33
      expect(scenario.answerOf("/data/result")).intAnswer(33);
      // The stored value in the non-relevant field is unchanged
      expect(scenario.answerOf("/data/some-field")).intAnswer(42);
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Required and constraint
// ---------------------------------------------------------------------------

describe("TriggerableDag — Required and constraint", () => {
  it(
    // Java: constraints_of_fields_that_are_empty_are_always_satisfied
    "constraints on empty fields are always satisfied",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t('data id="some-form"', t("a"), t("b")),
              ),
              bind("/data/a").type("string").constraint("/data/b"),
              bind("/data/b").type("boolean"),
            ),
          ),
          body(input("/data/a"), input("/data/b")),
        ),
      );

      // Ensure constraint on /data/a will not be satisfied
      scenario.answer("/data/b", false);

      // An empty /data/a should still render the form valid
      expect(scenario.getFormDef()).validForm();
    },
  );

  it(
    // Java: empty_required_fields_make_form_validation_fail
    "empty required fields make form validation fail with REQUIRED_BUT_EMPTY",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t('data id="some-form"', t("a"), t("b")),
              ),
              bind("/data/a").type("string").required("true()"),
              bind("/data/b").type("boolean"),
            ),
          ),
          body(input("/data/a"), input("/data/b")),
        ),
      );

      const validate = scenario.getValidationOutcome();
      expect(validate?.failedPrompt).toEqual(scenario.indexOf("/data/a"));
      expect(validate?.outcome).toBe(AnswerResult.REQUIRED_BUT_EMPTY);
    },
  );

  it(
    // Java: constraint_violations_and_form_finalization
    "constraint violations are detected during form finalization",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t('data id="some-form"', t("a"), t("b")),
              ),
              bind("/data/a").type("string").constraint("/data/b"),
              bind("/data/b").type("boolean"),
            ),
          ),
          body(input("/data/a"), input("/data/b")),
        ),
      );

      // Make constraint satisfiable, then commit an answer
      scenario.answer("/data/b", true);
      scenario.answer("/data/a", "cocotero");

      // Make constraint impossible to satisfy
      scenario.answer("/data/b", false);

      // Form finalization must detect the now-violated constraint
      const validate = scenario.getValidationOutcome();
      expect(validate?.failedPrompt).toEqual(scenario.indexOf("/data/a"));
      expect(validate?.outcome).toBe(AnswerResult.CONSTRAINT_VIOLATED);
    },
  );
});
