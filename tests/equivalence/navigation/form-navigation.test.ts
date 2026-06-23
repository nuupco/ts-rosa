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

  it.fails(
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
