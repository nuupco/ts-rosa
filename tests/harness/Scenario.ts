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
  // -------------------------------------------------------------------------
  // Static factory methods (mirrors JavaRosa static init / createFormDef)
  // -------------------------------------------------------------------------

  /**
   * Initializes a Scenario from an XFormsElement DSL form,
   * a filename string, or a FormDef.
   *
   * Overload 1: init(form: XFormsElement) — mirrors JavaRosa Scenario.init(XFormsElement)
   * Overload 2: init(filename: string)    — mirrors JavaRosa Scenario.init(String)
   * Overload 3: init(formDef: FormDefStub)— mirrors JavaRosa Scenario.init(FormDef)
   */
  static init(form: XFormsElement): Scenario;
  static init(filename: string): Scenario;
  static init(formDef: FormDefStub): Scenario;
  static init(_arg: XFormsElement | string | FormDefStub): Scenario {
    return notImplemented("init");
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
  answer(_xPathOrValue: string | number | boolean | SelectChoiceStub, _valueOrExtra?: string | number | boolean | SelectChoiceStub | string[]): AnswerResultValue {
    return notImplemented("answer");
  }

  // -------------------------------------------------------------------------
  // Inspect the main instance
  // -------------------------------------------------------------------------

  answerOf(_xPath: string): IAnswerDataStub | null {
    return notImplemented("answerOf");
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
   */
  next(_amount?: number): number {
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
