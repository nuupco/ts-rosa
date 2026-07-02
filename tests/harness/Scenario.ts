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

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { XFormsElement } from "./XFormsElement.ts";
import type { AnswerValue } from "../../src/model/data/AnswerValue.ts";
import type { FormDefinition } from "../../src/model/def/FormDefinition.ts";
import { cast, stringValue } from "../../src/model/data/codecs.ts";
import { parseAbsoluteRef, refToString } from "../../src/model/instance/TreeReference.ts";
import type { TreeReference } from "../../src/model/instance/TreeReference.ts";
import type { PreloadProvider } from "../../src/session/PreloadProvider.ts";
import { frozenPreloadProvider } from "../../src/session/PreloadProvider.ts";

/** Absolute path to the tests/fixtures/ directory. */
const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');
import {
  resolveReference,
  addRepeatInstance,
  countRepeatInstances,
} from "../../src/model/instance/InstanceTree.ts";
import { parseForm } from "../../src/parse/XFormParser.ts";
import { createFormSession, type FormSession } from "../../src/session/FormSession.ts";
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

/** Mirrors org.javarosa.core.model.SelectChoice */
export interface SelectChoiceStub {
  readonly __type: "SelectChoice";
  getValue(): string;
  getDisplayText(): string | null;
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
  static init(form: XFormsElement, opts?: { preloadProvider?: PreloadProvider }): Scenario;
  static init(filenameOrXml: string, opts?: { preloadProvider?: PreloadProvider }): Scenario;
  static init(formDef: FormDefStub, opts?: { preloadProvider?: PreloadProvider }): Scenario;
  static init(
    arg: XFormsElement | string | FormDefStub,
    opts?: { preloadProvider?: PreloadProvider },
  ): Scenario {
    // FormDefStub overload is not yet implemented
    if (typeof arg !== 'string' && '__type' in arg && (arg as FormDefStub).__type === 'FormDef') {
      return notImplemented("init");
    }

    let xml: string;
    if (typeof arg === 'string') {
      // ADR-5: treat as a filename when the string does NOT contain '<'.
      // Raw XML always has at least one '<' tag; filenames never do.
      if (!arg.includes('<')) {
        const fixturePath = resolve(FIXTURES, arg);
        xml = readFileSync(fixturePath, 'utf8');
      } else {
        xml = arg;
      }
    } else {
      xml = (arg as XFormsElement).asXml();
    }

    const provider = opts?.preloadProvider ?? frozenPreloadProvider();
    const s = new Scenario();
    s.def = parseForm(xml);
    s.session = createFormSession(s.def, { preloadProvider: provider });
    return s;
  }

  /**
   * Creates a FormDef from an XFormsElement without initializing navigation.
   * Mirrors JavaRosa Scenario.createFormDef(XFormsElement).
   */
  static createFormDef(_form: XFormsElement): FormDefStub {
    return notImplemented("createFormDef");
  }

  /**
   * Initializes a Scenario from an already-parsed (and, e.g., externally
   * hydrated) FormDefinition, instead of re-parsing XML.
   *
   * ts-rosa-original — no direct JavaRosa counterpart. Added for
   * sdd/external-secondary-instances so integration tests can call
   * `resolveExternalInstances(def)` before wiring up a Scenario, without
   * needing a second raw-XML entry point.
   */
  static fromDefinition(def: FormDefinition, opts?: { preloadProvider?: PreloadProvider }): Scenario {
    const provider = opts?.preloadProvider ?? frozenPreloadProvider();
    const s = new Scenario();
    s.def = def;
    s.session = createFormSession(def, { preloadProvider: provider });
    return s;
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

  indexOf(xPath: string): FormIndex {
    return this.session.navigator.indexOf(xPath);
  }

  /**
   * Mirrors JavaRosa FormEntryModel.isIndexRelevant(FormIndex).
   * Delegates to FormEvaluator.isEffectivelyRelevant for the ref at the given index.
   * Returns false for BOF/EOF (no ref).
   */
  isIndexRelevant(idx: FormIndex): boolean {
    const ref = this.session.navigator.refAtIndex(idx);
    if (ref === null) return false;
    return this.session.evaluator.isEffectivelyRelevant(ref);
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
      failedPrompt: this.session.navigator.indexOf(outcome.failedNodeset) as unknown as FormIndexStub,
      outcome: outcome.status as unknown as number,
    };
  }

  expandSingle(_reference: TreeReferenceStub): TreeReferenceStub {
    return notImplemented("expandSingle");
  }

