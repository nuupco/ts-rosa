/**
 * Preload system tests — unit coverage for resolvePreload, frozenPreloadProvider,
 * defaultPreloadProvider, and applyPreloads.
 *
 * Provenance map (per T-VAL-4 / REQ-X-4):
 *   - uid:        // Source: QuestionPreloaderTest#preloader_preloadsElements
 *   - date/today: // ts-rosa-original (no direct date/today unit in QuestionPreloaderTest)
 *   - timestamp/start: // ts-rosa-original
 *   - timestamp/end:   // ts-rosa-original (documents finalize gap)
 *   - property/*:      // ts-rosa-original
 *   - unknown-type throw: // ts-rosa-original
 *   - date/prevperiod-*:  // ts-rosa-original
 *   - applyPreloads ordering: // ts-rosa-original
 *   - determinism:           // ts-rosa-original
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { frozenPreloadProvider, defaultPreloadProvider } from '../../src/session/PreloadProvider.ts';
import { resolvePreload } from '../../src/session/preload/resolvePreload.ts';
import { applyPreloads } from '../../src/session/preload/applyPreloads.ts';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  t,
  bind,
  input,
  title,
} from '../harness/XFormsElement.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FROZEN_DATE = new Date('2020-01-01T00:00:00.000Z');
const FROZEN_UID = '00000000-0000-4000-8000-000000000000';

function makeFrozen() {
  return frozenPreloadProvider({ now: FROZEN_DATE, uid: FROZEN_UID });
}

/** Build a minimal form XML with one preloaded field. */
function preloadForm(preloadType: string, preloadParams: string | null) {
  const bindEl = preloadParams !== null
    ? bind('/data/val').withAttribute('jr', 'preload', preloadType).withAttribute('jr', 'preloadParams', preloadParams)
    : bind('/data/val').withAttribute('jr', 'preload', preloadType);
  return html(
    head(
      title('Preload test'),
      model(
        mainInstance(t('data id="preload-test"', t('val'))),
        bindEl,
      ),
    ),
    body(input('/data/val')),
  ).asXml();
}

// ---------------------------------------------------------------------------
// resolvePreload — per-type unit tests
// ---------------------------------------------------------------------------

