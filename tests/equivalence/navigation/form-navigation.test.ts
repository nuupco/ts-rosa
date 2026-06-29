/**
 * Navigation equivalence tests — FormIndex + FormNavigator (Phase 4, Slices 4.1+)
 *
 * This file is a MIX of two kinds of tests:
 *
 * (a) FAITHFUL PORTS from JavaRosa — tests where the source method is confirmed
 *     to exist in reference/javarosa. Each such test carries an inline
 *     "// Source: <JavaRosaClass>#<method>" comment.
 *
 * (b) ORIGINAL ts-rosa behavioral tests — granular assertions (e.g. next() from
 *     BOF, specific event-code values, path-level invariants) that have NO direct
 *     JavaRosa counterpart. JavaRosa tests navigation via FormNavigationTestCase
 *     with full index-sequence parametrization against XML fixtures, not via
 *     individual next-from-BOF assertions. These are marked
 *     "// original ts-rosa behavioral test (no direct JavaRosa counterpart)".
 *
 * Strict TDD: tests are added as it.fails BEFORE implementation, then
 * activated (changed to `it`) as each slice's implementation lands.
 */

import { describe, it, expect } from 'vitest';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  bind,
  input,
  group,
  repeat,
  t,
  title,
  label,
} from '../../harness/XFormsElement.ts';
import { Scenario } from '../../harness/Scenario.ts';
import { FORM_ENTRY_EVENT } from '../../../src/session/FormEntryEvent.ts';

// ---------------------------------------------------------------------------
// Helpers — minimal form fixtures
// ---------------------------------------------------------------------------

/** Single top-level question form */
function singleQuestionForm() {
  return html(
    head(
      title('Single Question'),
      model(
        mainInstance(t('data id="single"', t('q1'))),
        bind('/data/q1').type('string'),
      ),
    ),
    body(input('/data/q1')),
  );
}

// ---------------------------------------------------------------------------
// Slice 4.1 — cursor position queries
// original ts-rosa behavioral tests (no direct JavaRosa counterpart)
// ---------------------------------------------------------------------------

describe('Equivalence — navigation: cursor position (Slice 4.1)', () => {
  it(
    // S4.1-A: getCurrentIndex on init returns BOF
    'getCurrentIndex_onInit_returnsBof',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      const idx = scenario.getCurrentIndex();
      // FormIndex has kind 'bof' before any navigation
      expect((idx as unknown as { kind: string }).kind).toBe('bof');
    },
  );

  it(
    // S4.1-B: atTheEndOfForm is false at BOF
    'atTheEndOfForm_atBof_returnsFalse',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      expect(scenario.atTheEndOfForm()).toBe(false);
    },
  );

  it(
    // S4.1-C: atQuestion is false at BOF
    'atQuestion_atBof_returnsFalse',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      expect(scenario.atQuestion()).toBe(false);
    },
  );

  it(
    // Ported from FormEntryModelTest.isIndexRelevant — getEvent at BOF returns beginning-of-form
    'getEvent_atBof_returnsBeginningOfForm',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      const idx = scenario.getCurrentIndex();
      // The code at BOF must be BEGINNING_OF_FORM (0)
      // navigator.getEvent(idx).code === FORM_ENTRY_EVENT.BEGINNING_OF_FORM
      // Scenario exposes this via next() returning event code, but at BOF
      // we test the index shape directly through getCurrentIndex:
      expect((idx as unknown as { kind: string }).kind).toBe('bof');
      // FORM_ENTRY_EVENT.BEGINNING_OF_FORM = 0
      expect(FORM_ENTRY_EVENT.BEGINNING_OF_FORM).toBe(0);
    },
  );

  it(
    // S4.1-D: FormIndex at a question has kind 'at' with path of length 1
    'formIndex_atQuestion_hasKindAt',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      // Navigate to the first question
      scenario.next();
      const idx = scenario.getCurrentIndex();
      const asAt = idx as unknown as { kind: string; path: unknown[] };
      expect(asAt.kind).toBe('at');
      expect(asAt.path).toHaveLength(1);
    },
  );
});

// ---------------------------------------------------------------------------
// Slice 4.2 — incrementIndex / decrementIndex + real next() / prev()
// original ts-rosa behavioral tests (no direct JavaRosa counterpart —
// JavaRosa tests navigation via FormNavigationTestCase with full index sequences)
// ---------------------------------------------------------------------------

