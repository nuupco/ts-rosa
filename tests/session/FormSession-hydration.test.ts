/**
 * Unit / integration tests — createFormSession(definition, { instanceXml })
 *
 * sdd/instance-editing-hydration, PR2, tasks 12-21.
 *
 * Covers: regression guard for the `tree` variable refactor (task 12/13),
 * the `instanceXml` option (task 14), preload-skip on hydration (task 15),
 * DAG cascade over loaded data / calculate always wins (task 16),
 * relevance/constraint reflecting loaded answers (task 17), initial cursor
 * position (task 18), export wiring (task 19), and end-to-end
 * HydrationError propagation through the public API (task 20).
 */

import { describe, it, expect } from 'vitest';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { frozenPreloadProvider } from '../../src/session/PreloadProvider.ts';
import { HydrationError, hydrateInstance } from '../../src/model/instance/InstanceHydrator.ts';
import { isBof } from '../../src/session/FormIndex.ts';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  bind,
  input,
  t,
  title,
} from '../harness/XFormsElement.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function simpleForm() {
  return html(
    head(
      title('Simple'),
      model(
        mainInstance(t('data id="simple"', t('a'), t('b'))),
        bind('/data/a').type('int'),
        bind('/data/b').type('string'),
      ),
    ),
    body(input('/data/a'), input('/data/b')),
  ).asXml();
}

function preloadForm() {
  return html(
    head(
      title('Preload'),
      model(
        mainInstance(t('data id="preload"', t('val'))),
        bind('/data/val').withAttribute('jr', 'preload', 'timestamp').withAttribute('jr', 'preloadParams', 'start'),
      ),
    ),
    body(input('/data/val')),
  ).asXml();
}

function calculateForm() {
  return html(
    head(
      title('Calculate'),
      model(
        mainInstance(t('data id="calc"', t('a'), t('doubled'))),
        bind('/data/a').type('int'),
        bind('/data/doubled').type('int').calculate('/data/a * 2'),
      ),
    ),
    body(input('/data/a')),
  ).asXml();
}

function relevanceForm() {
  return html(
    head(
      title('Relevance'),
      model(
        mainInstance(t('data id="rel"', t('trigger'), t('dependent'))),
        bind('/data/trigger').type('string'),
        bind('/data/dependent').type('string').relevant("/data/trigger = 'yes'"),
      ),
    ),
    body(input('/data/trigger'), input('/data/dependent')),
  ).asXml();
}

// ---------------------------------------------------------------------------
// Task 12/13: regression guard — behavior unchanged when instanceXml absent
// ---------------------------------------------------------------------------

