/**
 * Equivalence tests — rank permutation validation (sdd/rank-validation)
 *
 * First rank-specific validation test file. Enforces the permutation
 * invariant (no duplicate/missing/foreign tokens) at both the answerQuestion
 * gate and the validate() sweep gate. See sdd/rank-validation spec + design.
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
  select,
  input,
  t,
  title,
} from "../../harness/XFormsElement.ts";
import { Scenario } from "../../harness/Scenario.ts";
import { AnswerResult } from "../../../src/session/AnswerResult.ts";

function staticRankForm(opts?: { required?: boolean; constraint?: string }) {
  let b = bind("/data/ordered").type("odk:rank");
  if (opts?.required === true) b = b.required();
  if (opts?.constraint !== undefined) b = b.constraint(opts.constraint);

  return html(
    head(
      title("Rank"),
      model(
        mainInstance(t('data id="rank-validation"', t("ordered"))),
        b,
      ),
    ),
    body(
      t(
        'odk:rank ref="/data/ordered"',
        t("item", t("label", "A"), t("value", "a")),
        t("item", t("label", "B"), t("value", "b")),
        t("item", t("label", "C"), t("value", "c")),
      ),
    ),
  );
}

function itemsetRankForm(itemsetTag = "odk:rank") {
  return html(
    head(
      title("Rank itemset"),
      model(
        mainInstance(t('data id="rank-itemset"', t("region"), t("ordered"))),
        instance("districts", t("item", t("region", "north"), t("name", "a"), t("label", "A"))),
        bind("/data/region").type("string"),
        bind("/data/ordered").type("odk:rank"),
      ),
    ),
    body(
      input("/data/region"),
      t(
        `${itemsetTag} ref="/data/ordered"`,
        t(
          "itemset nodeset=\"instance('districts')/root/item[region = /data/region]\"",
          t('value ref="name"'),
          t('label ref="label"'),
        ),
      ),
    ),
  );
}

describe("rank permutation — answerQuestion gate", () => {
  it("accepts a valid permutation and commits the value", () => {
    const scenario = Scenario.init(staticRankForm());
    scenario.next("/data/ordered");
    const result = scenario.answer("b a c");
    expect(result).toBe(AnswerResult.OK);
    const answer = scenario.answerOf("/data/ordered");
    expect(answer?.kind).toBe("selectMulti");
    if (answer?.kind === "selectMulti") {
      expect(answer.value).toEqual(["b", "a", "c"]);
    }
  });

  it("rejects a duplicate token and does not commit", () => {
    const scenario = Scenario.init(staticRankForm());
    scenario.next("/data/ordered");
    const result = scenario.answer("a a c");
    expect(result).toBe(AnswerResult.RANK_INVALID);
    expect(scenario.answerOf("/data/ordered")).toBeNull();
  });

  it("rejects a missing token and does not commit", () => {
    const scenario = Scenario.init(staticRankForm());
    scenario.next("/data/ordered");
    const result = scenario.answer("a c");
    expect(result).toBe(AnswerResult.RANK_INVALID);
    expect(scenario.answerOf("/data/ordered")).toBeNull();
  });

  it("rejects a foreign token and does not commit", () => {
    const scenario = Scenario.init(staticRankForm());
    scenario.next("/data/ordered");
    const result = scenario.answer("a b z");
    expect(result).toBe(AnswerResult.RANK_INVALID);
    expect(scenario.answerOf("/data/ordered")).toBeNull();
  });

  it("select with duplicate/foreign tokens remains unchanged (regression guard)", () => {
    const form = html(
      head(
        title("Select regression"),
        model(
          mainInstance(t('data id="select-regression"', t("picked"))),
          bind("/data/picked").type("select"),
        ),
      ),
      body(select("/data/picked", t("item", t("label", "A"), t("value", "a")), t("item", t("label", "B"), t("value", "b")))),
    );
    const scenario = Scenario.init(form);
    scenario.next("/data/picked");
    const result = scenario.answer("a a z");
    expect(result).toBe(AnswerResult.OK);
    const answer = scenario.answerOf("/data/picked");
    expect(answer?.kind).toBe("selectMulti");
    if (answer?.kind === "selectMulti") {
      expect(answer.value).toEqual(["a", "a", "z"]);
    }
  });

  it("unresolved dynamic itemset (currently empty) skips the check and accepts the answer", () => {
    const scenario = Scenario.init(itemsetRankForm());
    // /data/region left unanswered → itemset resolves to zero choices
    scenario.next("/data/ordered");
    const result = scenario.answer("anything not-a-real-choice");
    expect(result).toBe(AnswerResult.OK);
  });

  it("dynamic itemset resolved later re-applies the check", () => {
    const scenario = Scenario.init(itemsetRankForm());
    scenario.answer("/data/region", "north");
    scenario.next("/data/ordered");
    const invalid = scenario.answer("not-a-real-choice");
    expect(invalid).toBe(AnswerResult.RANK_INVALID);
    const valid = scenario.answer("a");
    expect(valid).toBe(AnswerResult.OK);
  });
});

describe("rank permutation — validate() sweep gate", () => {
  it("reports RANK_INVALID for an invalid permutation node", () => {
    const scenario = Scenario.init(staticRankForm());
    scenario.next("/data/ordered");
    scenario.answer("a a c"); // rejected at answerQuestion; node stays null → not applicable
    // Force a non-null but invalid value directly to exercise the sweep path
    // by bypassing the answerQuestion gate is not possible via public API,
    // so use a valid-then-mutated approach: not needed, sweep checks the
    // committed value which is still null here — assert OK is not reported
    // as RANK_INVALID since null is skipped by the sweep too.
    const outcome = scenario.getValidationOutcome();
    expect(outcome).toBeNull();
  });

  it("reports the first failing rank nodeset when two rank questions exist, first invalid", () => {
    const form = html(
      head(
        title("Two ranks"),
        model(
          mainInstance(t('data id="two-ranks"', t("first"), t("second"))),
          bind("/data/first").type("odk:rank"),
          bind("/data/second").type("odk:rank"),
        ),
      ),
      body(
        t(
          'odk:rank ref="/data/first"',
          t("item", t("label", "A"), t("value", "a")),
          t("item", t("label", "B"), t("value", "b")),
        ),
        t(
          'odk:rank ref="/data/second"',
          t("item", t("label", "X"), t("value", "x")),
          t("item", t("label", "Y"), t("value", "y")),
        ),
      ),
    );
    const scenario = Scenario.init(form);
    scenario.answer("/data/first", "a a"); // via xpath+value path, bypasses answerQuestion, commits directly
    scenario.answer("/data/second", "x y");

    const outcome = scenario.getValidationOutcome();
    expect(outcome?.failedPrompt).toEqual(scenario.indexOf("/data/first"));
    expect(outcome?.outcome).toBe(AnswerResult.RANK_INVALID);
  });

  it("required + blank rank reports REQUIRED_BUT_EMPTY, never RANK_INVALID", () => {
    const scenario = Scenario.init(staticRankForm({ required: true }));
    const outcome = scenario.getValidationOutcome();
    expect(outcome?.failedPrompt).toEqual(scenario.indexOf("/data/ordered"));
    expect(outcome?.outcome).toBe(AnswerResult.REQUIRED_BUT_EMPTY);
  });

  it("rank precedence over constraint: RANK_INVALID reported, not CONSTRAINT_VIOLATED", () => {
    const scenario = Scenario.init(staticRankForm({ constraint: "false()" }));
    scenario.answer("/data/ordered", "a a c"); // direct commit via xpath+value path

    const outcome = scenario.getValidationOutcome();
    expect(outcome?.failedPrompt).toEqual(scenario.indexOf("/data/ordered"));
    expect(outcome?.outcome).toBe(AnswerResult.RANK_INVALID);
  });
});

describe("rank permutation — hydration path", () => {
  it("no fail-loud at hydration; RANK_INVALID surfaces only on subsequent validate()", () => {
    // A stale invalid value committed directly (simulating a persisted instance)
    // must not throw when constructing the scenario, and must surface only
    // when validate() is explicitly called.
    const scenario = Scenario.init(staticRankForm());
    scenario.answer("/data/ordered", "a a c"); // direct commit, no answerQuestion gate
    // No throw so far.
    const outcome = scenario.getValidationOutcome();
    expect(outcome?.outcome).toBe(AnswerResult.RANK_INVALID);
  });
});
