/**
 * Tests for Scenario.init fixture-file-loading branch + trace() + refAtIndex genericize.
 *
 * T-INFRA-B-1 [RED BAR] → T-INFRA-B-2 [GREEN]
 *
 * Covers:
 *  - filename branch loads XML from tests/fixtures/
 *  - raw-XML branch (no '<') check: existing callers unaffected
 *  - missing fixture throws a clear error
 *  - trace() does not throw
 *  - refAtIndex().genericize() returns a TreeReference (refToString works)
 */

import { describe, it, expect } from 'vitest';
import { Scenario } from './Scenario.ts';
import { html, head, body, model, mainInstance, bind, input, t, label } from './XFormsElement.ts';
import { genericize, refToString } from '../../src/model/instance/TreeReference.ts';

// A minimal form we can use for navigation tests (has a real question)
const simpleForm = html(
  head(
    model(
      mainInstance(
        t('data id="simple"', t('name', ''))
      ),
      bind('/data/name').type('string')
    )
  ),
  body(
    input('/data/name', label('Name'))
  )
);

// ---------------------------------------------------------------------------
// Filename branch — loads from tests/fixtures/
// ---------------------------------------------------------------------------

describe('Scenario.init(filename)', () => {
  it('loads simple-form.xml from tests/fixtures/ without throwing', () => {
    expect(() => Scenario.init('simple-form.xml')).not.toThrow();
  });

  it('returns a Scenario instance', () => {
    const s = Scenario.init('simple-form.xml');
    expect(s).toBeInstanceOf(Scenario);
  });

  it('form2.xml also loads without throwing', () => {
    expect(() => Scenario.init('form2.xml')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Discriminator: raw-XML callers are not broken
// ---------------------------------------------------------------------------

describe('Scenario.init discriminator — raw XML unchanged', () => {
  it('raw XML string (contains "<") still works', () => {
    const xml = simpleForm.asXml();
    expect(xml).toContain('<');
    const s = Scenario.init(xml);
    expect(s).toBeInstanceOf(Scenario);
  });

  it('XFormsElement overload still works', () => {
    const s = Scenario.init(simpleForm);
    expect(s).toBeInstanceOf(Scenario);
  });
});

// ---------------------------------------------------------------------------
// Missing fixture throws a clear error
// ---------------------------------------------------------------------------

describe('Scenario.init(filename) — missing fixture', () => {
  it('throws a descriptive error for a non-existent fixture', () => {
    expect(() => Scenario.init('does_not_exist.xml')).toThrow(/does_not_exist\.xml/);
  });
});

// ---------------------------------------------------------------------------
// trace() does not throw
// ---------------------------------------------------------------------------

describe('Scenario.trace()', () => {
  it('does not throw', () => {
    const s = Scenario.init(simpleForm);
    expect(() => s.trace('waypoint reached')).not.toThrow();
  });

  it('can be called multiple times without throwing', () => {
    const s = Scenario.init(simpleForm);
    expect(() => {
      s.trace('step 1');
      s.trace('step 2');
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// refAtIndex().genericize() returns a TreeReference
// ---------------------------------------------------------------------------

describe('Scenario.refAtIndex() genericize', () => {
  it('returns non-null after navigating to a question', () => {
    const s = Scenario.init(simpleForm);
    s.next(); // move to first question
    const ref = s.refAtIndex();
    expect(ref).not.toBeNull();
  });

  it('genericize() produces a string via refToString', () => {
    const s = Scenario.init(simpleForm);
    s.next();
    const ref = s.refAtIndex();
    expect(ref).not.toBeNull();
    // ADR-6: refAtIndex must return a real TreeReference that genericize() accepts
    const generic = genericize(ref!);
    expect(typeof refToString(generic)).toBe('string');
  });

  it('genericized ref matches the expected path', () => {
    const s = Scenario.init(simpleForm);
    s.next();
    const ref = s.refAtIndex();
    expect(ref).not.toBeNull();
    const genericStr = refToString(genericize(ref!));
    // genericize sets multiplicity to INDEX_UNBOUND (-1); refToString omits the bracket for negative values
    expect(genericStr).toBe('/data/name');
  });

  it('returns null at end of form', () => {
    const s = Scenario.init(simpleForm);
    s.next(); // question
    s.next(); // EOF
    const ref = s.refAtIndex();
    expect(ref).toBeNull();
  });
});
