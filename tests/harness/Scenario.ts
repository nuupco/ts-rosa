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
import { parseAbsoluteRef, refToString, genericize } from "../../src/model/instance/TreeReference.ts";
import {
  resolveReference,
  addRepeatInstance,
  removeRepeatInstance,
  countRepeatInstances,
} from "../../src/model/instance/InstanceTree.ts";
import { parseForm } from "../../src/parse/XFormParser.ts";
import { createFormSession, type FormSession } from "../../src/session/FormSession.ts";
import { walkControls } from "../../src/model/def/FormDefinition.ts";
import type { FormElement } from "../../src/model/def/FormElement.ts";
import { AnswerResult } from "../../src/session/AnswerResult.ts";
import type { FormIndex } from "../../src/session/FormIndex.ts";

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
  // Flat list of question elements in traversal order (for navigation)
  private questions: Array<FormElement & { kind: 'question' }> = [];
  // Current question index (-1 = before first question)
  private currentQuestionIndex = -1;
  // Current question override by xpath (from next(xPath)) — takes priority over index
  private currentRef: string | null = null;

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
    // Build flat question list for navigation
    walkControls(s.def, (q) => s.questions.push(q));
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

  getFormDef(): { validate(): unknown | null } {
    const scenario = this;
    return {
      validate() {
        return scenario._validate();
      },
    };
  }

  indexOf(xPath: string): FormIndexStub {
    return { __type: 'FormIndex', nodeset: xPath } as unknown as FormIndexStub;
  }

  getCurrentIndex(): FormIndex {
    return this.session.navigator.getCurrentIndex();
  }

  getValidationOutcome(): ValidateOutcomeStub | null {
    return this._validate();
  }

  /** Internal: run a full validation sweep and return the first failure. */
  private _validate(): ValidateOutcomeStub | null {
    if (!this.def || this.def.dag === null) return null;

    // Collect all bound nodesets in document order (bindings map order = parse order)
    const allNodesets = Array.from(this.def.bindings.keys());

    const outcome = this.session.evaluator.validate(allNodesets);
    if (outcome === null) return null;

    return {
      __type: 'ValidateOutcome',
      failedPrompt: { __type: 'FormIndex', nodeset: outcome.failedNodeset } as unknown as FormIndexStub,
      outcome: outcome.status as unknown as number,
    };
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
    // answer(value) — answer the current question (no xpath)
    if (
      valueOrExtra === undefined &&
      (typeof xPathOrValue === 'number' || typeof xPathOrValue === 'boolean')
    ) {
      return this.answerCurrentQuestion(xPathOrValue);
    }

    // answer(value: string) — could be "answer the current question" if no xpath dest
    // Heuristic: if valueOrExtra is undefined and xPathOrValue is a string, it's a
    // single-value answer to the current question (not an xpath).
    // But JavaRosa also uses answer(xpath, value) — disambiguate by checking if
    // xPathOrValue looks like an absolute XPath (starts with '/').
    if (typeof xPathOrValue === 'string' && valueOrExtra === undefined) {
      if (xPathOrValue.startsWith('/')) {
        // answer(xpath) — not a standard overload; not implemented
        return notImplemented("answer(xpath-only)");
      }
      // answer(value: string) — answer the current question
      return this.answerCurrentQuestion(xPathOrValue);
    }

    // answer(xpath, value) — the primary 2-arg overload
    if (typeof xPathOrValue !== 'string' || valueOrExtra === undefined) {
      return notImplemented("answer");
    }
    if (typeof valueOrExtra !== 'string' && typeof valueOrExtra !== 'number' && typeof valueOrExtra !== 'boolean') {
      return notImplemented("answer");
    }
    const ref = parseAbsoluteRef(xPathOrValue);
    const node = resolveReference(this.def.mainInstance, ref);
    if (!node) throw new Error(`node not found: ${xPathOrValue}`);
    const coerced = cast(node.dataType, String(valueOrExtra)) ?? stringValue(String(valueOrExtra));
    if (this.def.dag !== null) {
      this.session.evaluator.setValue(ref, coerced);
      this.session.evaluator.triggerTriggerables(ref);
    } else {
      node.value = coerced;
    }
    return 0;
  }

  private answerCurrentQuestion(value: string | number | boolean): AnswerResultValue {
    // If currentRef is set (by next(xPath)), use that ref directly
    if (this.currentRef !== null) {
      const ref = parseAbsoluteRef(this.currentRef);
      const node = resolveReference(this.def.mainInstance, ref);
      if (!node) throw new Error(`node not found: ${this.currentRef}`);
      const coerced = cast(node.dataType, String(value)) ?? stringValue(String(value));
      if (this.def.dag !== null) {
        return this.session.evaluator.answerQuestion(ref, coerced) as unknown as AnswerResultValue;
      } else {
        node.value = coerced;
        return AnswerResult.OK as unknown as AnswerResultValue;
      }
    }
    const q = this.questions[this.currentQuestionIndex];
    if (q === undefined) {
      throw new Error(`No current question to answer (currentQuestionIndex=${this.currentQuestionIndex})`);
    }
    const ref = q.ref;
    const node = resolveReference(this.def.mainInstance, ref);
    if (!node) throw new Error(`node not found: ${q.ref}`);
    const coerced = cast(node.dataType, String(value)) ?? stringValue(String(value));
    if (this.def.dag !== null) {
      return this.session.evaluator.answerQuestion(ref, coerced) as unknown as AnswerResultValue;
    } else {
      node.value = coerced;
      return AnswerResult.OK as unknown as AnswerResultValue;
    }
  }

  // -------------------------------------------------------------------------
  // Inspect the main instance
  // -------------------------------------------------------------------------

  answerOf(xPath: string): AnswerValue | null {
    const ref = parseAbsoluteRef(xPath);
    const node = resolveReference(this.def.mainInstance, ref);
    if (!node) return null;
    // Return the stored value. Non-relevant semantics (null effective value) apply
    // only inside XPath evaluation (via the relevanceOf closure in the adapter),
    // not to direct reads — mirroring JavaRosa TreeElement.getStringValue() behavior.
    return node.value;
  }

  countRepeatInstancesOf(xPath: string): number {
    const ref = parseAbsoluteRef(xPath);
    return countRepeatInstances(this.def.mainInstance, ref);
  }

  choicesOf(_xPath: string): SelectChoiceStub[] {
    return notImplemented("choicesOf");
  }

  getAnswerNode(xPath: string): TreeElementStub {
    const ref = parseAbsoluteRef(xPath);
    const node = resolveReference(this.def.mainInstance, ref);
    if (!node) throw new Error(`node not found: ${xPath}`);
    const isRelevant =
      this.def.dag !== null
        ? this.session.evaluator.isEffectivelyRelevant(ref)
        : true;
    return {
      __type: 'TreeElement',
      isRelevant,
    };
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
    // Basic linear navigation — advance current question by 1
    // (Phase 4 will implement full FormIndex navigation)
    if (_amountOrRef === undefined || typeof _amountOrRef === 'number') {
      const amount = typeof _amountOrRef === 'number' ? _amountOrRef : 1;
      this.currentRef = null;
      this.currentQuestionIndex = Math.min(
        this.currentQuestionIndex + amount,
        this.questions.length - 1,
      );
      return this.currentQuestionIndex;
    }
    // next(xPath): set currentRef to the given xpath so the next answer() uses it
    this.currentRef = _amountOrRef;
    return -1;
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
    return this.session.navigator.atTheEndOfForm();
  }

  refAtIndex(): TreeReferenceStub {
    return notImplemented("refAtIndex");
  }

  atQuestion(): boolean {
    return this.session.navigator.atQuestion();
  }

  getQuestionAtIndex(): QuestionDefStub {
    return notImplemented("getQuestionAtIndex");
  }

  // -------------------------------------------------------------------------
  // Repeat group manipulation
  // -------------------------------------------------------------------------

  /**
   * Mirrors JavaRosa createNewRepeat() and createNewRepeat(String xPath).
   *
   * Adds a new repeat instance by cloning the template (or first instance) at the
   * given path, then re-runs the DAG cascade to initialize calculated/condition values.
   */
  createNewRepeat(xPath?: string): Scenario {
    if (xPath === undefined) return notImplemented("createNewRepeat()");
    const ref = parseAbsoluteRef(xPath);
    const newNode = addRepeatInstance(this.def.mainInstance, ref);
    if (newNode === null) throw new Error(`createNewRepeat: could not add instance at ${xPath}`);

    if (this.def.dag !== null) {
      // Derive the concrete ref of the new instance so cascade targets it
      const instances = (() => {
        const parent = newNode.parent;
        if (!parent) return 0;
        return parent.children.filter(
          (c) => c.name === newNode.name && c.multiplicity !== -2 /* INDEX_TEMPLATE */,
        ).length - 1;
      })();
      // Build a concrete ref for the new instance to use as context in cascade
      const concreteRef = parseAbsoluteRef(`${xPath}[${instances + 1}]`);
      this.session.evaluator.initializeRepeatInstance(concreteRef);
    }
    return this;
  }

  removeRepeat(xPath: string): Scenario {
    const ref = parseAbsoluteRef(xPath);
    const removed = removeRepeatInstance(this.def.mainInstance, ref);
    if (removed === null) throw new Error(`removeRepeat: could not remove instance at ${xPath}`);

    if (this.def.dag !== null) {
      // Trigger cascade on the generic ref so count() etc. update
      const genericRef = genericize(ref);
      this.session.evaluator.triggerRepeatRemoval(genericRef);
    }
    return this;
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
