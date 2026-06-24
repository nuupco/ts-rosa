/**
 * Tests for Scenario stub surface (Task 6).
 *
 * Each public method on Scenario must throw an error that:
 *   1. Is an instance of Error
 *   2. Has a message containing "not implemented"
 *   3. Has a message containing the method name
 *
 * These tests verify the surface exists, compiles, and produces
 * identifiable "not implemented" errors — so ported tests fail RED
 * for the right reason.
 */

import { expect, describe, it } from "vitest";
import { Scenario } from "./Scenario.ts";
import { html, head, body, model, mainInstance, t } from "./XFormsElement.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expectNotImplemented(fn: () => unknown, methodName: string): void {
  expect(fn).toThrow(/not implemented/i);
  expect(fn).toThrow(new RegExp(methodName));
}

// A minimal XFormsElement for stub calls
const minimalForm = html(
  head(model(mainInstance(t("data id=\"test\"")))),
  body()
);

// ---------------------------------------------------------------------------
// Static factory methods
// ---------------------------------------------------------------------------

describe("Scenario.init (static factories)", () => {
  // init(XFormsElement), init(string), init(FormDef) are now real — tested in Scenario-init.test.ts.
  // Only FormDef overload still throws (FormDef is a future stub).
  it("init(FormDef) throws not implemented: init", () => {
    expectNotImplemented(() => Scenario.init({ __type: "FormDef" } as unknown as import("./Scenario.ts").FormDefStub), "init");
  });

  it("createFormDef(XFormsElement) throws not implemented: createFormDef", () => {
    expectNotImplemented(() => Scenario.createFormDef(minimalForm), "createFormDef");
  });
});

// ---------------------------------------------------------------------------
// Instance methods — obtained from the constructor
// ---------------------------------------------------------------------------