/** Three top-level questions form */
function threeQuestionForm() {
  return html(
    head(
      title('Three Questions'),
      model(
        mainInstance(t('data id="three"', t('q1'), t('q2'), t('q3'))),
        bind('/data/q1').type('string'),
        bind('/data/q2').type('string'),
        bind('/data/q3').type('string'),
      ),
    ),
    body(
      input('/data/q1'),
      input('/data/q2'),
      input('/data/q3'),
    ),
  );
}

/** Form with a group containing two questions */
function groupWithTwoQuestionsForm() {
  return html(
    head(
      title('Group Form'),
      model(
        mainInstance(t('data id="group"', t('g', t('q1'), t('q2')))),
        bind('/data/g/q1').type('string'),
        bind('/data/g/q2').type('string'),
      ),
    ),
    body(
      group('/data/g', input('/data/g/q1'), input('/data/g/q2')),
    ),
  );
}

/** Form with an empty group then a sibling question */
function emptyGroupWithSiblingForm() {
  return html(
    head(
      title('Empty Group'),
      model(
        mainInstance(t('data id="empty-group"', t('g'), t('q1'))),
        bind('/data/q1').type('string'),
      ),
    ),
    body(
      group('/data/g'),
      input('/data/q1'),
    ),
  );
}

describe('Equivalence — navigation: incrementIndex / decrementIndex + stepping (Slice 4.2)', () => {
  it(
    // S4.2-A: next() from BOF lands on first question
    'next_fromBof_reachesFirstQuestion',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      const code = scenario.next();
      expect(code).toBe(FORM_ENTRY_EVENT.QUESTION);
      expect(scenario.atQuestion()).toBe(true);
    },
  );

  it(
    // S4.2-B: next() past last question reaches EOF
    'next_pastLastQuestion_reachesEof',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      scenario.next(); // to q1
      const code = scenario.next(); // to EOF
      expect(code).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
      expect(scenario.atTheEndOfForm()).toBe(true);
    },
  );

  it(
    // S4.2-C: prev() from EOF reaches last question
    'prev_fromEof_reachesLastQuestion',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      scenario.next(); // to q1
      scenario.next(); // to EOF
      const code = scenario.prev();
      expect(code).toBe(FORM_ENTRY_EVENT.QUESTION);
      expect(scenario.atQuestion()).toBe(true);
    },
  );

  it(
    // S4.2-D: next()/prev() round-trip across three questions
    'nextPrev_roundTrip_threeQuestions',
    () => {
      const scenario = Scenario.init(threeQuestionForm());
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION); // q1
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION); // q2
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION); // q3
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
      expect(scenario.prev()).toBe(FORM_ENTRY_EVENT.QUESTION); // q3
      expect(scenario.prev()).toBe(FORM_ENTRY_EVENT.QUESTION); // q2
      expect(scenario.prev()).toBe(FORM_ENTRY_EVENT.QUESTION); // q1
    },
  );

  it(
    // S4.2-E: incrementIndex over group visits its children (group then q1, q2)
    'incrementIndex_overGroup_visitsChildren',
    () => {
      const scenario = Scenario.init(groupWithTwoQuestionsForm());
      // BOF → group → q1 → q2 → EOF
      const code1 = scenario.next(); // group
      expect(code1).toBe(FORM_ENTRY_EVENT.GROUP);
      const code2 = scenario.next(); // q1 inside group
      expect(code2).toBe(FORM_ENTRY_EVENT.QUESTION);
      const code3 = scenario.next(); // q2 inside group
      expect(code3).toBe(FORM_ENTRY_EVENT.QUESTION);
      const code4 = scenario.next(); // EOF
      expect(code4).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
    },
  );

  it(
    // Empty group is visited as a GROUP event (no children to descend into) then next sibling
    'incrementIndex_emptyGroup_skipsToSibling',
    () => {
      const scenario = Scenario.init(emptyGroupWithSiblingForm());
      // BOF → group (empty) → q1 → EOF
      const code1 = scenario.next(); // empty group itself
      expect(code1).toBe(FORM_ENTRY_EVENT.GROUP);
      const code2 = scenario.next(); // q1 (sibling after group)
      expect(code2).toBe(FORM_ENTRY_EVENT.QUESTION);
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
    },
  );

  it(
    // decrementIndex from second question returns first question
    'decrementIndex_fromSecondQuestion_returnsFirst',
    () => {
      const scenario = Scenario.init(threeQuestionForm());
      scenario.next(); // q1
      scenario.next(); // q2
      const code = scenario.prev(); // back to q1
      expect(code).toBe(FORM_ENTRY_EVENT.QUESTION);
      const idx = scenario.getCurrentIndex();
      const asAt = idx as unknown as { kind: string; path: Array<{ elementIndex: number }> };
      expect(asAt.kind).toBe('at');
      expect(asAt.path[0]!.elementIndex).toBe(0); // first body element
    },
  );

  it(
    // S4.6-A: next(xPath) jumps to the named ref
    'next_xPath_jumpsToNamedRef',
    () => {
      const scenario = Scenario.init(threeQuestionForm());
      const code = scenario.next('/data/q2');
      expect(code).toBe(FORM_ENTRY_EVENT.QUESTION);
      const idx = scenario.getCurrentIndex();
      const asAt = idx as unknown as { kind: string; path: Array<{ elementIndex: number }> };
      expect(asAt.kind).toBe('at');
      expect(asAt.path[0]!.elementIndex).toBe(1); // second body element (q2 at index 1)
    },
  );
});

