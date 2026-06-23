/**
 * Equivalence tests — indexed-repeat XPath function
 *
 * Sources:
 *   - reference/javarosa: IndexedRepeatRelativeRefsTest.java
 *   - reference/web-forms: xpath/functions/indexed-repeat.test.ts
 *
 * ALL tests are `it.fails` — the indexed-repeat XPath function is not
 * implemented yet.  Scenario.createNewRepeat() also throws "not implemented".
 *
 * ACTIVATION (Phase 3+): remove `.fails` once indexed-repeat is implemented
 * in the XPath engine and the DAG bridges repeat instances.
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
  group,
  t,
  title,
} from "../../harness/XFormsElement.ts";
import { Scenario } from "../../harness/Scenario.ts";
import "../../harness/matchers.ts";

// ---------------------------------------------------------------------------
// Source constants — mirrors IndexedRepeatRelativeRefsTest.java parameter table
// ---------------------------------------------------------------------------

const ABSOLUTE_TARGET = "/data/some-group/item/value";
const RELATIVE_TARGET = "../item/value";
const ABSOLUTE_GROUP = "/data/some-group/item";
const RELATIVE_GROUP = "../item";
const ABSOLUTE_INDEX = "/data/total-items";
const RELATIVE_INDEX = "../../total-items";

interface IndexedRepeatOptions {
  readonly testName: string;
  readonly target: string;
  readonly group: string;
  readonly index: string;
}

const parameters: readonly IndexedRepeatOptions[] = [
  {
    testName: "Target: absolute, group: absolute, index: absolute",
    target: ABSOLUTE_TARGET,
    group: ABSOLUTE_GROUP,
    index: ABSOLUTE_INDEX,
  },
  {
    testName: "Target: absolute, group: absolute, index: relative",
    target: ABSOLUTE_TARGET,
    group: ABSOLUTE_GROUP,
    index: RELATIVE_INDEX,
  },
  {
    testName: "Target: absolute, group: relative, index: absolute",
    target: ABSOLUTE_TARGET,
    group: RELATIVE_GROUP,
    index: ABSOLUTE_INDEX,
  },
  {
    testName: "Target: absolute, group: relative, index: relative",
    target: ABSOLUTE_TARGET,
    group: RELATIVE_GROUP,
    index: RELATIVE_INDEX,
  },
  {
    testName: "Target: relative, group: absolute, index: absolute",
    target: RELATIVE_TARGET,
    group: ABSOLUTE_GROUP,
    index: ABSOLUTE_INDEX,
  },
  {
    testName: "Target: relative, group: absolute, index: relative",
    target: RELATIVE_TARGET,
    group: ABSOLUTE_GROUP,
    index: RELATIVE_INDEX,
  },
  {
    testName: "Target: relative, group: relative, index: absolute",
    target: RELATIVE_TARGET,
    group: RELATIVE_GROUP,
    index: ABSOLUTE_INDEX,
  },
  {
    testName: "Target: relative, group: relative, index: relative",
    target: RELATIVE_TARGET,
    group: RELATIVE_GROUP,
    index: RELATIVE_INDEX,
  },
];

// ---------------------------------------------------------------------------
// Region: indexed-repeat with absolute and relative path combinations
// ---------------------------------------------------------------------------

describe("Equivalence — indexed-repeat: absolute/relative path combinations", () => {
  for (const options of parameters) {
    const opts = options; // capture for closure

    it(
      // ACTIVATED: Slice 3.7 — indexed-repeat + createNewRepeat implemented
      opts.testName,
      () => {
        const scenario = Scenario.init(
          html(
            head(
              title("Some form"),
              model(
                mainInstance(
                  t(
                    'data id="some-form"',
                    t(
                      "some-group",
                      t('item jr:template=""', t("value")),
                      t("last-value"),
                    ),
                    t("total-items"),
                  ),
                ),
                bind(ABSOLUTE_TARGET).type("int"),
                bind("/data/total-items")
                  .type("int")
                  .calculate("count(/data/some-group/item)"),
                bind("/data/some-group/last-value")
                  .type("int")
                  .calculate(
                    `indexed-repeat(${opts.target}, ${opts.group}, ${opts.index})`,
                  ),
              ),
            ),
            body(
              group(
                "/data/some-group",
                group(
                  "/data/some-group/item",
                  repeat(
                    "/data/some-group/item",
                    input("/data/some-group/item/value"),
                  ),
                ),
              ),
            ),
          ),
        );

        scenario.createNewRepeat("/data/some-group/item");
        scenario.answer("/data/some-group/item[1]/value", 11);

        scenario.createNewRepeat("/data/some-group/item");
        scenario.answer("/data/some-group/item[2]/value", 22);

        scenario.createNewRepeat("/data/some-group/item");
        scenario.answer("/data/some-group/item[3]/value", 33);

        expect(scenario.answerOf("/data/total-items")).intAnswer(3);
        // indexed-repeat should return the last item's value (index = count = 3)
        expect(scenario.answerOf("/data/some-group/last-value")).intAnswer(33);
      },
    );
  }
});

/*
 * ============================================================================
 * BACKLOG — Cases NOT ported in this file
 * ============================================================================
 *
 * 1. indexed-repeat with wrong arity (error handling)
 *    Source: web-forms/indexed-repeat.test.ts "JavaRosa draft PR" section.
 *    Requires error-message semantics design.
 *
 * 2. indexed-repeat in a calculate that updates on each repeat add
 *    Source: web-forms/indexed-repeat.test.ts additional scenarios.
 *    Will be addressed after basic indexed-repeat is functional.
 * ============================================================================
 */
