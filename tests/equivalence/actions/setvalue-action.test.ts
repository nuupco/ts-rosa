/**
 * Equivalence tests — ported from JavaRosa SetValueActionTest.java.
 *
 * Source: reference/javarosa/src/test/java/org/javarosa/core/model/actions/SetValueActionTest.java
 *
 * sdd/setvalue-actions PR3, Batch 4 (task 18): pin the value-changed trigger
 * semantics test-first against real JavaRosa test fixtures/expectations.
 *
 * IMPORTANT — design assumption CONTRADICTED by evidence (see design doc
 * "sdd/setvalue-actions/design" ADR/Requirement 5 discussion):
 *
 *   The design assumed the xforms-value-changed trigger set is the UNION of
 *   (a) the action's own value-expression dependencies (via getTriggers) and
 *   (b) the host control's own ref changing.
 *
 *   Reading JavaRosa's actual dispatch mechanism (FormDef.setValue, line ~417:
 *   `currentQuestion.getActionController().triggerActionsFromEvent(EVENT_QUESTION_VALUE_CHANGED, ...)`)
 *   shows JavaRosa's real semantics are HOST-REF-ONLY: xforms-value-changed
 *   fires exactly when the ONE specific question the action is attached to
 *   changes value — the value expression's own XPath dependencies play NO
 *   role in trigger registration at all. `when_triggerNodeIsUpdatedWithTheSameValue_*`
 *   below proves this: answering a *dependency* of the value expression
 *   (`/data/some-field`) does NOT fire the action; only answering the HOST
 *   node (`/data/source`) does.
 *
 *   ts-rosa's accepted SPEC (obs #1360, Requirement 5) explicitly chose a
 *   BROADER, dependency-based trigger set instead — "using the same
 *   dependency-extraction machinery already used by the DAG... for
 *   consistency with calculate" — as a deliberate value-add beyond strict
 *   JavaRosa parity (design section 2, item 4: "the trigger set is the union
 *   of (a) getTriggers of the value expr, and (b) the host control ref").
 *   This is a PRODUCT DECISION already recorded in the spec, not a bug to
 *   silently patch here.
 *
 *   CONSEQUENCE: because ts-rosa's union trigger set fires MORE eagerly than
 *   JavaRosa (any value-expr dependency also re-fires the action, not just
 *   the host), AND ts-rosa's fireAction has no same-value short-circuit
 *   (design ADR-2, Alternative A, explicitly deferred as a v1 non-goal), the
 *   `when_triggerNodeIsUpdatedWithTheSameValue_targetNodeCalculation_isNotEvaluated`
 *   scenario cannot be ported as a straight pass: it depends on BOTH
 *   strict host-only triggering AND same-value-skip, neither of which v1
 *   implements. That test is ported below as `it.skip` with the JavaRosa
 *   expectations preserved in comments, rather than silently weakened or
 *   dropped — flag for a future change if strict same-value semantics are
 *   ever required.
 *
 *   All other ported tests below pass because they only require host-ref
 *   triggering to fire (which is a SUBSET of ts-rosa's union set — union is
 *   a strict superset of JavaRosa's host-only semantics for every case here
 *   except the same-value-skip case).
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
  setvalue,
  setvalueLiteral,
  group,
} from "../../harness/XFormsElement.ts";
import { Scenario } from "../../harness/Scenario.ts";
import "../../harness/matchers.ts";

describe("Equivalence — setvalue action (xforms-value-changed)", () => {
  it(
    // Source: SetValueActionTest#when_triggerNodeIsUpdated_targetNodeCalculation_isEvaluated
    "fires when the host trigger node is updated, evaluating the target's value expression",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Nested setvalue action"),
            model(
              mainInstance(t('data id="nested-setvalue"', t("source"), t("destination"))),
              bind("/data/source").type("int"),
              bind("/data/destination").type("int"),
            ),
          ),
          body(input("/data/source", setvalue("xforms-value-changed", "/data/destination", "4*4"))),
        ),
      );

      expect(scenario.answerOf("/data/destination")).toBeNull();

      scenario.answer("/data/source", 22);

      expect(scenario.answerOf("/data/destination")).intAnswer(16);
    },
  );

  it(
    // Source: SetValueActionTest#expressionAsLiteralValue_isNotEvaluated
    "treats setvalueLiteral's inner text as a raw string, not an XPath expression",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Literal setvalue"),
            model(
              mainInstance(t('data id="literal-setvalue"', t("source"), t("destination"))),
              bind("/data/source").type("string"),
              bind("/data/destination").type("string"),
            ),
          ),
          body(input("/data/source", setvalueLiteral("xforms-value-changed", "/data/destination", "4*4"))),
        ),
      );

      expect(scenario.answerOf("/data/destination")).toBeNull();

      scenario.answer("/data/source", "22");

      expect(scenario.answerOf("/data/destination")).stringAnswer("4*4");
    },
  );

  it.skip(
    // Source: SetValueActionTest#when_triggerNodeIsUpdatedWithTheSameValue_targetNodeCalculation_isNotEvaluated
    //
    // SKIPPED (documented, not silently dropped — see file header): this JavaRosa
    // test relies on TWO strict-JavaRosa semantics ts-rosa v1 does not implement:
    //   1. Host-ref-ONLY triggering (ts-rosa's spec-approved union set also
    //      triggers on /data/some-field, a value-expr dependency — deliberate
    //      superset, see design Requirement 5).
    //   2. Same-value short-circuit on setValue (design ADR-2 Alternative A,
    //      explicitly deferred as a v1 optimization, not a correctness bug).
    // Both would need to change for this exact scenario to reproduce JavaRosa's
    // assertions; that is a product decision for a future change, not a PR3 fix.
    "does not re-evaluate the target when the trigger node is set to its existing value",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Nested setvalue action"),
            model(
              mainInstance(
                t('data id="nested-setvalue"', t("source"), t("destination"), t("some-field")),
              ),
              bind("/data/destination").type("string"),
            ),
          ),
          body(
            input(
              "/data/source",
              setvalue("xforms-value-changed", "/data/destination", "concat('foo',/data/some-field)"),
            ),
            input("/data/some-field"),
          ),
        ),
      );

      expect(scenario.answerOf("/data/destination")).toBeNull();

      scenario.answer("/data/source", 22);
      expect(scenario.answerOf("/data/destination")).stringAnswer("foo");

      scenario.answer("/data/some-field", "bar");

      scenario.answer("/data/source", 22);
      expect(scenario.answerOf("/data/destination")).stringAnswer("foo");

      scenario.answer("/data/source", 23);
      expect(scenario.answerOf("/data/destination")).stringAnswer("foobar");
    },
  );

  //region groups
  it(
    // Source: SetValueActionTest#setvalueInGroup_setsValueOutsideOfGroup
    "setvalue inside a group can set a value outside the group",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Setvalue"),
            model(
              mainInstance(t('data id="setvalue"', t("g", t("source")), t("destination"))),
              bind("/data/g/source").type("int"),
              bind("/data/destination").type("int"),
            ),
          ),
          body(
            group(
              "/data/g",
              input("/data/g/source", setvalueLiteral("xforms-value-changed", "/data/destination", "7")),
            ),
          ),
        ),
      );

      scenario.answer("/data/g/source", "foo");
      expect(scenario.answerOf("/data/destination")).intAnswer(7);
    },
  );

  it(
    // Source: SetValueActionTest#setvalueOutsideGroup_setsValueInGroup
    "setvalue outside a group can set a value inside the group",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Setvalue"),
            model(
              mainInstance(t('data id="setvalue"', t("source"), t("g", t("destination")))),
              bind("/data/source").type("int"),
              bind("/data/g/destination").type("int"),
            ),
          ),
          body(input("/data/source", setvalueLiteral("xforms-value-changed", "/data/g/destination", "7"))),
        ),
      );

      scenario.answer("/data/source", "foo");
      expect(scenario.answerOf("/data/g/destination")).intAnswer(7);
    },
  );
  //endregion

  /**
   * Read-only is a display-only concern so it should be possible to use an
   * action to modify the value of a read-only field.
   * Source: SetValueActionTest#setvalue_setsValueOfReadOnlyField
   */
  it("sets the value of a read-only field via a load-time action (constraint/readonly bypass, ADR-3)", () => {
    const scenario = Scenario.init(
      html(
        head(
          title("Setvalue readonly"),
          model(
            mainInstance(t('data id="setvalue-readonly"', t("readonly-field"))),
            bind("/data/readonly-field").readonly("1").type("int"),
            setvalue("odk-instance-first-load", "/data/readonly-field", "4*4"),
          ),
        ),
        body(input("/data/readonly-field")),
      ),
    );

    expect(scenario.answerOf("/data/readonly-field")).intAnswer(16);
  });

  it(
    // Source: SetValueActionTest#setvalue_withInnerEmptyString_clearsTarget
    "an empty setvalueLiteral clears the target (writes empty string, cast to null for typed fields)",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Setvalue empty string"),
            model(
              mainInstance(t('data id="setvalue-empty-string"', t("a-field", "12"))),
              bind("/data/a-field").type("int"),
              setvalueLiteral("odk-instance-first-load", "/data/a-field", ""),
            ),
          ),
          body(input("/data/a-field")),
        ),
      );

      expect(scenario.answerOf("/data/a-field")).toBeNull();
    },
  );

  it(
    // Source: SetValueActionTest#setvalue_withEmptyStringValue_clearsTarget
    "a setvalue with value=\"\" clears the target",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Setvalue empty string"),
            model(
              mainInstance(t('data id="setvalue-empty-string"', t("a-field", "12"))),
              bind("/data/a-field").type("int"),
              setvalue("odk-instance-first-load", "/data/a-field", "''"),
            ),
          ),
          body(input("/data/a-field")),
        ),
      );

      expect(scenario.answerOf("/data/a-field")).toBeNull();
    },
  );

  it(
    // Source: SetValueActionTest#setvalue_setsValueOfMultipleFields
    "multiple setvalue actions on the same host each set their own independent destination",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Setvalue multiple destinations"),
            model(
              mainInstance(t('data id="setvalue-multiple"', t("source"), t("destination1"), t("destination2"))),
              bind("/data/destination1").type("int"),
              bind("/data/destination2").type("int"),
            ),
          ),
          body(
            input(
              "/data/source",
              setvalueLiteral("xforms-value-changed", "/data/destination1", "7"),
              setvalueLiteral("xforms-value-changed", "/data/destination2", "11"),
            ),
          ),
        ),
      );

      scenario.answer("/data/source", "foo");
      expect(scenario.answerOf("/data/destination1")).intAnswer(7);
      expect(scenario.answerOf("/data/destination2")).intAnswer(11);
    },
  );

  it(
    // Source: SetValueActionTest#xformsValueChanged_triggeredAfterRecomputation
    "fires after calculate recomputation, so the action's value expression observes the freshly-recomputed calculate",
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title("Value changed event"),
            model(
              mainInstance(t('data id="xforms-value-changed-event"', t("source"), t("calculate"), t("destination"))),
              bind("/data/calculate").type("int").calculate("/data/source * 2"),
              bind("/data/destination").type("int"),
            ),
          ),
          body(input("/data/source", setvalue("xforms-value-changed", "/data/destination", "/data/calculate"))),
        ),
      );

      scenario.answer("/data/source", 12);
      expect(scenario.answerOf("/data/destination")).intAnswer(24);
    },
  );
});