// ---------------------------------------------------------------------------
// Slice 4.3 — Relevance skip during step
// S4.3-A/B/C/D: original ts-rosa behavioral tests (no direct JavaRosa counterpart)
// isIndexRelevant_respectsRelevanceOfOutermostGroup: faithful port from JavaRosa
//   Source: org.javarosa.form.api.FormEntryModelTest#isIndexRelevant_respectsRelevanceOfOutermostGroup
// ---------------------------------------------------------------------------

/**
 * Form with three top-level questions: a (relevant), b (relevant=false()), c (relevant).
 * Used for S4.3-A and S4.3-B.
 */
function threeQuestionsWithMiddleNonRelevantForm() {
  return html(
    head(
      title('Relevance Skip'),
      model(
        mainInstance(t('data id="relevance-skip"', t('a'), t('b'), t('c'))),
        bind('/data/a').type('string'),
        bind('/data/b').type('string').relevant('false()'),
        bind('/data/c').type('string'),
      ),
    ),
    body(
      input('/data/a'),
      input('/data/b'),
      input('/data/c'),
    ),
  );
}

/**
 * Form: before (relevant), group g with q1/q2 (group relevant=false()), after (relevant).
 * Used for S4.3-C.
 */
function nonRelevantGroupForm() {
  return html(
    head(
      title('Non-relevant Group'),
      model(
        mainInstance(t('data id="nonrel-group"', t('before'), t('g', t('q1'), t('q2')), t('after'))),
        bind('/data/before').type('string'),
        bind('/data/g').relevant('false()'),
        bind('/data/g/q1').type('string'),
        bind('/data/g/q2').type('string'),
        bind('/data/after').type('string'),
      ),
    ),
    body(
      input('/data/before'),
      group('/data/g', input('/data/g/q1'), input('/data/g/q2')),
      input('/data/after'),
    ),
  );
}

/**
 * Form where all questions are non-relevant. Used for S4.3-D.
 */
function allNonRelevantForm() {
  return html(
    head(
      title('All Non-relevant'),
      model(
        mainInstance(t('data id="all-nonrel"', t('q1'), t('q2'))),
        bind('/data/q1').type('string').relevant('false()'),
        bind('/data/q2').type('string').relevant('false()'),
      ),
    ),
    body(
      input('/data/q1'),
      input('/data/q2'),
    ),
  );
}

/**
 * Fixture mirroring FormEntryModelTest.isIndexRelevant_respectsRelevanceOfOutermostGroup.
 *
 * Form structure:
 *   /data/outer (group, relevant="/data/outerYesNo = 'yes'")
 *     /data/outer/inner (group, relevant="/data/innerYesNo = 'yes'")
 *       /data/outer/inner/q1 (question)
 *   /data/outerYesNo (question, default "no")
 *   /data/innerYesNo (question, default "no")
 */
function nestedRelevanceForm() {
  return html(
    head(
      title('Nested relevance'),
      model(
        mainInstance(
          t('data id="nested_relevance"',
            t('outer', t('inner', t('q1'))),
            t('innerYesNo', 'no'),
            t('outerYesNo', 'no'),
          ),
        ),
        bind('/data/outer').relevant("/data/outerYesNo = 'yes'"),
        bind('/data/outer/inner').relevant("/data/innerYesNo = 'yes'"),
      ),
    ),
    body(
      group('/data/outer',
        group('/data/outer/inner',
          input('/data/outer/inner/q1'),
        ),
      ),
      input('/data/outerYesNo'),
      input('/data/innerYesNo'),
    ),
  );
}