  /** ADR-6: no-op. JR trace() only logs; ported tests assert on refAtIndex, not trace output. */
  trace(_msg: string): void {
    // intentional no-op
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

  setLanguage(language: string): void {
    this.session.evaluator.setLanguage(language);
  }

  getLanguages(): readonly string[] {
    return this.session.evaluator.getLanguages();
  }

  getActiveLanguage(): string | null {
    return this.session.evaluator.getActiveLanguage();
  }

  /**
   * Resolve an itext id to its text in the active language.
   * Convenience method for tests; mirrors jr:itext() XPath function semantics.
   */
  resolveItext(id: string): string | null {
    return this.session.evaluator.resolveItext(id);
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
    // Use navigator.refAtIndex() to get the current question's ref
    const ref = this.session.navigator.refAtIndex();
    if (ref === null) {
      throw new Error('No current question to answer (cursor is not at a question)');
    }
    const node = resolveReference(this.def.mainInstance, ref);
    if (!node) throw new Error(`node not found at current index`);
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

  choicesOf(xPath: string): SelectChoiceStub[] {
    const ref = parseAbsoluteRef(xPath);
    const raw = this.session.evaluator.getChoices(ref);
    return raw.map((c) => ({
      __type: 'SelectChoice' as const,
      getValue: () => c.value,
      getDisplayText: () => c.label,
    }));
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
   * Overload next(xPath: string) navigates directly to the named ref via
   * navigator.jumpToIndex(navigator.indexOf(xPath)).
   *
   * Returns the FormEntryEvent code (integer) matching JavaRosa EVENT_* constants.
   */
  next(amountOrRef?: number | string): number {
    if (typeof amountOrRef === 'string') {
      // next(xPath): jump to the specific ref
      const targetIndex = this.session.navigator.indexOf(amountOrRef);
      const event = this.session.navigator.jumpToIndex(targetIndex);
      return event.code;
    }
    // next() or next(amount): step forward N times
    const amount = typeof amountOrRef === 'number' ? amountOrRef : 1;
    let event = this.session.navigator.getEvent();
    for (let step = 0; step < amount; step++) {
      event = this.session.navigator.stepToNextEvent();
    }
    return event.code;
  }

  prev(): number {
    const event = this.session.navigator.stepToPreviousEvent();
    return event.code;
  }

  jumpToBeginningOfForm(): void {
    this.session.navigator.jumpToBeginningOfForm();
  }

  /**
   * @experimental Slice 4.4
   * Delegates to navigator.jumpToNewRepeatPrompt().
   * Returns the FormEntryEvent code (mirrors JavaRosa int event code).
   */
  jumpToNewRepeatPrompt(): number {
    return this.session.navigator.jumpToNewRepeatPrompt().code;
  }

  // -------------------------------------------------------------------------
  // Inspect the form index
  // -------------------------------------------------------------------------

  atTheEndOfForm(): boolean {
    return this.session.navigator.atTheEndOfForm();
  }

  /**
   * ADR-6: Returns the real TreeReference at the current cursor so ported tests can
   * call .genericize() via the imported function.
   * Returns null when the cursor is at BOF or EOF.
   */
  refAtIndex(): TreeReference | null {
    return this.session.navigator.refAtIndex();
  }

  /**
   * Peek at the TreeReference one step ahead without advancing the cursor.
   * Relevance-blind — mirrors JavaRosa Scenario.nextRef().
   * Returns null when the next position is EOF.
   */
  nextRef(): TreeReference | null {
    return this.session.navigator.nextRef();
  }

  atQuestion(): boolean {
    return this.session.navigator.atQuestion();
  }

  /**
   * @experimental Slice 4.5
   * Returns a question wrapper for the element at the current cursor.
   * Exposes getLabelInnerText() and getControlType().
   * Returns null when not at a question position.
   */
  getQuestionAtIndex(): { getLabelInnerText(): string | null; getControlType(): string; getDataType(): import('../../src/model/data/DataType.ts').DataType | null; getHintText(): string | null; getRangeBounds(): { start?: number; end?: number; step?: number } | null; getQuestionText(): string | null; getSubstitutedHintText(): string | null } | null {
    return this.session.navigator.getQuestionAtIndex();
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

  /**
   * Removes the repeat instance at `xPath`. Delegates to the public
   * FormNavigator.deleteRepeat API (sdd/repeat-removal-wiring, task T6):
   * resolve the instance's FormIndex via navigator.indexOf, then call
   * navigator.deleteRepeat(idx), which composes removeRepeatInstance +
   * triggerRepeatRemoval + choiceCache invalidation + cursor re-mapping.
   */
  removeRepeat(xPath: string): Scenario {
    const idx = this.session.navigator.indexOf(xPath);
    try {
      this.session.navigator.deleteRepeat(idx);
    } catch (e) {
      // Preserve the pre-migration error contract for existing callers.
      throw new Error(`removeRepeat: could not remove instance at ${xPath}`);
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
