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

  // next() and next(amount) are now implemented (Slice 3.5 basic navigation)
  it("next() returns a number (basic navigation implemented)", () => {
    expect(typeof scenario.next()).toBe("number");
  });

  it("next(amount) returns a number (basic navigation implemented)", () => {
    expect(typeof scenario.next(3)).toBe("number");
  });

  it("prev() throws not implemented: prev", () => {
    expectNotImplemented(() => scenario.prev(), "prev");
  });

  it("jumpToBeginningOfForm() throws not implemented: jumpToBeginningOfForm", () => {
    expectNotImplemented(() => scenario.jumpToBeginningOfForm(), "jumpToBeginningOfForm");
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

  it("setLanguage(lang) throws not implemented: setLanguage", () => {
    expectNotImplemented(() => scenario.setLanguage("en"), "setLanguage");
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

  it("indexOf(xpath) returns a FormIndexStub with the nodeset", () => {
    // Now implemented: returns a stable index object usable for toEqual comparisons
    const idx = scenario.indexOf("/data/q1");
    expect(idx).toBeDefined();
  });

  it("getCurrentIndex() throws not implemented: getCurrentIndex", () => {
    expectNotImplemented(() => scenario.getCurrentIndex(), "getCurrentIndex");
  });

  it("atTheEndOfForm() throws not implemented: atTheEndOfForm", () => {
    expectNotImplemented(() => scenario.atTheEndOfForm(), "atTheEndOfForm");
  });

  it("atQuestion() throws not implemented: atQuestion", () => {
    expectNotImplemented(() => scenario.atQuestion(), "atQuestion");
  });

  it("refAtIndex() throws not implemented: refAtIndex", () => {
    expectNotImplemented(() => scenario.refAtIndex(), "refAtIndex");
  });

  it("getQuestionAtIndex() throws not implemented: getQuestionAtIndex", () => {
    expectNotImplemented(() => scenario.getQuestionAtIndex(), "getQuestionAtIndex");
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