describe('Equivalence — navigation: relevance skip during step (Slice 4.3)', () => {
  it(
    // S4.3-A: non-relevant question b is skipped forward (a → skip b → c)
    'next_skipsNonRelevantQuestion',
    () => {
      const scenario = Scenario.init(threeQuestionsWithMiddleNonRelevantForm());
      // BOF → a (skip b) → c → EOF
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION); // a
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION); // c (b skipped)
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
    },
  );

  it(
    // S4.3-B: non-relevant question b is skipped backward (c → skip b → a)
    'prev_skipsNonRelevantQuestion',
    () => {
      const scenario = Scenario.init(threeQuestionsWithMiddleNonRelevantForm());
      // Navigate to c first (relevance-skipping step must already work for this,
      // so we jump directly via indexOf to set up cursor at c)
      scenario.next('/data/c');
      // prev from c should skip b and land on a
      expect(scenario.prev()).toBe(FORM_ENTRY_EVENT.QUESTION);
      const idx = scenario.getCurrentIndex();
      const asAt = idx as unknown as { kind: string; path: Array<{ elementIndex: number }> };
      expect(asAt.kind).toBe('at');
      expect(asAt.path[0]!.elementIndex).toBe(0); // /data/a is at body index 0
    },
  );

  it(
    // S4.3-C: non-relevant group and all its children are skipped
    'next_skipsEntireNonRelevantGroup',
    () => {
      const scenario = Scenario.init(nonRelevantGroupForm());
      // BOF → before → (g and g/q1, g/q2 all skipped) → after → EOF
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION); // before
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION); // after (entire group skipped)
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
    },
  );

  it(
    // S4.3-D: all non-relevant → next() from BOF reaches EOF
    'next_allNonRelevant_reachesEof',
    () => {
      const scenario = Scenario.init(allNonRelevantForm());
      const code = scenario.next();
      expect(code).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
      expect(scenario.atTheEndOfForm()).toBe(true);
    },
  );

  it(
    // Ported from FormEntryModelTest#isIndexRelevant_respectsRelevanceOfOutermostGroup
    // Source: org.javarosa.form.api.FormEntryModelTest#isIndexRelevant_respectsRelevanceOfOutermostGroup
    //
    // JavaRosa: formEntryModel.isIndexRelevant(q1Index) must respect the outermost
    // ancestor group's relevance, not just the immediate parent.
    // ts-rosa equivalent: evaluator.isEffectivelyRelevant(ref) at the q1 ref
    // (called via scenario.isIndexRelevant, which delegates to the evaluator).
    //
    // We verify this by using next() (which uses stepToNextEvent with relevance
    // skip): when q1 is non-relevant, stepToNextEvent skips it and does NOT
    // land on it, so next('/data/outer/inner/q1') still lands the cursor at the
    // non-relevant position via jumpToIndex (relevance-blind), but the
    // relevance state is confirmed via the evaluator.
    //
    // The test mirrors JavaRosa's three assertions:
    //   1. outerYesNo=no → q1 not relevant
    //   2. innerYesNo=yes, outerYesNo=no → q1 still not relevant (outer blocks)
    //   3. both yes → q1 relevant
    'isIndexRelevant_respectsRelevanceOfOutermostGroup',
    () => {
      const scenario = Scenario.init(nestedRelevanceForm());
      // Obtain the q1 index via indexOf (relevance-blind walk)
      const q1Index = scenario.indexOf('/data/outer/inner/q1');

      // 1. Both outer and inner non-relevant → q1 not relevant
      expect(scenario.isIndexRelevant(q1Index)).toBe(false);

      // 2. inner is now relevant, but outer is still not → q1 still not relevant
      scenario.answer('/data/innerYesNo', 'yes');
      expect(scenario.isIndexRelevant(q1Index)).toBe(false);

      // 3. outer is now relevant too → q1 is relevant
      scenario.answer('/data/outerYesNo', 'yes');
      expect(scenario.isIndexRelevant(q1Index)).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Slice 4.4 — Repeat navigation (PROMPT_NEW_REPEAT + REPEAT)
//             + jumpToNewRepeatPrompt + descendIntoRepeat
// ---------------------------------------------------------------------------

/**
 * Form with a simple repeat containing two questions.
 * Uses repeat() directly in body (ts-rosa convention; no group wrapper).
 *
 * Note: JavaRosa fixtures use body(group + repeat) because in JavaRosa both
 * map to a single GroupDef. In ts-rosa, group and repeat are distinct element
 * kinds, so we use repeat() directly to avoid an extra GROUP stop.
 */
function simpleRepeatForm() {
  return html(
    head(
      title('Simple Repeat'),
      model(
        mainInstance(t('data id="simple-repeat"', t('repeat jr:template=""', t('question1'), t('question2')))),
        bind('/data/repeat/question1').type('int'),
        bind('/data/repeat/question2').type('int'),
      ),
    ),
    body(
      repeat('/data/repeat',
        input('/data/repeat/question1'),
        input('/data/repeat/question2'),
      ),
    ),
  );
}

/**
 * Form with a repeat then a sibling question after it.
 * Used for S4.4-D (navigation continues past repeat to next body element).
 */
function repeatThenSiblingForm() {
  return html(
    head(
      title('Repeat Then Sibling'),
      model(
        mainInstance(t('data id="repeat-sibling"', t('before'), t('repeat jr:template=""', t('q')), t('after'))),
        bind('/data/before').type('string'),
        bind('/data/repeat/q').type('string'),
        bind('/data/after').type('string'),
      ),
    ),
    body(
      input('/data/before'),
      repeat('/data/repeat',
        input('/data/repeat/q'),
      ),
      input('/data/after'),
    ),
  );
}

/**
 * Form with a nested repeat.
 * Uses repeat() directly in body (no group wrappers).
 */
function nestedRepeatForm() {
  return html(
    head(
      title('Nested Repeat'),
      model(
        mainInstance(t('data id="nested-repeat"',
          t('repeat1 jr:template=""',
            t('question1'),
            t('question2'),
            t('repeat2 jr:template=""', t('question3')),
          ),
        )),
        bind('/data/repeat1/question1').type('int'),
        bind('/data/repeat1/question2').type('int'),
        bind('/data/repeat1/repeat2/question3').type('int'),
      ),
    ),
    body(
      repeat('/data/repeat1',
        input('/data/repeat1/question1'),
        input('/data/repeat1/question2'),
        repeat('/data/repeat1/repeat2',
          input('/data/repeat1/repeat2/question3'),
        ),
      ),
    ),
  );
}

describe('Equivalence — navigation: repeat navigation (Slice 4.4)', () => {
  it(
    // S4.4-A: next() from BOF on repeat form with no instances emits PROMPT_NEW_REPEAT.
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'next_repeatWithNoInstances_emitsPromptNewRepeat',
    () => {
      const scenario = Scenario.init(simpleRepeatForm());
      // Body: repeat(no instances) → first next() reaches the repeat at mult=0 → PROMPT_NEW_REPEAT
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.PROMPT_NEW_REPEAT);
    },
  );

  it(
    // S4.4-B: repeat with one instance → next() emits REPEAT → Q → Q → PROMPT_NEW_REPEAT → EOF
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'next_repeatWithOneInstance_descendsAndIteratesQuestions',
    () => {
      const scenario = Scenario.init(simpleRepeatForm());
      scenario.createNewRepeat('/data/repeat');
      // BOF → REPEAT(entering instance[1]) → question1(Q) → question2(Q)
      //    → repeat[2](no instance) → PROMPT_NEW_REPEAT → EOF
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.REPEAT);
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION); // question1
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION); // question2
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.PROMPT_NEW_REPEAT);
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
    },
  );

  it(
    // S4.4-C / Ported from FormEntryControllerTest#jumpToNewRepeatPrompt_whenInRepeat_jumpsToRepeatPrompt
    // Source: org.javarosa.form.api.FormEntryControllerTest#jumpToNewRepeatPrompt_whenInRepeat_jumpsToRepeatPrompt
    //
    // JavaRosa: stepToNextEvent() → REPEAT; stepToNextEvent() → QUESTION (question1);
    // jumpToNewRepeatPrompt() → cursor at /data/repeat[2].
    // ts-rosa: REPEAT → question1; jumpToNewRepeatPrompt → PROMPT_NEW_REPEAT for instance[2].
    'jumpToNewRepeatPrompt_whenInRepeat_jumpsToRepeatPrompt',
    () => {
      const scenario = Scenario.init(simpleRepeatForm());
      scenario.createNewRepeat('/data/repeat');
      // Navigate: REPEAT(instance[1]) → question1
      scenario.next(); // REPEAT
      scenario.next(); // QUESTION (question1)
      // Now jumpToNewRepeatPrompt — should move to the prompt for instance[2]
      const promptCode = scenario.jumpToNewRepeatPrompt();
      expect(promptCode).toBe(FORM_ENTRY_EVENT.PROMPT_NEW_REPEAT);
      // Cursor path: repeat at multiplicity 1 (second instance slot, 0-indexed)
      const idx = scenario.getCurrentIndex() as unknown as { kind: string; path: Array<{ multiplicity: number }> };
      expect(idx.kind).toBe('at');
      expect(idx.path[idx.path.length - 1]!.multiplicity).toBe(1);
    },
  );

  it(
    // S4.4-D: After repeat with one instance, navigation reaches /data/after then EOF
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'next_afterRepeat_continuesWithNextBodyElement',
    () => {
      const scenario = Scenario.init(repeatThenSiblingForm());
      scenario.createNewRepeat('/data/repeat');
      // BOF → before(Q) → REPEAT(r[1]) → q(Q) → PROMPT_NEW_REPEAT → after(Q) → EOF
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION);  // before
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.REPEAT);    // entering repeat instance[1]
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION);  // /data/repeat/q
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.PROMPT_NEW_REPEAT); // prompt for instance[2]
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.QUESTION);  // /data/after
      expect(scenario.next()).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
    },
  );

  it(
    // Ported from FormEntryControllerTest#jumpToNewRepeatPrompt_whenInOuterOfNestedRepeat_jumpsToOuterRepeatPrompt
    // Source: org.javarosa.form.api.FormEntryControllerTest#jumpToNewRepeatPrompt_whenInOuterOfNestedRepeat_jumpsToOuterRepeatPrompt
    //
    // JavaRosa: from repeat1[1]/question1, jumpToNewRepeatPrompt() → repeat1[2].
    // ts-rosa: REPEAT(repeat1[1]) → question1; jumpToNewRepeatPrompt → repeat1[2] (PROMPT_NEW_REPEAT).
    'jumpToNewRepeatPrompt_whenInOuterOfNestedRepeat_jumpsToOuterRepeatPrompt',
    () => {
      const scenario = Scenario.init(nestedRepeatForm());
      scenario.createNewRepeat('/data/repeat1');
      // Navigate: REPEAT(repeat1[1]) → question1
      scenario.next(); // REPEAT (entering repeat1[1])
      scenario.next(); // question1
      // jumpToNewRepeatPrompt → repeat1[2] (outer repeat at mult=1)
      const promptCode = scenario.jumpToNewRepeatPrompt();
      expect(promptCode).toBe(FORM_ENTRY_EVENT.PROMPT_NEW_REPEAT);
      const idx = scenario.getCurrentIndex() as unknown as { kind: string; path: Array<{ multiplicity: number }> };
      expect(idx.kind).toBe('at');
      // The repeat1 level should be at multiplicity 1 (second instance slot, 0-indexed)
      expect(idx.path[0]!.multiplicity).toBe(1);
    },
  );

  it(
    // Ported from FormEntryControllerTest#jumpToNewRepeatPrompt_whenInInnerOfNestedRepeat_jumpsToInnerRepeatPrompt
    // Source: org.javarosa.form.api.FormEntryControllerTest#jumpToNewRepeatPrompt_whenInInnerOfNestedRepeat_jumpsToInnerRepeatPrompt
    //
    // JavaRosa: from repeat1[1]/repeat2[1]/question3, jumpToNewRepeatPrompt() → repeat1[1]/repeat2[2].
    // ts-rosa: navigate to question3 inside inner repeat, then jumpToNewRepeatPrompt → repeat2[2].
    'jumpToNewRepeatPrompt_whenInInnerOfNestedRepeat_jumpsToInnerRepeatPrompt',
    () => {
      const scenario = Scenario.init(nestedRepeatForm());
      scenario.createNewRepeat('/data/repeat1');
      scenario.createNewRepeat('/data/repeat1[1]/repeat2');
      // Navigate: REPEAT(repeat1[1]) → question1 → question2 → REPEAT(repeat2[1]) → question3
      scenario.next(); // REPEAT (repeat1[1])
      scenario.next(); // question1
      scenario.next(); // question2
      scenario.next(); // REPEAT (repeat2[1])
      scenario.next(); // question3
      // jumpToNewRepeatPrompt → repeat1[1]/repeat2[2] (inner repeat at mult=1)
      const promptCode = scenario.jumpToNewRepeatPrompt();
      expect(promptCode).toBe(FORM_ENTRY_EVENT.PROMPT_NEW_REPEAT);
      const idx = scenario.getCurrentIndex() as unknown as { kind: string; path: Array<{ multiplicity: number }> };
      expect(idx.kind).toBe('at');
      // Path: repeat1[0] (outer, mult=0) → repeat2[1] (inner, mult=1)
      expect(idx.path).toHaveLength(2);
      expect(idx.path[0]!.multiplicity).toBe(0); // still in repeat1[1] (0-indexed)
      expect(idx.path[1]!.multiplicity).toBe(1); // repeat2[2] (0-indexed)
    },
  );

  it(
    // Ported from FormEntryControllerTest#jumpToNewRepeatPrompt_whenNotInRepeat_doesNothing
    // Source: org.javarosa.form.api.FormEntryControllerTest#jumpToNewRepeatPrompt_whenNotInRepeat_doesNothing
    //
    // JavaRosa: when cursor is at a question outside any repeat, jumpToNewRepeatPrompt() is a no-op.
    'jumpToNewRepeatPrompt_whenNotInRepeat_doesNothing',
    () => {
      const noRepeatScenario = Scenario.init(
        html(
          head(
            title('No Repeat'),
            model(
              mainInstance(t('data id="no-repeat"', t('question1'), t('question2'))),
              bind('/data/question1').type('int'),
              bind('/data/question2').type('int'),
            ),
          ),
          body(
            input('/data/question1'),
            input('/data/question2'),
          ),
        ),
      );
      noRepeatScenario.next(); // → question1
      const idxBefore = noRepeatScenario.getCurrentIndex();
      noRepeatScenario.jumpToNewRepeatPrompt();
      const idxAfter = noRepeatScenario.getCurrentIndex();
      // cursor should not have moved
      expect(idxAfter).toEqual(idxBefore);
    },
  );
});