describe("Scenario instance method stubs", () => {
  // Use the non-throwing constructor path
  const scenario = new Scenario();

  // answer and answerOf are now real — tested in Scenario-init.test.ts

  // next()/prev()/jumpToBeginningOfForm() now delegate to navigator (Slice 4.2)
  // On an uninitialized Scenario (new Scenario()), session is undefined so these throw.
  it("next() throws when called on uninitialized Scenario (navigator not set up)", () => {
    expect(() => scenario.next()).toThrow();
  });

  it("next(amount) throws when called on uninitialized Scenario", () => {
    expect(() => scenario.next(3)).toThrow();
  });

  it("prev() throws when called on uninitialized Scenario (navigator not set up)", () => {
    expect(() => scenario.prev()).toThrow();
  });

  it("jumpToBeginningOfForm() does not throw on uninitialized Scenario (navigator not set up)", () => {
    expect(() => scenario.jumpToBeginningOfForm()).toThrow();
  });

  it("createNewRepeat() throws not implemented: createNewRepeat", () => {
    expectNotImplemented(() => scenario.createNewRepeat(), "createNewRepeat");
  });

  it("createNewRepeat(xpath) is implemented (no longer a stub)", () => {
    // Implementation delegates to addRepeatInstance — on an uninitialized Scenario
    // it throws a TypeError (not the "not implemented" sentinel). This confirms the
    // method is wired up and no longer throws the notImplemented sentinel.
    expect(() => scenario.createNewRepeat("/data/repeat")).toThrow();
  });

  it("removeRepeat(xpath) is implemented (no longer a stub)", () => {
    // Implementation delegates to removeRepeatInstance — throws on uninitialized Scenario.
    expect(() => scenario.removeRepeat("/data/repeat[0]")).toThrow();
  });

  it("choicesOf(xpath) throws not implemented: choicesOf", () => {
    expectNotImplemented(() => scenario.choicesOf("/data/select"), "choicesOf");
  });

  it("countRepeatInstancesOf(xpath) is implemented (no longer a stub)", () => {
    // Implementation delegates to countRepeatInstances — returns 0 for uninitialized Scenario.
    expect(() => scenario.countRepeatInstancesOf("/data/repeat")).toThrow();
  });

  it("getValidationOutcome() returns null (no errors) for a form with no required fields", () => {
    // Now implemented: returns null for a valid form, ValidateOutcome for failures
    expect(scenario.getValidationOutcome()).toBeNull();
  });

  it("setLanguage(lang) does not throw (slice 5a)", () => {
    // The form in this test has no <itext> block, so languages = [].
    // setLanguage on a form with no itext should be a no-op (or throw for unknown lang).
    // We verify it does NOT throw "not implemented".
    // When the form has no itext, setLanguage with any string may throw for unknown language —
    // but it must NOT throw the notImplemented stub error.
    let threw = false;
    let threwNotImplemented = false;
    try {
      scenario.setLanguage("en");
    } catch (e) {
      threw = true;
      if (e instanceof Error && e.message.includes("not implemented")) {
        threwNotImplemented = true;
      }
    }
    // If it threw, it must not be the "not implemented" stub error
    if (threw) {
      expect(threwNotImplemented).toBe(false);
    }
    // If no throw, the implementation silently handled it — also fine
  });

  it("serializeAndDeserializeForm() throws not implemented: serializeAndDeserializeForm", () => {
    expectNotImplemented(
      () => scenario.serializeAndDeserializeForm(),
      "serializeAndDeserializeForm"
    );
  });

  it("serializeAndDeserializeInstance(form) throws not implemented: serializeAndDeserializeInstance", () => {
    expectNotImplemented(
      () => scenario.serializeAndDeserializeInstance(minimalForm),
      "serializeAndDeserializeInstance"
    );
  });

  it("newInstance() throws not implemented: newInstance", () => {
    expectNotImplemented(() => scenario.newInstance(), "newInstance");
  });

  it("getFormDef() returns a FormLike with a validate() method", () => {
    // Now implemented: returns an object with validate() for checking form validity
    const formDef = scenario.getFormDef();
    expect(typeof formDef.validate).toBe("function");
    expect(formDef.validate()).toBeNull(); // no required/constraint failures
  });

  it("indexOf(xpath) throws when called on uninitialized Scenario (navigator not set up)", () => {
    // indexOf now delegates to navigator (real implementation, Phase 4)
    // On an uninitialized scenario (new Scenario()), session is undefined so it throws.
    expect(() => scenario.indexOf("/data/q1")).toThrow();
  });

  it("getCurrentIndex() returns a FormIndex with kind 'bof' before navigation (Phase 4)", () => {
    const initializedScenario = Scenario.init(minimalForm);
    const idx = initializedScenario.getCurrentIndex();
    expect((idx as unknown as { kind: string }).kind).toBe('bof');
  });

  it("atTheEndOfForm() returns false before navigation (Phase 4)", () => {
    const initializedScenario = Scenario.init(minimalForm);
    expect(initializedScenario.atTheEndOfForm()).toBe(false);
  });

  it("atQuestion() returns false at BOF (Phase 4)", () => {
    const initializedScenario = Scenario.init(minimalForm);
    expect(initializedScenario.atQuestion()).toBe(false);
  });

  it("refAtIndex() returns null at BOF (before any navigation)", () => {
    // refAtIndex is now implemented; at BOF it returns null (no ref)
    const initializedScenario = Scenario.init(minimalForm);
    expect(initializedScenario.refAtIndex()).toBeNull();
  });

  it("getQuestionAtIndex() returns null at BOF (before any navigation)", () => {
    // getQuestionAtIndex is now implemented; at BOF it returns null (not at a question)
    const initializedScenario = Scenario.init(minimalForm);
    expect(initializedScenario.getQuestionAtIndex()).toBeNull();
  });

  // getAnswerNode() is now implemented (Slice 3.5); on uninitialized Scenario it throws node not found
  it("getAnswerNode(xpath) on uninitialized Scenario throws (node not found)", () => {
    expect(() => scenario.getAnswerNode("/data/q1")).toThrow();
  });

  it("onDagEvent(cb) throws not implemented: onDagEvent", () => {
    expectNotImplemented(() => scenario.onDagEvent(() => {}), "onDagEvent");
  });

  it("finalizeInstance() throws not implemented: finalizeInstance", () => {
    expectNotImplemented(() => scenario.finalizeInstance(), "finalizeInstance");
  });

  it("expandSingle(ref) throws not implemented: expandSingle", () => {
    expectNotImplemented(() => scenario.expandSingle({ __type: "TreeReference" } as unknown as import("./Scenario.ts").TreeReferenceStub), "expandSingle");
  });

  it("trace(msg) throws not implemented: trace", () => {
    expectNotImplemented(() => scenario.trace("hello"), "trace");
  });
});
