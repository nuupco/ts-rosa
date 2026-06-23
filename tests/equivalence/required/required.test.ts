/**
 * Equivalence tests — required expression (dynamic required)
 *
 * Sources:
 *   - reference/javarosa: TriggerableDagTest.java
 *     (empty_required_fields_make_form_validation_fail,
 *      parsing_forms_with_cycles_by_self_reference_in_required_condition_should_fail)
 *   - reference/web-forms: validity-state.test.ts
 *     ("empty required fields make form validation fail")
 *
 * ALL tests are `it.fails` — Scenario.getValidationOutcome() stub throws
 * "not implemented".
 *
 * ACTIVATION (Phase 3): remove `.fails` once required validation is
 * implemented in the engine.
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
// Region: Static required
// ---------------------------------------------------------------------------

describe("Equivalence — required: empty required field makes form validation fail", () => {
  it(
    // Source: TriggerableDagTest.java#empty_required_fields_make_form_validation_fail
    // web-forms: validity-state.test.ts "empty required fields make form validation fail"
    "form validation reports REQUIRED_BUT_EMPTY for an empty required field",
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

      // /data/a is required and empty → validation must fail at /data/a
      const validate = scenario.getValidationOutcome();
      expect(validate?.failedPrompt).toEqual(scenario.indexOf("/data/a"));
      expect(validate?.outcome).toBe(AnswerResult.REQUIRED_BUT_EMPTY);
    },
  );

  it(
    // Source: TriggerableDagTest.java#empty_required_fields_make_form_validation_fail (extension)
    "form is valid once the required field is answered",
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

      // Before answering, form is invalid
      expect(scenario.getValidationOutcome()).not.toBeNull();

      // Answer the required field
      scenario.answer("/data/a", "some value");

      // Now validation should pass
      expect(scenario.getValidationOutcome()).toBeNull();
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Dynamic required (expression)
// ---------------------------------------------------------------------------

describe("Equivalence — required: dynamic required expression", () => {
  it(
    // Source: TriggerableDagTest.java — dynamic required based on another field
    "required expression that depends on another field is re-evaluated on change",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Dynamic required"),
            model(
              mainInstance(
                t('data id="dynamic-required"', t("flag"), t("name")),
              ),
              bind("/data/flag").type("boolean"),
              // /data/name is only required when flag is true
              bind("/data/name").type("string").required("/data/flag"),
            ),
          ),
          body(input("/data/flag"), input("/data/name")),
        ),
      );

      // flag is false by default → name is not required → form is valid
      expect(scenario.getValidationOutcome()).toBeNull();

      // Make flag true → name becomes required and is empty → form is invalid
      scenario.answer("/data/flag", true);
      const validate = scenario.getValidationOutcome();
      expect(validate?.failedPrompt).toEqual(scenario.indexOf("/data/name"));
      expect(validate?.outcome).toBe(AnswerResult.REQUIRED_BUT_EMPTY);

      // Answer name → form is valid again
      scenario.answer("/data/name", "Alice");
      expect(scenario.getValidationOutcome()).toBeNull();
    },
  );
});

/*
 * ============================================================================
 * BACKLOG — Cases NOT ported in this file
 * ============================================================================
 *
 * 1. Cycle detection for self-reference in required expression
 *    (TriggerableDagTest.java#parsing_forms_with_cycles_by_self_reference_in_required_condition_should_fail)
 *    Ported to tests/equivalence/dag/cycles.test.ts (cycle detection group).
 *
 * 2. Required + readonly interaction — out of scope for Phase 3 required slice;
 *    separate design decision needed.
 * ============================================================================
 */