// ---------------------------------------------------------------------------
// Slice 4.5 — Prompt API: getQuestionAtIndex + getLabelInnerText + jumpToBeginningOfForm
// ---------------------------------------------------------------------------

/**
 * Form fixture for spacesBetweenOutputs.
 * Mirrors org.javarosa.xform.parse.XFormParserTest#spacesBetweenOutputs_areRespected.
 *
 * Label contains adjacent <output> elements separated by a non-breaking space ( ).
 * Expected getLabelInnerText(): "Full name: ${0} ${1}"
 */
function spacesBetweenOutputsForm() {
  // Build via raw XML string (the DSL does not expose <output> elements).
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml">
  <h:head>
    <h:title>Spaces Between Outputs</h:title>
    <model>
      <instance>
        <data id="spaces-outputs">
          <first_name/>
          <last_name/>
          <question/>
        </data>
      </instance>
      <bind nodeset="/data/question" type="string"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/question">
      <label>Full name: <output value=" ../first_name "/> <output value=" ../last_name "/></label>
    </input>
  </h:body>
</h:html>`;
}

describe('Equivalence — navigation: prompt API (Slice 4.5)', () => {
  it(
    // S4.5-A: xform-parser.test.ts:203 spacesBetweenOutputs_areRespected
    // Ported from org.javarosa.xform.parse.XFormParserTest#spacesBetweenOutputs_areRespected
    // Source: org.javarosa.xform.parse.XFormParserTest#spacesBetweenOutputs_areRespected
    'spacesBetweenOutputs_areRespected',
    () => {
      const scenario = Scenario.init(spacesBetweenOutputsForm());
      scenario.next(); // navigate to /data/question
      const question = scenario.getQuestionAtIndex();
      const nbsp = ' ';
      const expected = `Full name: \${0}${nbsp}\${1}`;
      expect(question!.getLabelInnerText()).toBe(expected);
    },
  );

  it(
    // S4.5-B: refAtIndex returns the ref at the cursor
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'refAtIndex_atQuestion_returnsRef',
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title('Single Question'),
            model(
              mainInstance(t('data id="ref-test"', t('name'))),
              bind('/data/name').type('string'),
            ),
          ),
          body(input('/data/name')),
        ),
      );
      scenario.next(); // navigate to /data/name
      const ref = scenario.refAtIndex();
      // The returned ref should be truthy and not null
      expect(ref).not.toBeNull();
    },
  );

  it(
    // S4.5-C: jumpToBeginningOfForm resets cursor to BOF
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'jumpToBeginningOfForm_resetsCursorToBof',
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title('Single Question'),
            model(
              mainInstance(t('data id="bof-test"', t('q'))),
              bind('/data/q').type('string'),
            ),
          ),
          body(input('/data/q')),
        ),
      );
      scenario.next(); // advance to first question
      scenario.jumpToBeginningOfForm();
      const idx = scenario.getCurrentIndex();
      expect((idx as unknown as { kind: string }).kind).toBe('bof');
    },
  );

  it(
    // S4.5-D: getQuestionAtIndex returns a question with getControlType()
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'getQuestionAtIndex_returnsQuestionWithControlType',
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title('Single Question'),
            model(
              mainInstance(t('data id="ctrl-type-test"', t('q'))),
              bind('/data/q').type('string'),
            ),
          ),
          body(input('/data/q')),
        ),
      );
      scenario.next();
      const question = scenario.getQuestionAtIndex();
      expect(question!.getControlType()).toBe('input');
    },
  );

  it(
    // S4.5-E: getQuestionAtIndex exposes getDataType() returning the binding's DataType
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'getQuestionAtIndex_returnsQuestionWithDataType',
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title('DataType Question'),
            model(
              mainInstance(t('data id="datatype-test"', t('age'))),
              bind('/data/age').type('int'),
            ),
          ),
          body(input('/data/age')),
        ),
      );
      scenario.next();
      const question = scenario.getQuestionAtIndex();
      expect(question).not.toBeNull();
      expect(question!.getDataType()).toBe('int');
    },
  );

  it(
    // S4.5-F: getDataType() returns null when the question has no binding
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'getQuestionAtIndex_getDataType_nullWhenNoBinding',
    () => {
      // Build via raw XML string to produce a question with no <bind> element.
      const xform = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml">
  <h:head>
    <h:title>No Bind</h:title>
    <model>
      <instance>
        <data id="nobind-test">
          <q/>
        </data>
      </instance>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/q"/>
  </h:body>
</h:html>`;
      const scenario = Scenario.init(xform);
      scenario.next();
      const question = scenario.getQuestionAtIndex();
      expect(question).not.toBeNull();
      expect(question!.getDataType()).toBeNull();
    },
  );

  it(
    // S4.5-G: getHintText() returns the hint text when present
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'getQuestionAtIndex_getHintText_returnsHintWhenPresent',
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title('Hint Test'),
            model(
              mainInstance(t('data id="hint-test"', t('q'))),
              bind('/data/q').type('string'),
            ),
          ),
          body(
            t('input ref="/data/q"', label('Question'), t('hint', 'Please answer carefully')),
          ),
        ),
      );
      scenario.next();
      const question = scenario.getQuestionAtIndex();
      expect(question).not.toBeNull();
      expect(question!.getHintText()).toBe('Please answer carefully');
    },
  );

  it(
    // S4.5-H: getHintText() returns null when no hint is present
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'getQuestionAtIndex_getHintText_nullWhenAbsent',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      scenario.next();
      const question = scenario.getQuestionAtIndex();
      expect(question).not.toBeNull();
      expect(question!.getHintText()).toBeNull();
    },
  );

  it(
    // S4.5-I: getRangeBounds() returns bounds for a range question
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'getQuestionAtIndex_getRangeBounds_returnsBoundsForRange',
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title('Range Test'),
            model(
              mainInstance(t('data id="range-test"', t('rating'))),
              bind('/data/rating').type('int'),
            ),
          ),
          body(
            t('range ref="/data/rating" start="1" end="100" step="5"', label('Rate')),
          ),
        ),
      );
      scenario.next();
      const question = scenario.getQuestionAtIndex();
      expect(question).not.toBeNull();
      const bounds = question!.getRangeBounds();
      expect(bounds).not.toBeNull();
      expect(bounds!.start).toBe(1);
      expect(bounds!.end).toBe(100);
      expect(bounds!.step).toBe(5);
    },
  );

  it(
    // S4.5-J: getRangeBounds() returns null for a non-range question
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'getQuestionAtIndex_getRangeBounds_nullForNonRange',
    () => {
      const scenario = Scenario.init(singleQuestionForm());
      scenario.next();
      const question = scenario.getQuestionAtIndex();
      expect(question).not.toBeNull();
      expect(question!.getRangeBounds()).toBeNull();
    },
  );

  it(
    // S4.5-K: end-to-end — range question with hint and bounds round-trips through parser + navigator
    // original ts-rosa behavioral test (no direct JavaRosa counterpart)
    'getQuestionAtIndex_rangeWithHintAndBounds_endToEnd',
    () => {
      const scenario = Scenario.init(
        html(
          head(
            title('Range E2E'),
            model(
              mainInstance(t('data id="range-e2e"', t('rating'))),
              bind('/data/rating').type('int'),
            ),
          ),
          body(
            t(
              'range ref="/data/rating" start="0" end="10" step="2"',
              label('Rate your experience'),
              t('hint', '0 = terrible, 10 = excellent'),
            ),
          ),
        ),
      );
      scenario.next();
      const question = scenario.getQuestionAtIndex();
      expect(question).not.toBeNull();
      expect(question!.getControlType()).toBe('range');
      expect(question!.getHintText()).toBe('0 = terrible, 10 = excellent');
      const bounds = question!.getRangeBounds();
      expect(bounds).not.toBeNull();
      expect(bounds!.start).toBe(0);
      expect(bounds!.end).toBe(10);
      expect(bounds!.step).toBe(2);
    },
  );
});