/**
 * NOT ported (documented, out of v1 scope per design's explicit non-goals and
 * spec's out-of-scope section):
 *   - Repeat-scoped setvalue tests (sourceInRepeat_updatesDestInSameRepeatInstance,
 *     setvalueAtRoot_setsValueOfNodeInFirstRepeatInstance,
 *     setValueAtRoot_throwsExpression_whenTargetIsUnboundReference,
 *     setValueInRepeat_setsValueOutsideOfRepeat, setvalueInOuterRepeat_setsInnerRepeatValue):
 *     require repeat-multiplicity-aware target resolution (predicated refs like
 *     `/data/repeat[position()=1]/destination`) which resolveTargetRef rejects
 *     fail-loud in v1 (parser DEVIATION note in actionParser.ts / tasks obs #1362).
 *   - setvalue_setsValueOfAttribute / _afterDeserialization: TreeReference has
 *     no attribute-node addressing (`/data/element/@attr`) in this codebase at
 *     all — out of scope for the whole engine, not just setvalue.
 *   - setvalue_isSerializedAndDeserialized / setvalueWithNoValue_isSerializedAndDeserialized
 *     / setvalue_setsValueOfAttribute_afterDeserialization: exercise JavaRosa's
 *     Java object (de)serialization round-trip, which has no ts-rosa analog.
 */
