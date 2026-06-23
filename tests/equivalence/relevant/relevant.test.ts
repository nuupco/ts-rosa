/**
 * Equivalence tests — relevance (relevant expression + inheritance)
 *
 * Sources:
 *   - reference/javarosa: TriggerableDagTest.java
 *     (non_relevance_is_inherited_from_ancestors,
 *      verify_relation_between_calculate_expressions_and_relevancy_conditions,
 *      non_relevant_node_values_are_always_null_regardless_of_their_actual_value)
 *   - reference/web-forms: relevant.test.ts
 *     (non-relevance section, relevance determined by model nesting,
 *      non-relevant nodes excluded from nodeset evaluation)
 *
 * ALL tests are `it.fails` — the reactive DAG engine does not exist yet.
 * Scenario.answer() does not propagate relevance changes; getAnswerNode() stub
 * throws "not implemented".
 *
 * ACTIVATION (Phase 3): remove `.fails` as each relevance slice is
 * implemented.  Each test cites its JavaRosa/web-forms source.
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
  select1,
  item,
  group,
  t,
  title,
} from "../../harness/XFormsElement.ts";
import { Scenario } from "../../harness/Scenario.ts";
import "../../harness/matchers.ts";

// ---------------------------------------------------------------------------
// Region: Inherited non-relevance
// ---------------------------------------------------------------------------

describe("Equivalence — relevant: inherited non-relevance", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 relevance propagation is implemented
    // Source: TriggerableDagTest.java#non_relevance_is_inherited_from_ancestors
    // web-forms: relevant.test.ts "is inherited from ancestors"
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

      // On load: relevance expressions not satisfied → group and field are non-relevant
      expect(scenario.getAnswerNode("/data/group")).nonRelevant();
      expect(scenario.getAnswerNode("/data/group/field")).nonRelevant();

      // Make both relevant
      scenario.answer("/data/is-group-relevant", true);
      scenario.answer("/data/is-field-relevant", true);
      expect(scenario.getAnswerNode("/data/group")).relevant();
      expect(scenario.getAnswerNode("/data/group/field")).relevant();

      // Make the group non-relevant → field must inherit non-relevance even
      // though its own local relevant expression would still be satisfied
      scenario.answer("/data/is-group-relevant", false);
      expect(scenario.getAnswerNode("/data/group")).nonRelevant();
      expect(scenario.getAnswerNode("/data/group/field")).nonRelevant();
    },
  );

  it.fails(
    // ACTIVATE: remove .fails when Phase 3 relevance + model-nesting is implemented
    // Source: web-forms/relevant.test.ts "is determined by model nesting"
    "relevance is determined by model nesting, not body nesting",
    () => {
      // /data/outernode is a sibling of group in the model — it must stay relevant
      // /data/group/innernode is a child of group — it inherits group non-relevance
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t('data id="some-form"', t("outernode"), t("group", t("innernode"))),
              ),
              bind("/data/group").relevant("false()"),
            ),
          ),
          body(
            group(
              "/data/group",
              input("/data/outernode"),
              input("/data/group/innernode"),
            ),
          ),
        ),
      );

      expect(scenario.getAnswerNode("/data/group")).nonRelevant();
      expect(scenario.getAnswerNode("/data/outernode")).relevant();
      expect(scenario.getAnswerNode("/data/group/innernode")).nonRelevant();
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Calculate inside non-relevant group
// ---------------------------------------------------------------------------

describe("Equivalence — relevant: calculates inside non-relevant group", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 relevance + calculate interaction implemented
    // Source: TriggerableDagTest.java#verify_relation_between_calculate_expressions_and_relevancy_conditions
    // web-forms: (same fixture in relevant.test.ts calculate-in-group)
    "calculate expressions inside a non-relevant group return null for nested nodes",
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

      // Group is non-relevant: number1_x2 has a calculate so it computes,
      // but number1_x2_x2 is null because the group is non-relevant
      expect(scenario.answerOf("/data/group/number1_x2")).intAnswer(4);
      expect(scenario.answerOf("/data/group/number1_x2_x2")).toBeNull();

      scenario.next();
      scenario.answer("1"); // continue = '1' → group becomes relevant

      expect(scenario.answerOf("/data/group/number1_x2")).intAnswer(4);
      expect(scenario.answerOf("/data/group/number1_x2_x2")).intAnswer(8);
    },
  );

  it.fails(
    // ACTIVATE: remove .fails when Phase 3 non-relevant-value semantics implemented
    // Source: TriggerableDagTest.java#non_relevant_node_values_are_always_null_regardless_of_their_actual_value
    "non-relevant node values are null for downstream calculations regardless of stored value",
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

      // On load: some-field is relevant (trigger = 1), result = 42 + 33 = 75
      expect(scenario.answerOf("/data/result")).intAnswer(75);
      expect(scenario.answerOf("/data/some-field")).intAnswer(42);

      // Make some-field non-relevant: result must recalculate treating it as null → 33
      // The stored raw value (42) is unchanged, but the effective value is null
      scenario.answer("/data/relevance-trigger", false);

      expect(scenario.answerOf("/data/result")).intAnswer(33);
      // Raw stored value in the non-relevant field is preserved
      expect(scenario.answerOf("/data/some-field")).intAnswer(42);
    },
  );
});

// ---------------------------------------------------------------------------
// Region: Non-relevant nodes excluded from nodeset evaluation
// ---------------------------------------------------------------------------

describe("Equivalence — relevant: non-relevant nodes excluded from concat", () => {
  it.fails(
    // ACTIVATE: remove .fails when Phase 3 repeat relevance + concat implemented
    // Source: web-forms/relevant.test.ts
    //   "is excluded from producing default values in an evaluation (supplemental)"
    "non-relevant repeat nodes do not contribute values to downstream concat calculate",
    () => {
      // position() > 2: first two nodes are non-relevant; concat should only include 3,4,5
      const scenario = Scenario.init(
        html(
          head(
            title("Some form"),
            model(
              mainInstance(
                t(
                  'data id="some-form"',
                  t("node", t("value", "1")),
                  t("node", t("value", "2")),
                  t("node", t("value", "3")),
                  t("node", t("value", "4")),
                  t("node", t("value", "5")),
                  t("node-values"),
                ),
              ),
              bind("/data/node").relevant("position() > 2"),
              bind("/data/node/value").type("int"),
              bind("/data/node-values").calculate("concat(/data/node/value)"),
            ),
          ),
          body(
            group("/data/node", input("/data/node/value")),
          ),
        ),
      );

      expect(scenario.answerOf("/data/node-values")).stringAnswer("345");
    },
  );
});

/*
 * ============================================================================
 * BACKLOG — Cases NOT ported in this file
 * ============================================================================
 *
 * 1. Non-relevant nodes excluded from XPathPathExprEval nodeset evaluation
 *    (web-forms: "are excluded from nodeset evaluation") — requires
 *    XPathPathExprEval internal API surface not present in our Scenario harness.
 *    Will be addressed when that internal is exposed or tested differently.
 *
 * 2. Repeat + position() semantics discrepancy between JavaRosa and web-forms
 *    (web-forms: "is inherited from ancestors (variant #1: node-set semantics
 *    -> string)", variant #2). These test JavaRosa/web-forms casting
 *    discrepancies that need a separate design decision before porting.
 *
 * 3. Relevance in nested repeats with inherited group relevance.
 *    Ported to tests/equivalence/repeat/repeat-relevant.test.ts.
 * ============================================================================
 */
