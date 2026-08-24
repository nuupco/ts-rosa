/**
 * Equivalence tests — rank permutation validation inside a repeat
 *
 * Design-flagged gap (sdd/rank-validation design §7): rank was never tested
 * inside a repeat. findQuestionByRef genericizes the ref (per-template body
 * lookup) while getChoices caches by the concrete ref (per-instance itemset
 * resolution) — this asymmetry is pre-existing and correct, but must be
 * confirmed: two repeat instances with different resolved itemsets validate
 * independently.
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
  repeat,
  t,
  title,
} from "../../harness/XFormsElement.ts";
import { Scenario } from "../../harness/Scenario.ts";
import { AnswerResult } from "../../../src/session/AnswerResult.ts";

function rankInRepeatForm() {
  return html(
    head(
      title("Rank in repeat"),
      model(
        mainInstance(
          t(
            'data id="rank-repeat"',
            t('repeat jr:template=""', t("region"), t("ordered")),
          ),
        ),
        instance(
          "options",
          t("item", t("region", "north"), t("name", "a"), t("label", "A")),
          t("item", t("region", "north"), t("name", "b"), t("label", "B")),
          t("item", t("region", "south"), t("name", "x"), t("label", "X")),
          t("item", t("region", "south"), t("name", "y"), t("label", "Y")),
        ),
        bind("/data/repeat/region").type("string"),
        bind("/data/repeat/ordered").type("odk:rank"),
      ),
    ),
    body(
      repeat(
        "/data/repeat",
        input("/data/repeat/region"),
        t(
          'odk:rank ref="/data/repeat/ordered"',
          t(
            "itemset nodeset=\"instance('options')/root/item[region = ../region]\"",
            t('value ref="name"'),
            t('label ref="label"'),
          ),
        ),
      ),
    ),
  );
}

describe("rank permutation — inside a repeat", () => {
  it("two repeat instances with different resolved itemsets validate independently", () => {
    const scenario = Scenario.init(rankInRepeatForm());

    scenario.next("/data/repeat");
    scenario.createNewRepeat("/data/repeat");
    scenario.next("/data/repeat[1]/region");
    scenario.answer("north");
    scenario.next("/data/repeat[1]/ordered");
    const first = scenario.answer("b a");
    expect(first).toBe(AnswerResult.OK);

    scenario.next("/data/repeat");
    scenario.createNewRepeat("/data/repeat");
    scenario.next("/data/repeat[2]/region");
    scenario.answer("south");
    scenario.next("/data/repeat[2]/ordered");
    const second = scenario.answer("x x");
    expect(second).toBe(AnswerResult.RANK_INVALID);

    // First instance remains valid and committed; second remains uncommitted.
    const firstAnswer = scenario.answerOf("/data/repeat[1]/ordered");
    expect(firstAnswer?.kind).toBe("selectMulti");
    if (firstAnswer?.kind === "selectMulti") {
      expect(firstAnswer.value).toEqual(["b", "a"]);
    }
    expect(scenario.answerOf("/data/repeat[2]/ordered")).toBeNull();

    const outcome = scenario.getValidationOutcome();
    expect(outcome).toBeNull();
  });
});
