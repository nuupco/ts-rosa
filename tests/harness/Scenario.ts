/**
 * Scenario — stub surface for ts-rosa test harness (Task 6).
 *
 * Public API mirrors the JavaRosa Scenario class exactly:
 * method names, parameter counts, and static factory signatures are
 * identical so ported test files compile without modification.
 *
 * Every method throws "not implemented: <methodName>" to produce
 * identifiable RED failures in ported tests before engine implementation.
 *
 * Non-goals (enforced by stubs):
 *   - No XForms parsing
 *   - No DAG/recalculation logic
 *   - No serialization/deserialization logic
 *   - No real Scenario.init() loading
 */

import type { XFormsElement } from "./XFormsElement.ts";
import type { AnswerValue } from "../../src/model/data/AnswerValue.ts";
import type { FormDefinition } from "../../src/model/def/FormDefinition.ts";
import { cast, stringValue } from "../../src/model/data/codecs.ts";
import { parseAbsoluteRef } from "../../src/model/instance/TreeReference.ts";
import { resolveReference } from "../../src/model/instance/InstanceTree.ts";
import { parseForm } from "../../src/parse/XFormParser.ts";
import { createFormSession, type FormSession } from "../../src/session/FormSession.ts";

// ---------------------------------------------------------------------------
// Stub type placeholders for JavaRosa types not yet implemented
// These allow call sites in ported tests to compile.
// ---------------------------------------------------------------------------

/** Stub for org.javarosa.core.model.FormDef */
export interface FormDefStub {
  readonly __type: "FormDef";
}

/** Stub for org.javarosa.core.model.instance.TreeReference */
export interface TreeReferenceStub {
  readonly __type: "TreeReference";
}

/** Stub for org.javarosa.core.model.FormIndex */
export interface FormIndexStub {
  readonly __type: "FormIndex";
}

/** Stub for org.javarosa.core.model.data.IAnswerData */
export interface IAnswerDataStub {
  readonly __type: "IAnswerData";
}

/** Stub for org.javarosa.core.model.QuestionDef */
export interface QuestionDefStub {
  readonly __type: "QuestionDef";
}

/** Stub for org.javarosa.core.model.SelectChoice */
export interface SelectChoiceStub {
  readonly __type: "SelectChoice";
}

/** Stub for org.javarosa.core.model.ValidateOutcome */
export interface ValidateOutcomeStub {
  readonly __type: "ValidateOutcome";
  /** The FormIndex of the prompt that failed validation */
  readonly failedPrompt: FormIndexStub;
  /** The outcome code — maps to AnswerResult values */
  readonly outcome: number;
}

/** Stub for org.javarosa.core.model.instance.TreeElement */
export interface TreeElementStub {
  readonly __type: "TreeElement";
  /** Whether the node is relevant according to its relevance expression */
  readonly isRelevant: boolean;
}

/** Stub for org.javarosa.debug.Event */
export interface DagEventStub {
  readonly __type: "DagEvent";
}

