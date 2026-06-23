/**
 * Equivalence tests — constraint expressions
 *
 * Sources:
 *   - reference/javarosa: TriggerableDagTest.java
 *     (constraints_of_fields_that_are_empty_are_always_satisfied,
 *      supports_self_references_in_constraints,
 *      constraint_violations_and_form_finalization)
 *   - reference/web-forms: validity-state.test.ts
 *     (constraints of fields that are empty are always satisfied,
 *      constraint violations and form finalization)
 *
 * ALL tests are `it.fails` — the reactive DAG engine and constraint evaluation
 * via Scenario.answer() do not exist yet.
 * Scenario.next(), getValidationOutcome(), indexOf() throw "not implemented".
 *
 * ACTIVATION (Phase 3): remove `.fails` as each constraint slice is
 * implemented.  Each test cites its source method.
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
  t,
  title,
} from "../../harness/XFormsElement.ts";
import { Scenario } from "../../harness/Scenario.ts";
import "../../harness/matchers.ts";
import { AnswerResult } from "../../../src/session/AnswerResult.ts";

// ---------------------------------------------------------------------------
// Region: Empty fields and constraints
// ---------------------------------------------------------------------------

describe("Equivalence — constraint: empty fields", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 constraint evaluation is implemented
    // Source: TriggerableDagTest.java#constraints_of_fields_that_are_empty_are_always_satisfied
    // web-forms: validity-state.test.ts "constraints of fields that are empty are always satisfied"
    "constraints on empty fields are always satisfied (empty → no violation)",
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

      // Ensure the constraint expression for /data/a will not be satisfied
      scenario.answer("/data/b", false);

      // An empty /data/a must still make the form valid
      expect(scenario.getFormDef()).validForm();
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Self-reference in constraint (not a cycle)
// ---------------------------------------------------------------------------

describe("Equivalence — constraint: self-reference", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 constraint + answer with constraint check implemented
    // Source: TriggerableDagTest.java#supports_self_references_in_constraints
    "self-reference in constraint is supported and enforced on answer",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t('data id="some-form"', t("count")),
              ),
              bind("/data/count").type("int").constraint(". > 10"),
            ),
          ),
          body(input("/data/count")),
        ),
      );

      scenario.next();

      // Answer below the threshold → constraint violated, value not committed
      const r1 = scenario.answer(5);
      expect(r1).toBe(AnswerResult.CONSTRAINT_VIOLATED);
      expect(scenario.answerOf("/data/count")).toBeNull();

      // Answer above the threshold → constraint satisfied, value committed
      const r2 = scenario.answer(20);
      expect(r2).toBe(AnswerResult.OK);
      expect(scenario.answerOf("/data/count")).intAnswer(20);

      // Answer below again → rejected; previous committed value (20) preserved
      scenario.answer(5);
      expect(scenario.answerOf("/data/count")).intAnswer(20);
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Constraint violations on form finalization
// ---------------------------------------------------------------------------

describe("Equivalence — constraint: violations detected during form finalization", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 constraint finalization is implemented
    // Source: TriggerableDagTest.java#constraint_violations_and_form_finalization
    // web-forms: validity-state.test.ts "constraint violations and form finalization"
    "constraint violation in a field is detected by getValidationOutcome after dependency changes",
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

      // Make constraint satisfiable and commit a value for /data/a
      scenario.answer("/data/b", true);
      scenario.answer("/data/a", "cocotero");

      // Now make the constraint impossible to satisfy
      scenario.answer("/data/b", false);

      // Form finalization must detect the now-violated constraint on /data/a
      const validate = scenario.getValidationOutcome();
      expect(validate?.failedPrompt).toEqual(scenario.indexOf("/data/a"));
      expect(validate?.outcome).toBe(AnswerResult.CONSTRAINT_VIOLATED);
    },
  );

  it.fails(
    // ACTIVATE: remove .fails when Phase 3 constraint message implemented
    // Source: TriggerableDagTest.java (constraint with jr:constraintMsg)
    "constraint message is surfaced when constraint is violated",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Constraint message"),
            model(
              mainInstance(
                t('data id="constraint-msg"', t("age")),
              ),
              bind("/data/age")
                .type("int")
                .constraint(". >= 0 and . <= 150")
                .withAttribute("jr", "constraintMsg", "Age must be between 0 and 150"),
            ),
          ),
          body(input("/data/age")),
        ),
      );

      scenario.next();
      const r = scenario.answer(-1);
      expect(r).toBe(AnswerResult.CONSTRAINT_VIOLATED);
    },
  );
});

/*
 * ============================================================================
 * BACKLOG — Cases NOT ported in this file
 * ============================================================================
 *
 * 1. Cycle detection via self-reference in constraint
 *    Note: JavaRosa documents that self-reference in CONSTRAINT is NOT a cycle
 *    (unlike in calculate/relevant).  Ported above as the positive case.
 *
 * 2. Constraint + readonly interaction
 *    Requires readonly evaluation engine — out of scope for Phase 3 constraint
 *    slice.  Source: web-forms/validity-state.test.ts (readonly variant tests).
 *
 * 3. Constraint re-evaluation on dependency change (complex cascades)
 *    Will be addressed in Phase 3 DAG re-evaluation slice when constraints are
 *    added as triggerable nodes in the DAG.
 * ============================================================================
 */
