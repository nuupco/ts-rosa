/**
 * Unit / integration tests — ActionRegistry construction + setvalue action
 * firing (sdd/setvalue-actions).
 *
 * PR2 (Batch 2, tasks 8-12): odk-instance-first-load / xforms-ready actions
 * fire exactly once during createFormSession, after the initial DAG cascade.
 *
 * PR3 (Batch 3, tasks 13-17): xforms-value-changed firing wired into the tail
 * of triggerTriggerables, plus the MAX_ACTION_CHAIN_DEPTH=16 runtime
 * re-entrancy guard for chained value-changed actions.
 */

import { describe, it, expect } from 'vitest';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { buildActionRegistry } from '../../src/eval/ActionRegistry.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import { cast } from '../../src/model/data/codecs.ts';
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
  setvalue,
  group,
} from '../harness/XFormsElement.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function loadActionForm() {
  return html(
    head(
      title('LoadAction'),
      model(
        mainInstance(t('data id="la"', t('a'))),
        bind('/data/a').type('string'),
        setvalue('odk-instance-first-load', '/data/a', "'default'"),
      ),
    ),
    body(input('/data/a')),
  ).asXml();
}

function loadActionAliasForm() {
  return html(
    head(
      title('LoadActionAlias'),
      model(
        mainInstance(t('data id="la"', t('a'))),
        bind('/data/a').type('string'),
        setvalue('xforms-ready', '/data/a', "'aliased'"),
      ),
    ),
    body(input('/data/a')),
  ).asXml();
}

function orderedLoadActionsForm() {
  // B depends on A's target; declared A then B — A must fire first.
  return html(
    head(
      title('OrderedLoadActions'),
      model(
        mainInstance(t('data id="ord"', t('a'), t('b'))),
        bind('/data/a').type('string'),
        bind('/data/b').type('string'),
        setvalue('odk-instance-first-load', '/data/a', "'seed'"),
        setvalue('odk-instance-first-load', '/data/b', 'concat(/data/a, "-derived")'),
      ),
    ),
    body(input('/data/a'), input('/data/b')),
  ).asXml();
}

function loadActionWithDownstreamCalculateForm() {
  return html(
    head(
      title('LoadActionWithCalc'),
      model(
        mainInstance(t('data id="calc"', t('a'), t('doubled'))),
        bind('/data/a').type('int'),
        bind('/data/doubled').type('int').calculate('/data/a * 2'),
        setvalue('odk-instance-first-load', '/data/a', '21'),
      ),
    ),
    body(input('/data/a')),
  ).asXml();
}

function loadActionNoValueBeforeForm() {
  return html(
    head(
      title('NoAction'),
      model(
        mainInstance(t('data id="none"', t('a'))),
        bind('/data/a').type('string'),
      ),
    ),
    body(input('/data/a')),
  ).asXml();
}

// ---------------------------------------------------------------------------
// Task 8: ActionRegistry construction (pure function, unit level)
// ---------------------------------------------------------------------------

