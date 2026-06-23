/**
 * Equivalence tests — DAG cycle detection
 *
 * Sources:
 *   - reference/javarosa: TriggerableDagTest.java
 *     (parsing_forms_with_cycles_by_self_reference_in_calculate_should_fail,
 *      parsing_forms_with_cycles_in_calculate_should_fail,
 *      parsing_forms_with_cycles_by_self_reference_in_relevance_should_fail,
 *      parsing_forms_with_cycles_by_self_reference_in_required_condition_should_fail)
 *
 * NOTE: The existing tests/dag/triggerable-dag.test.ts already covers 4 of
 * these cycle tests (lines 132–222).  This file extends the coverage with
 * additional cycle scenarios not already ported there.
 *
 * ALL tests are `it.fails` — the DAG cycle-detection engine does not exist yet.
 * Scenario.init() does not build a DAG and therefore does not throw on cycles.
 *
 * ACTIVATION (Phase 3): remove `.fails` once Scenario.init() validates the
 * DAG and throws on detected cycles.
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

// ---------------------------------------------------------------------------
// Helper — mirrors Java buildFormForDagCyclesCheck
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
// Region: Multi-node calculate cycles (not covered in triggerable-dag.test.ts)
// ---------------------------------------------------------------------------

describe("Equivalence — DAG cycle detection: multi-node calculate cycles", () => {
  it(
    // Source: TriggerableDagTest.java#parsing_forms_with_cycles_in_calculate_should_fail
    // NOTE: The 3-node cycle is already in tests/dag/triggerable-dag.test.ts.
    //       This is a 2-node mutual cycle (different shape).
    "parsing a form with a two-node mutual cycle in calculate should fail",
    () => {
      expect(() =>
        Scenario.init(
          buildFormForDagCyclesCheck(
            bind("/data/a").type("int").calculate("/data/b + 1"),
            bind("/data/b").type("int").calculate("/data/a + 1"),
          ),
        ),
      ).toThrow("Cycle detected");
    },
  );

  it(
    // Source: TriggerableDagTest.java — chain of 4 nodes forming a cycle
    "parsing a form with a four-node cycle in calculate should fail",
    () => {
      expect(() =>
        Scenario.init(
          buildFormForDagCyclesCheck(
            bind("/data/a").type("int").calculate("/data/d + 1"),
            bind("/data/b").type("int").calculate("/data/a + 1"),
            bind("/data/c").type("int").calculate("/data/b + 1"),
            bind("/data/d").type("int").calculate("/data/c + 1"),
          ),
        ),
      ).toThrow("Cycle detected");
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Non-cyclic DAG shapes — verify calculate values are correct
// (These forms must parse AND produce correct cascaded values.
//  The calculate cascade itself requires the DAG engine → it.fails today.)
// ---------------------------------------------------------------------------

describe("Equivalence — DAG cycle detection: valid DAGs compute correct values", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 calculate DAG is implemented
    // Source: TriggerableDagTest.java (implicit — valid linear cascade computes)
    "a valid linear calculate chain computes correct cascaded values",
    () => {
      // a → b → c (no cycle); b = a + 1, c = b + 1
      const scenario = Scenario.init(
        buildFormForDagCyclesCheck(
          bind("/data/a").type("int"),
          bind("/data/b").type("int").calculate("/data/a + 1"),
          bind("/data/c").type("int").calculate("/data/b + 1"),
        ),
      );

      scenario.answer("/data/a", 5);

      // After answering a=5: b=6, c=7
      expect(scenario.answerOf("/data/b")).intAnswer(6);
      expect(scenario.answerOf("/data/c")).intAnswer(7);
    },
  );

  it.fails(
    // ACTIVATE: remove .fails when Phase 3 constraint + answer is implemented
    // Source: TriggerableDagTest.java#supports_self_references_in_constraints
    //   (constraint self-ref is NOT a cycle; answer must enforce constraint)
    "a constraint with a self-reference enforces the constraint on answer",
    () => {
      const scenario = Scenario.init(
        buildFormForDagCyclesCheck(
          bind("/data/count").type("int").constraint(". > 10"),
        ),
      );

      scenario.next();
      // Value below the constraint should be rejected
      const r = scenario.answer(5);
      expect(r).not.toBe(0); // 0 = AnswerResult.OK → must not be OK
    },
  );
});

/*
 * ============================================================================
 * BACKLOG — Cases NOT ported in this file
 * ============================================================================
 *
 * 1. Cycle detection in relevant expressions
 *    (TriggerableDagTest.java#parsing_forms_with_cycles_by_self_reference_in_relevance_should_fail)
 *    Already ported in tests/dag/triggerable-dag.test.ts — not duplicated here.
 *
 * 2. Cycle detection in required expressions
 *    (TriggerableDagTest.java#parsing_forms_with_cycles_by_self_reference_in_required_condition_should_fail)
 *    Already ported in tests/dag/triggerable-dag.test.ts — not duplicated here.
 *
 * 3. Self-reference in calculate cycle
 *    Already ported in tests/dag/triggerable-dag.test.ts — not duplicated here.
 *
 * 4. Mixed cycle involving both calculate and relevant on different nodes
 *    Out of scope for Phase 3 initial slice.
 * ============================================================================
 */