describe('resolvePreload', () => {
  const frozen = makeFrozen();

  // ts-rosa-original
  it('date/today returns YYYY-MM-DD from provider.now()', () => {
    const result = resolvePreload('date', 'today', frozen);
    expect(result).toBe('2020-01-01');
  });

  // ts-rosa-original
  it('timestamp/start returns ISO-8601 from provider.now()', () => {
    const result = resolvePreload('timestamp', 'start', frozen);
    expect(result).toBe(FROZEN_DATE.toISOString());
  });

  // ts-rosa-original — timestamp/end resolves via provider.now() too; callers
  // re-invoke this (via applyEndPreloads/FormSession.finalize) at submission
  // time so the value reflects form-close time, not form-open time.
  it('timestamp/end returns ISO-8601 from provider.now()', () => {
    const result = resolvePreload('timestamp', 'end', frozen);
    expect(result).toBe(FROZEN_DATE.toISOString());
  });

  // Source: QuestionPreloaderTest#preloader_preloadsElements
  it('uid returns "uuid:" + provider.uid()', () => {
    const result = resolvePreload('uid', null, frozen);
    expect(result).toBe(`uuid:${FROZEN_UID}`);
  });

  // ts-rosa-original
  it('property/deviceid returns provider.property("deviceid")', () => {
    const p = frozenPreloadProvider({
      now: FROZEN_DATE,
      uid: FROZEN_UID,
      properties: { deviceid: 'test-device-001' },
    });
    const result = resolvePreload('property', 'deviceid', p);
    expect(result).toBe('test-device-001');
  });

  // ts-rosa-original
  it('property/username returns provider.property("username")', () => {
    const p = frozenPreloadProvider({
      now: FROZEN_DATE,
      uid: FROZEN_UID,
      properties: { username: 'tester' },
    });
    const result = resolvePreload('property', 'username', p);
    expect(result).toBe('tester');
  });

  // ts-rosa-original
  it('property/email returns provider.property("email")', () => {
    const p = frozenPreloadProvider({
      now: FROZEN_DATE,
      uid: FROZEN_UID,
      properties: { email: 'test@example.com' },
    });
    const result = resolvePreload('property', 'email', p);
    expect(result).toBe('test@example.com');
  });

  // ts-rosa-original
  it('property/phonenumber returns provider.property("phonenumber")', () => {
    const p = frozenPreloadProvider({
      now: FROZEN_DATE,
      uid: FROZEN_UID,
      properties: { phonenumber: '+1-555-0100' },
    });
    const result = resolvePreload('property', 'phonenumber', p);
    expect(result).toBe('+1-555-0100');
  });

  // ts-rosa-original
  it('property with unknown param returns null from default provider (no-op)', () => {
    const result = resolvePreload('property', 'unknown-param', frozen);
    expect(result).toBeNull();
  });

  // ts-rosa-original
  it('unknown preload type throws with descriptive message', () => {
    expect(() => resolvePreload('unsupported-type', null, frozen)).toThrow(
      /unsupported jr:preload type: unsupported-type/,
    );
  });

  // ts-rosa-original — dedicated prevperiod test (week/mon/head boundary)
  it('date/prevperiod-week-mon-head returns a YYYY-MM-DD string', () => {
    const result = resolvePreload('date', 'prevperiod-week-mon-head', frozen);
    // Should be a date string in YYYY-MM-DD format — exact value depends on ref date
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// frozenPreloadProvider — determinism (REQ-7P-9)
// ---------------------------------------------------------------------------

describe('frozenPreloadProvider determinism', () => {
  // ts-rosa-original
  it('two separate frozenPreloadProvider instances with same opts produce identical values', () => {
    const p1 = frozenPreloadProvider({ now: FROZEN_DATE, uid: FROZEN_UID });
    const p2 = frozenPreloadProvider({ now: FROZEN_DATE, uid: FROZEN_UID });

    expect(resolvePreload('date', 'today', p1)).toBe(resolvePreload('date', 'today', p2));
    expect(resolvePreload('timestamp', 'start', p1)).toBe(resolvePreload('timestamp', 'start', p2));
    expect(resolvePreload('uid', null, p1)).toBe(resolvePreload('uid', null, p2));
  });

  // ts-rosa-original
  it('frozen now() always returns the fixed date', () => {
    const p = frozenPreloadProvider({ now: FROZEN_DATE });
    expect(p.now()).toBe(FROZEN_DATE);
    expect(p.now()).toBe(FROZEN_DATE);
  });

  // ts-rosa-original
  it('frozen uid() always returns the seeded value', () => {
    const p = frozenPreloadProvider({ uid: FROZEN_UID });
    expect(p.uid()).toBe(FROZEN_UID);
    expect(p.uid()).toBe(FROZEN_UID);
  });

  // ts-rosa-original
  it('frozenPreloadProvider with no opts uses sensible defaults', () => {
    const p = frozenPreloadProvider();
    // now() should return a Date
    expect(p.now()).toBeInstanceOf(Date);
    // uid() should return a UUID-like string
    expect(typeof p.uid()).toBe('string');
    expect(p.uid().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// defaultPreloadProvider — smoke
// ---------------------------------------------------------------------------

describe('defaultPreloadProvider', () => {
  // ts-rosa-original
  it('now() returns a Date', () => {
    expect(defaultPreloadProvider.now()).toBeInstanceOf(Date);
  });

  // ts-rosa-original
  it('uid() returns a non-empty string (UUID)', () => {
    const id = defaultPreloadProvider.uid();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  // ts-rosa-original
  it('property() returns null for unknown names', () => {
    expect(defaultPreloadProvider.property('anything')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyPreloads — integration via form session (REQ-7P-1, T-VAL-2 ordering)
// ---------------------------------------------------------------------------

describe('applyPreloads integration', () => {
  // ts-rosa-original — REQ-7P-1 end-to-end
  it('date/today node is stamped with YYYY-MM-DD from frozen provider', () => {
    const frozen = makeFrozen();
    const xml = preloadForm('date', 'today');
    const def = parseForm(xml);
    const session = createFormSession(def, { preloadProvider: frozen });

    const node = session.tree.root.children[0];
    expect(node).toBeDefined();
    // value should be a date AnswerValue with displayText '2020-01-01'
    expect(node!.value).not.toBeNull();
    expect((node!.value as { displayText: string }).displayText).toBe('2020-01-01');
  });

  // ts-rosa-original — REQ-7P-4 uid end-to-end
  it('uid node is stamped with uuid:<seeded> from frozen provider', () => {
    const frozen = makeFrozen();
    const xml = preloadForm('uid', null);
    const def = parseForm(xml);
    const session = createFormSession(def, { preloadProvider: frozen });

    const node = session.tree.root.children[0];
    expect(node).toBeDefined();
    expect((node!.value as { value: string } | null)?.value).toBe(`uuid:${FROZEN_UID}`);
  });

  // ts-rosa-original — T-VAL-2: applyPreloads runs BEFORE calculate cascade
  // A calculate that references the preloaded field should see the preloaded value
  it('calculate referencing preloaded field sees the preloaded value (ordering proof)', () => {
    const frozen = makeFrozen();
    const calcForm = html(
      head(
        title('Preload ordering'),
        model(
          mainInstance(t('data id="preload-ordering"', t('today'), t('copy'))),
          bind('/data/today').withAttribute('jr', 'preload', 'date').withAttribute('jr', 'preloadParams', 'today'),
          bind('/data/copy').calculate('/data/today'),
        ),
      ),
      body(input('/data/today'), input('/data/copy')),
    ).asXml();

    const def = parseForm(calcForm);
    const session = createFormSession(def, { preloadProvider: frozen });

    // /data/copy is a calculate that mirrors /data/today
    // If preloads run before cascade, copy should equal the preloaded date
    const copyNode = session.tree.root.children.find((c) => c.name === 'copy');
    expect(copyNode).toBeDefined();
    expect((copyNode!.value as { displayText: string } | null)?.displayText).toBe('2020-01-01');
  });

  // ts-rosa-original — REQ-7P-9: determinism across two separate init calls
  it('two sessions with the same frozen provider produce identical preloaded values', () => {
    const xml = preloadForm('uid', null);
    const def = parseForm(xml);

    const frozen1 = frozenPreloadProvider({ uid: FROZEN_UID });
    const frozen2 = frozenPreloadProvider({ uid: FROZEN_UID });

    const s1 = createFormSession(def, { preloadProvider: frozen1 });
    const s2 = createFormSession(def, { preloadProvider: frozen2 });

    const v1 = (s1.tree.root.children[0]!.value as { value: string } | null)?.value;
    const v2 = (s2.tree.root.children[0]!.value as { value: string } | null)?.value;
    expect(v1).toBe(v2);
  });

  // ts-rosa-original — without opts, session still works (976 baseline check)
  it('createFormSession without opts uses defaultPreloadProvider (no regression)', () => {
    const xml = preloadForm('uid', null);
    const def = parseForm(xml);
    // Should not throw
    expect(() => createFormSession(def)).not.toThrow();
  });

  // ts-rosa-original — finalize-end-preloads: `end` must reflect close time,
  // not open time (the bug this suite exists to guard against).
  it('finalize() re-resolves timestamp/end to close-time, distinct from open-time', () => {
    const OPEN = new Date('2020-01-01T00:00:00.000Z');
    const CLOSE = new Date('2020-01-01T00:05:00.000Z');
    let current = OPEN;
    const provider = {
      now: () => current,
      uid: () => FROZEN_UID,
      property: () => null,
    };

    const xml = preloadForm('timestamp', 'end');
    const def = parseForm(xml);
    const session = createFormSession(def, { preloadProvider: provider });

    const node = session.tree.root.children[0]!;
    // At session creation, 'end' resolves too (JR resolves it once more at
    // finalize; it is not left unset at open time in this implementation).
    expect((node.value as { displayText: string } | null)?.displayText).toBe(OPEN.toISOString());

    current = CLOSE;
    session.finalize();

    expect((node.value as { displayText: string } | null)?.displayText).toBe(CLOSE.toISOString());
  });
});