describe('createFormSession — regression guard (no instanceXml)', () => {
  // ts-rosa-original — proves the `tree` variable refactor is behavior-neutral
  it('produces identical tree/cursor/values with and without the refactor path', () => {
    const def = parseForm(simpleForm());

    const session = createFormSession(def);

    expect(session.tree).toBe(def.mainInstance);
    expect(session.tree.root.name).toBe('data');
    const a = session.tree.root.children.find((c) => c.name === 'a');
    const b = session.tree.root.children.find((c) => c.name === 'b');
    expect(a?.value).toBeNull();
    expect(b?.value).toBeNull();
    expect(isBof(session.navigator.getCurrentIndex())).toBe(true);
  });

  // ts-rosa-original — full existing suite is the broader regression guard;
  // this asserts createFormSession without opts still works end to end.
  it('createFormSession(definition) with no opts at all does not throw', () => {
    const def = parseForm(simpleForm());
    expect(() => createFormSession(def)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Task 14: instanceXml option
// ---------------------------------------------------------------------------

describe('createFormSession — instanceXml option', () => {
  // ts-rosa-original
  it('accepts an instanceXml option and hydrates the session tree from it', () => {
    const def = parseForm(simpleForm());
    const xml = '<data id="simple"><a>42</a><b>hello</b></data>';

    const session = createFormSession(def, { instanceXml: xml });

    const a = session.tree.root.children.find((c) => c.name === 'a');
    const b = session.tree.root.children.find((c) => c.name === 'b');
    expect(a?.value).toEqual({ kind: 'int', value: 42, displayText: '42' });
    expect(b?.value).toEqual({ kind: 'string', value: 'hello', displayText: 'hello' });
  });

  // ts-rosa-original — ADR-A: hydration clones, does not mutate the definition
  it('does not mutate definition.mainInstance when hydrating', () => {
    const def = parseForm(simpleForm());
    const xml = '<data id="simple"><a>42</a><b>hello</b></data>';

    const session = createFormSession(def, { instanceXml: xml });

    expect(session.tree).not.toBe(def.mainInstance);
    const defA = def.mainInstance.root.children.find((c) => c.name === 'a');
    expect(defA?.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 15: preloads skipped in hydration mode (ADR-C)
// ---------------------------------------------------------------------------

describe('createFormSession — preloads skipped on hydration (ADR-C)', () => {
  // ts-rosa-original — REQ: preloaded timestamp preserved
  it('preserves a loaded jr:preload value instead of overwriting it with a fresh one', () => {
    const def = parseForm(preloadForm());
    const loadedTimestamp = '2019-06-01T00:00:00.000Z';
    const xml = `<data id="preload"><val>${loadedTimestamp}</val></data>`;
    const frozen = frozenPreloadProvider({ now: new Date('2020-01-01T00:00:00.000Z') });

    const session = createFormSession(def, { instanceXml: xml, preloadProvider: frozen });

    const val = session.tree.root.children.find((c) => c.name === 'val');
    expect((val?.value as { displayText: string } | null)?.displayText).toBe(loadedTimestamp);
  });
});

// ---------------------------------------------------------------------------
// Task 16/17: full DAG cascade over loaded data
// ---------------------------------------------------------------------------

describe('createFormSession — DAG cascade over loaded data', () => {
  // ts-rosa-original — decision 1: calculate always wins over loaded values
  it('recomputes calculate nodes from loaded data rather than keeping the stale loaded value', () => {
    const def = parseForm(calculateForm());
    // loaded XML has a stale/incorrect "doubled" value that does not match a*2
    const xml = '<data id="calc"><a>5</a><doubled>999</doubled></data>';

    const session = createFormSession(def, { instanceXml: xml });

    const doubled = session.tree.root.children.find((c) => c.name === 'doubled');
    expect((doubled?.value as { value: number } | null)?.value).toBe(10);
  });

  // ts-rosa-original — relevance reflects loaded answers
  it('computes relevance from loaded answers via the standard cascade', () => {
    const def = parseForm(relevanceForm());
    const xml = "<data id=\"rel\"><trigger>yes</trigger><dependent>shown</dependent></data>";

    const session = createFormSession(def, { instanceXml: xml });

    const dependentNode = session.tree.root.children.find((c) => c.name === 'dependent')!;
    expect(session.evaluator.isNodeRelevant(dependentNode)).toBe(true);
  });

  it('computes relevance as false when loaded trigger does not satisfy the relevant expression', () => {
    const def = parseForm(relevanceForm());
    const xml = "<data id=\"rel\"><trigger>no</trigger><dependent>hidden</dependent></data>";

    const session = createFormSession(def, { instanceXml: xml });

    const dependentNode = session.tree.root.children.find((c) => c.name === 'dependent')!;
    expect(session.evaluator.isNodeRelevant(dependentNode)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 18: initial cursor position
// ---------------------------------------------------------------------------

describe('createFormSession — initial cursor position on hydration', () => {
  // ts-rosa-original — cursor starts at beginning-of-form regardless of loaded data
  it('starts the cursor at beginning-of-form with mixed valid/invalid loaded answers', () => {
    const def = parseForm(simpleForm());
    // "Mixed valid/invalid" here means one answered, one unanswered node —
    // cast failures are covered separately (InstanceHydrator tests, PR1).
    const xml = '<data id="simple"><a>1</a></data>';

    const session = createFormSession(def, { instanceXml: xml });

    expect(isBof(session.navigator.getCurrentIndex())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 19: export wiring
// ---------------------------------------------------------------------------

describe('export wiring — hydrateInstance / HydrationError', () => {
  // ts-rosa-original
  it('re-exports hydrateInstance and HydrationError from the session barrel', async () => {
    const sessionBarrel = await import('../../src/session/index.ts');
    expect(sessionBarrel.hydrateInstance).toBe(hydrateInstance);
    expect(sessionBarrel.HydrationError).toBe(HydrationError);
  });

  // ts-rosa-original
  it('re-exports hydrateInstance and HydrationError from the package root', async () => {
    const rootBarrel = await import('../../src/index.ts');
    expect(rootBarrel.hydrateInstance).toBe(hydrateInstance);
    expect(rootBarrel.HydrationError).toBe(HydrationError);
  });
});

// ---------------------------------------------------------------------------
// Task 20: end-to-end HydrationError propagation through createFormSession
// ---------------------------------------------------------------------------

describe('createFormSession — HydrationError propagation (end-to-end)', () => {
  // ts-rosa-original
  it('propagates a root-name-mismatch HydrationError through the public createFormSession API', () => {
    const def = parseForm(simpleForm());
    const xml = '<other id="simple"><a>1</a></other>';

    expect(() => createFormSession(def, { instanceXml: xml })).toThrow(HydrationError);
    expect(() => createFormSession(def, { instanceXml: xml })).toThrow(/root mismatch/);
  });

  // ts-rosa-original
  it('propagates an unknown-extra-node HydrationError through the public createFormSession API', () => {
    const def = parseForm(simpleForm());
    const xml = '<data id="simple"><a>1</a><b>x</b><surprise>oops</surprise></data>';

    expect(() => createFormSession(def, { instanceXml: xml })).toThrow(HydrationError);
    expect(() => createFormSession(def, { instanceXml: xml })).toThrow(/\/data\/surprise/);
  });
});
