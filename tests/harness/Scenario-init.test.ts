/**
 * Tests for Scenario.init and Scenario.answerOf real implementation.
 * (T-1.4.7 RED → T-1.4.8 GREEN)
 *
 * These tests are SEPARATE from Scenario.test.ts (which must not be modified
 * to test the init/answerOf behavior).
 */

import { describe, it, expect } from 'vitest';
import { Scenario } from './Scenario.ts';
import { html, head, body, model, mainInstance, bind, input, t, label } from './XFormsElement.ts';

// ---------------------------------------------------------------------------
// Forms for testing
// ---------------------------------------------------------------------------

const formWithAlice = html(
  head(
    model(
      mainInstance(
        t('data id="alice"', t('name', 'Alice'))
      ),
      bind('/data/name').type('string')
    )
  ),
  body(
    input('/data/name', label('Name'))
  )
);

const formWithAge = html(
  head(
    model(
      mainInstance(
        t('data id="age"', t('age', ''))
      ),
      bind('/data/age').type('int')
    )
  ),
  body(
    input('/data/age', label('Age'))
  )
);

// ---------------------------------------------------------------------------
// Scenario.init from XFormsElement
// ---------------------------------------------------------------------------

describe('Scenario.init(XFormsElement)', () => {
  it('does not throw', () => {
    expect(() => Scenario.init(formWithAlice)).not.toThrow();
  });

  it('returns a Scenario instance', () => {
    const s = Scenario.init(formWithAlice);
    expect(s).toBeInstanceOf(Scenario);
  });
});

// ---------------------------------------------------------------------------
// Scenario.init from XML string
// ---------------------------------------------------------------------------

describe('Scenario.init(xmlString)', () => {
  it('does not throw', () => {
    const xml = formWithAlice.asXml();
    expect(() => Scenario.init(xml)).not.toThrow();
  });

  it('returns a Scenario instance', () => {
    const xml = formWithAlice.asXml();
    const s = Scenario.init(xml);
    expect(s).toBeInstanceOf(Scenario);
  });
});

// ---------------------------------------------------------------------------
// Scenario.answerOf — known path
// ---------------------------------------------------------------------------

describe('Scenario.answerOf — known path', () => {
  it('returns AnswerValue with kind=string for /data/name', () => {
    const s = Scenario.init(formWithAlice);
    const answer = s.answerOf('/data/name');
    expect(answer).not.toBeNull();
    expect(answer?.kind).toBe('string');
  });

  it('returns value "Alice" for pre-populated /data/name', () => {
    const s = Scenario.init(formWithAlice);
    const answer = s.answerOf('/data/name');
    expect(answer?.value).toBe('Alice');
  });

  it('returns AnswerValue with displayText "Alice"', () => {
    const s = Scenario.init(formWithAlice);
    const answer = s.answerOf('/data/name');
    expect(answer?.displayText).toBe('Alice');
  });
});

// ---------------------------------------------------------------------------
// Scenario.answerOf — unknown path
// ---------------------------------------------------------------------------

describe('Scenario.answerOf — unknown path', () => {
  it('returns null for non-existent path', () => {
    const s = Scenario.init(formWithAlice);
    expect(s.answerOf('/data/does_not_exist')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario.answerOf — empty leaf returns null (no answer)
// ---------------------------------------------------------------------------

describe('Scenario.answerOf — empty leaf', () => {
  it('returns null for empty int field', () => {
    const s = Scenario.init(formWithAge);
    // Empty string int node → cast('int','') → null
    expect(s.answerOf('/data/age')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unimplemented methods still throw
// ---------------------------------------------------------------------------

describe('unimplemented methods still throw', () => {
  it('next() still throws not implemented', () => {
    const s = Scenario.init(formWithAlice);
    expect(() => s.next()).toThrow(/not implemented/i);
  });

  it('prev() still throws not implemented', () => {
    const s = Scenario.init(formWithAlice);
    expect(() => s.prev()).toThrow(/not implemented/i);
  });

  it('createNewRepeat() still throws not implemented', () => {
    const s = Scenario.init(formWithAlice);
    expect(() => s.createNewRepeat()).toThrow(/not implemented/i);
  });

  it('serializeAndDeserializeForm() still throws not implemented', () => {
    const s = Scenario.init(formWithAlice);
    expect(() => s.serializeAndDeserializeForm()).toThrow(/not implemented/i);
  });
});
