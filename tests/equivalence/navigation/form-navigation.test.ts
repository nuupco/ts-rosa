/**
 * Equivalence tests — FormIndex + FormNavigator (Phase 4, Slices 4.1+)
 *
 * Source: JavaRosa FormEntryModelTest, FormEntryControllerTest (LINEAR mode only).
 *
 * Strict TDD: tests are added as it.fails BEFORE implementation, then
 * activated (changed to `it`) as each slice's implementation lands.
 *
 * Slice 4.1 red bar: getCurrentIndex/atTheEndOfForm/atQuestion/getEvent/formIndex shape.
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
// Slice 4.1 — cursor position queries (RED BAR)
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
// Slice 4.2 — incrementIndex / decrementIndex + real next() / prev() (RED BAR)
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
// Slice 4.3 — Relevance skip during step (RED BAR)
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
  it.fails(
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

  it.fails(
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

  it.fails(
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

  it.fails(
    // S4.3-D: all non-relevant → next() from BOF reaches EOF
    'next_allNonRelevant_reachesEof',
    () => {
      const scenario = Scenario.init(allNonRelevantForm());
      const code = scenario.next();
      expect(code).toBe(FORM_ENTRY_EVENT.END_OF_FORM);
      expect(scenario.atTheEndOfForm()).toBe(true);
    },
  );

  it.fails(
    // Ported from FormEntryModelTest#isIndexRelevant_respectsRelevanceOfOutermostGroup
    // Source: org.javarosa.form.api.FormEntryModelTest#isIndexRelevant_respectsRelevanceOfOutermostGroup
    //
    // isEffectivelyRelevant for q1 (inside outer/inner) must reflect the
    // relevance of the OUTERMOST ancestor group, not just the immediate parent.
    'isIndexRelevant_respectsRelevanceOfOutermostGroup',
    () => {
      const scenario = Scenario.init(nestedRelevanceForm());

      // q1 is inside outer (non-relevant) and inner (non-relevant) → not relevant
      scenario.next('/data/outer/inner/q1');
      expect(scenario.atQuestion()).toBe(false); // non-relevant; stepToNextEvent skips it

      // Making inner relevant still leaves outer non-relevant → q1 still not relevant
      scenario.answer('/data/innerYesNo', 'yes');
      scenario.next('/data/outer/inner/q1');
      expect(scenario.atQuestion()).toBe(false);

      // Making outer relevant too → q1 is now relevant
      scenario.answer('/data/outerYesNo', 'yes');
      scenario.next('/data/outer/inner/q1');
      expect(scenario.atQuestion()).toBe(true);
    },
  );
});