/** Mirrors JavaRosa Scenario.AnswerResult; uses the ts-rosa AnswerResult enum shape */
export type AnswerResultValue = 0 | 1 | 2;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function notImplemented(methodName: string): never {
  throw new Error(`not implemented: ${methodName}`);
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export class Scenario {
  // Internal form definition (set by init)
  private def!: FormDefinition;
  // FormSession with evaluator (set by init — wired in Slice 3.4)
  private session!: FormSession;

  // -------------------------------------------------------------------------
  // Static factory methods (mirrors JavaRosa static init / createFormDef)
  // -------------------------------------------------------------------------

  /**
   * Initializes a Scenario from an XFormsElement DSL form,
   * a filename string, or a FormDef.
   *
   * Overload 1: init(form: XFormsElement) — real implementation (Phase 1)
   * Overload 2: init(filename: string)    — real for inline XML; file loading → notImplemented
   * Overload 3: init(formDef: FormDefStub)— mirrors JavaRosa Scenario.init(FormDef)
   */
  static init(form: XFormsElement): Scenario;
  static init(filename: string): Scenario;
  static init(formDef: FormDefStub): Scenario;
  static init(arg: XFormsElement | string | FormDefStub): Scenario {
    // FormDefStub overload is not yet implemented
    if (typeof arg !== 'string' && '__type' in arg && (arg as FormDefStub).__type === 'FormDef') {
      return notImplemented("init");
    }
    const xml = typeof arg === 'string' ? arg : (arg as XFormsElement).asXml();
    const s = new Scenario();
    s.def = parseForm(xml);
    s.session = createFormSession(s.def);
    return s;
  }

  /**
   * Creates a FormDef from an XFormsElement without initializing navigation.
   * Mirrors JavaRosa Scenario.createFormDef(XFormsElement).
   */
  static createFormDef(_form: XFormsElement): FormDefStub {
    return notImplemented("createFormDef");
  }

  // -------------------------------------------------------------------------
  // Constructor (non-throwing — allows new Scenario() for test setup)
  // -------------------------------------------------------------------------

  constructor() {
    // Intentionally empty; all engine state is in stubs.
  }

  // -------------------------------------------------------------------------
  // Miscellaneous
  // -------------------------------------------------------------------------

  getFormDef(): FormDefStub {
    return notImplemented("getFormDef");
  }

  indexOf(_xPath: string): FormIndexStub {
    return notImplemented("indexOf");
  }

  getCurrentIndex(): FormIndexStub {
    return notImplemented("getCurrentIndex");
  }

  getValidationOutcome(): ValidateOutcomeStub | null {
    return notImplemented("getValidationOutcome");
  }

  expandSingle(_reference: TreeReferenceStub): TreeReferenceStub {
    return notImplemented("expandSingle");
  }

  trace(_msg: string): void {
    return notImplemented("trace");
  }

  finalizeInstance(): void {
    return notImplemented("finalizeInstance");
  }

  onDagEvent(_callback: (_event: DagEventStub) => void): Scenario {
    return notImplemented("onDagEvent");
  }

  newInstance(): void {
    return notImplemented("newInstance");
  }

  setLanguage(_language: string): void {
    return notImplemented("setLanguage");
  }

  // -------------------------------------------------------------------------
  // Answer a question
  // -------------------------------------------------------------------------

  /**
   * Answers the question at the current index, or at the xpath reference.
   *
   * Overloads match JavaRosa:
   *   answer(value: string): AnswerResultValue
   *   answer(value: number): AnswerResultValue
   *   answer(value: boolean): AnswerResultValue
   *   answer(xPath: string, value: string): AnswerResultValue
   *   answer(xPath: string, value: number): AnswerResultValue
   *   answer(xPath: string, value: boolean): AnswerResultValue
   *   answer(xPath: string, ...selectionValues: string[]): AnswerResultValue
   *   answer(choice: SelectChoiceStub): AnswerResultValue
   *   answer(xPath: string, choice: SelectChoiceStub): AnswerResultValue
   */
  answer(xPathOrValue: string | number | boolean | SelectChoiceStub, valueOrExtra?: string | number | boolean | SelectChoiceStub | string[]): AnswerResultValue {
    // Only handles answer(xpath: string, value: string|number|boolean) in Phase 1.
    // All other overloads remain not implemented.
    if (typeof xPathOrValue !== 'string' || valueOrExtra === undefined) {
      return notImplemented("answer");
    }
    if (typeof valueOrExtra !== 'string' && typeof valueOrExtra !== 'number' && typeof valueOrExtra !== 'boolean') {
      return notImplemented("answer");
    }
    const ref = parseAbsoluteRef(xPathOrValue);
    const node = resolveReference(this.def.mainInstance, ref);
    if (!node) throw new Error(`node not found: ${xPathOrValue}`);
    // Coerce the incoming value to the node's dataType
    const coerced = cast(node.dataType, String(valueOrExtra)) ?? stringValue(String(valueOrExtra));
    // Slice 3.4: write via evaluator so the DAG cascade fires
    if (this.def.dag !== null) {
      // setValue writes the node value; triggerTriggerables fires the cascade
      this.session.evaluator.setValue(ref, coerced);
      this.session.evaluator.triggerTriggerables(ref);
    } else {
      node.value = coerced;
    }
    return 0; // AnswerResult.OK — constraint/required validation is Slice 3.6
  }

  // -------------------------------------------------------------------------
  // Inspect the main instance
  // -------------------------------------------------------------------------

  answerOf(xPath: string): AnswerValue | null {
    const ref = parseAbsoluteRef(xPath);
    const node = resolveReference(this.def.mainInstance, ref);
    return node ? node.value : null;
  }

  countRepeatInstancesOf(_xPath: string): number {
    return notImplemented("countRepeatInstancesOf");
  }

  choicesOf(_xPath: string): SelectChoiceStub[] {
    return notImplemented("choicesOf");
  }

  getAnswerNode(_xPath: string): TreeElementStub {
    return notImplemented("getAnswerNode");
  }

  // -------------------------------------------------------------------------
  // Traversing the form
  // -------------------------------------------------------------------------

  /**
   * Mirrors JavaRosa next() and next(int amount).
   * Overload next(xPath: string) mirrors web-forms Scenario.next(ref) which
   * navigates to a specific node by reference.
   */
  next(_amountOrRef?: number | string): number {
    return notImplemented("next");
  }

  prev(): number {
    return notImplemented("prev");
  }

  jumpToBeginningOfForm(): void {
    return notImplemented("jumpToBeginningOfForm");
  }

  // -------------------------------------------------------------------------
  // Inspect the form index
  // -------------------------------------------------------------------------

  atTheEndOfForm(): boolean {
    return notImplemented("atTheEndOfForm");
  }

  refAtIndex(): TreeReferenceStub {
    return notImplemented("refAtIndex");
  }

  atQuestion(): boolean {
    return notImplemented("atQuestion");
  }

  getQuestionAtIndex(): QuestionDefStub {
    return notImplemented("getQuestionAtIndex");
  }

  // -------------------------------------------------------------------------
  // Repeat group manipulation
  // -------------------------------------------------------------------------

  /**
   * Mirrors JavaRosa createNewRepeat() and createNewRepeat(String xPath).
   */
  createNewRepeat(_xPath?: string): Scenario {
    return notImplemented("createNewRepeat");
  }

  removeRepeat(_xPath: string): Scenario {
    return notImplemented("removeRepeat");
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  serializeAndDeserializeForm(): Scenario {
    return notImplemented("serializeAndDeserializeForm");
  }

  serializeAndDeserializeInstance(_form: XFormsElement): Scenario {
    return notImplemented("serializeAndDeserializeInstance");
  }
}