describe('buildActionRegistry', () => {
  it('groups odk-instance-first-load actions into loadActions in declaration order', () => {
    const def = parseForm(orderedLoadActionsForm());
    const registry = buildActionRegistry(def.actions);

    expect(registry.loadActions).toHaveLength(2);
    expect(registry.loadActions[0]!.genericTarget.levels.map((l) => l.name)).toEqual(['data', 'a']);
    expect(registry.loadActions[1]!.genericTarget.levels.map((l) => l.name)).toEqual(['data', 'b']);
  });

  it('returns an empty registry for a form with no actions', () => {
    const def = parseForm(loadActionNoValueBeforeForm());
    const registry = buildActionRegistry(def.actions);

    expect(registry.loadActions).toHaveLength(0);
    expect(registry.valueChangedByTrigger.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tasks 9-11: session wiring + load-time firing
// ---------------------------------------------------------------------------

describe('createFormSession — load-time setvalue action firing', () => {
  it('fires an odk-instance-first-load action, writing the computed value into the target', () => {
    const def = parseForm(loadActionForm());

    const session = createFormSession(def);

    const a = session.tree.root.children.find((c) => c.name === 'a');
    expect((a?.value as { value: string } | null)?.value).toBe('default');
  });

  it('fires a setvalue action declared with the xforms-ready alias identically to odk-instance-first-load', () => {
    const def = parseForm(loadActionAliasForm());

    const session = createFormSession(def);

    const a = session.tree.root.children.find((c) => c.name === 'a');
    expect((a?.value as { value: string } | null)?.value).toBe('aliased');
  });

  it('fires load actions in declaration order so a later action observes an earlier one’s write', () => {
    const def = parseForm(orderedLoadActionsForm());

    const session = createFormSession(def);

    const a = session.tree.root.children.find((c) => c.name === 'a');
    const b = session.tree.root.children.find((c) => c.name === 'b');
    expect((a?.value as { value: string } | null)?.value).toBe('seed');
    expect((b?.value as { value: string } | null)?.value).toBe('seed-derived');
  });

  it('propagates a load action write through the DAG so downstream calculates recompute', () => {
    const def = parseForm(loadActionWithDownstreamCalculateForm());

    const session = createFormSession(def);

    const a = session.tree.root.children.find((c) => c.name === 'a');
    const doubled = session.tree.root.children.find((c) => c.name === 'doubled');
    expect((a?.value as { value: number } | null)?.value).toBe(21);
    expect((doubled?.value as { value: number } | null)?.value).toBe(42);
  });

  it('does not throw and leaves data untouched for a form with no setvalue actions', () => {
    const def = parseForm(loadActionNoValueBeforeForm());

    const session = createFormSession(def);

    const a = session.tree.root.children.find((c) => c.name === 'a');
    expect(a?.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 12: hydration / edit-mode load-action firing (design's flagged,
// unproven decision — grouped with `calculate` behavior, fires even when
// instanceXml is provided).
// ---------------------------------------------------------------------------

describe('createFormSession — load-time setvalue actions on hydrated (edit-mode) sessions', () => {
  it('fires a load-time setvalue action on a hydrated session, overwriting the loaded value (design decision: grouped with calculate, not preload)', () => {
    const def = parseForm(loadActionForm());
    const xml = '<data id="la"><a>loaded-original</a></data>';

    const session = createFormSession(def, { instanceXml: xml });

    const a = session.tree.root.children.find((c) => c.name === 'a');
    expect((a?.value as { value: string } | null)?.value).toBe('default');
  });
});

// ---------------------------------------------------------------------------
// Host-relative target (nested in body group) load-time firing sanity check —
// exercises the b9ed472 child-of-host resolution fix end-to-end with real
// firing, not just parse-time ref resolution.
// ---------------------------------------------------------------------------

describe('createFormSession — load-time setvalue action with host-relative target', () => {
  it('writes to the correct child-of-host node when the setvalue ref is host-relative', () => {
    const form = html(
      head(
        title('HostRelative'),
        model(
          mainInstance(t('data id="hr"', t('g', t('a')))),
          bind('/data/g/a').type('string'),
        ),
      ),
      body(group('/data/g', setvalue('odk-instance-first-load', 'a', "'child-write'"), input('/data/g/a'))),
    ).asXml();
    const def = parseForm(form);

    const session = createFormSession(def);

    const g = session.tree.root.children.find((c) => c.name === 'g');
    const a = g?.children.find((c) => c.name === 'a');
    expect((a?.value as { value: string } | null)?.value).toBe('child-write');
  });
});

// ---------------------------------------------------------------------------
// PR3 — Batch 3, tasks 13-15: xforms-value-changed firing at the tail of
// triggerTriggerables.
// ---------------------------------------------------------------------------

describe('createFormSession — xforms-value-changed action firing', () => {
  it('fires a value-changed action when its host control ref changes via answerQuestion', () => {
    const form = html(
      head(
        title('ValueChanged'),
        model(
          mainInstance(t('data id="vc"', t('source'), t('destination'))),
          bind('/data/source').type('int'),
          bind('/data/destination').type('int'),
        ),
      ),
      body(input('/data/source', setvalue('xforms-value-changed', '/data/destination', '4*4'))),
    ).asXml();
    const def = parseForm(form);
    const session = createFormSession(def);

    session.evaluator.answerQuestion(parseAbsoluteRef('/data/source'), cast('int', '22'));

    const destination = session.tree.root.children.find((c) => c.name === 'destination');
    expect((destination?.value as { value: number } | null)?.value).toBe(16);
  });

  it('propagates a value-changed action write through the DAG so downstream calculates recompute', () => {
    const form = html(
      head(
        title('ValueChangedCascade'),
        model(
          mainInstance(t('data id="vcc"', t('source'), t('destination'), t('doubled'))),
          bind('/data/source').type('int'),
          bind('/data/destination').type('int'),
          bind('/data/doubled').type('int').calculate('/data/destination * 2'),
        ),
      ),
      body(input('/data/source', setvalue('xforms-value-changed', '/data/destination', '/data/source * 3'))),
    ).asXml();
    const def = parseForm(form);
    const session = createFormSession(def);

    session.evaluator.answerQuestion(parseAbsoluteRef('/data/source'), cast('int', '5'));

    const destination = session.tree.root.children.find((c) => c.name === 'destination');
    const doubled = session.tree.root.children.find((c) => c.name === 'doubled');
    expect((destination?.value as { value: number } | null)?.value).toBe(15);
    expect((doubled?.value as { value: number } | null)?.value).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// PR3 — Batch 3, tasks 16-17: MAX_ACTION_CHAIN_DEPTH=16 runtime guard.
// ---------------------------------------------------------------------------

describe('setvalue action chain depth guard (MAX_ACTION_CHAIN_DEPTH=16)', () => {
  it('completes a short (2-3 action) legitimate chain without hitting the guard', () => {
    // a -> b -> c, three value-changed actions chained, no cycle.
    const form = html(
      head(
        title('ShortChain'),
        model(
          mainInstance(t('data id="chain"', t('a'), t('b'), t('c'))),
          bind('/data/a').type('int'),
          bind('/data/b').type('int'),
          bind('/data/c').type('int'),
        ),
      ),
      body(
        input('/data/a', setvalue('xforms-value-changed', '/data/b', '/data/a + 1')),
        input('/data/b', setvalue('xforms-value-changed', '/data/c', '/data/b + 1')),
        input('/data/c'),
      ),
    ).asXml();
    const def = parseForm(form);
    const session = createFormSession(def);

    expect(() =>
      session.evaluator.answerQuestion(parseAbsoluteRef('/data/a'), cast('int', '1')),
    ).not.toThrow();

    const b = session.tree.root.children.find((c) => c.name === 'b');
    const c = session.tree.root.children.find((c) => c.name === 'c');
    expect((b?.value as { value: number } | null)?.value).toBe(2);
    expect((c?.value as { value: number } | null)?.value).toBe(3);
  });

  it('throws a clear error when a chain of value-changed actions forms an unbounded cycle', () => {
    // a's host action writes b (b = a+1); b's host action writes a (a = b+1) — a genuine
    // runaway cycle with no fixed point, must be bounded by MAX_ACTION_CHAIN_DEPTH.
    const form = html(
      head(
        title('Cycle'),
        model(
          mainInstance(t('data id="cycle"', t('a'), t('b'))),
          bind('/data/a').type('int'),
          bind('/data/b').type('int'),
        ),
      ),
      body(
        input('/data/a', setvalue('xforms-value-changed', '/data/b', '/data/a + 1')),
        input('/data/b', setvalue('xforms-value-changed', '/data/a', '/data/b + 1')),
      ),
    ).asXml();
    const def = parseForm(form);
    const session = createFormSession(def);

    expect(() =>
      session.evaluator.answerQuestion(parseAbsoluteRef('/data/a'), cast('int', '1')),
    ).toThrow(/max depth|cycle/i);
  });
});

describe('xforms-revalidate action (FormSession.finalize)', () => {
  it('does not fire at session creation, only from finalize()', () => {
    const form = html(
      head(
        title('Revalidate'),
        model(
          mainInstance(t('data id="rv"', t('a'))),
          bind('/data/a').type('string'),
          setvalue('xforms-revalidate', '/data/a', "'finalized'"),
        ),
      ),
      body(input('/data/a')),
    ).asXml();
    const def = parseForm(form);
    const session = createFormSession(def);

    const node = session.tree.root.children.find((c) => c.name === 'a');
    expect(node?.value).toBeNull();

    session.finalize();
    expect((node?.value as { value: string } | null)?.value).toBe('finalized');
  });

  it('fires exactly once per finalize() call, in declaration order', () => {
    const form = html(
      head(
        title('RevalidateOrder'),
        model(
          mainInstance(t('data id="rvo"', t('a'), t('b'))),
          bind('/data/a').type('int'),
          bind('/data/b').type('int'),
          setvalue('xforms-revalidate', '/data/a', '1'),
          setvalue('xforms-revalidate', '/data/b', '/data/a + 1'),
        ),
      ),
      body(input('/data/a'), input('/data/b')),
    ).asXml();
    const def = parseForm(form);
    const session = createFormSession(def);

    session.finalize();

    const a = session.tree.root.children.find((c) => c.name === 'a');
    const b = session.tree.root.children.find((c) => c.name === 'b');
    expect((a?.value as { value: number } | null)?.value).toBe(1);
    expect((b?.value as { value: number } | null)?.value).toBe(2);
  });
});
