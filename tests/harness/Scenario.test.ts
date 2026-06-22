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
  it("init(XFormsElement) throws not implemented: init", () => {
    expectNotImplemented(() => Scenario.init(minimalForm), "init");
  });

  it("init(string) throws not implemented: init", () => {
    expectNotImplemented(() => Scenario.init("form.xml"), "init");
  });

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

  it("answer(string) throws not implemented: answer", () => {
    expectNotImplemented(() => scenario.answer("hello"), "answer");
  });

  it("answer(xpath, value) throws not implemented: answer", () => {
    expectNotImplemented(() => scenario.answer("/data/q1", "hello"), "answer");
  });

  it("answerOf(xpath) throws not implemented: answerOf", () => {
    expectNotImplemented(() => scenario.answerOf("/data/q1"), "answerOf");
  });

  it("next() throws not implemented: next", () => {
    expectNotImplemented(() => scenario.next(), "next");
  });

  it("next(amount) throws not implemented: next", () => {
    expectNotImplemented(() => scenario.next(3), "next");
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

  it("createNewRepeat(xpath) throws not implemented: createNewRepeat", () => {
    expectNotImplemented(() => scenario.createNewRepeat("/data/repeat"), "createNewRepeat");
  });

  it("removeRepeat(xpath) throws not implemented: removeRepeat", () => {
    expectNotImplemented(() => scenario.removeRepeat("/data/repeat[0]"), "removeRepeat");
  });

  it("choicesOf(xpath) throws not implemented: choicesOf", () => {
    expectNotImplemented(() => scenario.choicesOf("/data/select"), "choicesOf");
  });

  it("countRepeatInstancesOf(xpath) throws not implemented: countRepeatInstancesOf", () => {
    expectNotImplemented(
      () => scenario.countRepeatInstancesOf("/data/repeat"),
      "countRepeatInstancesOf"
    );
  });

  it("getValidationOutcome() throws not implemented: getValidationOutcome", () => {
    expectNotImplemented(() => scenario.getValidationOutcome(), "getValidationOutcome");
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

  it("getFormDef() throws not implemented: getFormDef", () => {
    expectNotImplemented(() => scenario.getFormDef(), "getFormDef");
  });

  it("indexOf(xpath) throws not implemented: indexOf", () => {
    expectNotImplemented(() => scenario.indexOf("/data/q1"), "indexOf");
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

  it("getAnswerNode(xpath) throws not implemented: getAnswerNode", () => {
    expectNotImplemented(() => scenario.getAnswerNode("/data/q1"), "getAnswerNode");
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
