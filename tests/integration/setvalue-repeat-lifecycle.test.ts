/**
 * Integration tests — sdd/setvalue-parity PR3 (Layer C: repeat lifecycle
 * fire points, tasks 16-19).
 *
 * Covers:
 *  16. odk-new-repeat fires once per new repeat instance, scoped to that
 *      instance's subtree, before the DAG cascade.
 *  17. jr-insert fires before odk-new-repeat, model-level only, does not
 *      re-fire on the new instance's own controller.
 *  18. Chain-depth guard (MAX_ACTION_CHAIN_DEPTH=16) bounds a runaway
 *      setvalue cycle initiated from an odk-new-repeat action.
 *  19. No new TriggerableDag vertex is created by these dispatches (ADR-1)
 *      and constraint gating stays bypassed for setvalue (ADR-3).
 */

import { describe, it, expect } from 'vitest';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import { addRepeatInstance } from '../../src/model/instance/InstanceTree.ts';
import { INDEX_TEMPLATE } from '../../src/model/instance/multiplicity.ts';
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
  repeat,
} from '../harness/XFormsElement.ts';

/** Mirrors FormNavigator.createModelIfNecessary's repeat-instance creation. */
function addRepeatAndInitialize(session: ReturnType<typeof createFormSession>, xPath: string): void {
  const ref = parseAbsoluteRef(xPath);
  const node = addRepeatInstance(session.tree, ref);
  if (node === null) throw new Error(`could not add repeat instance at ${xPath}`);
  const index = node.multiplicity;
  const concreteRef = parseAbsoluteRef(`${xPath}[${index + 1}]`);
  session.evaluator.initializeRepeatInstance(concreteRef);
}

// ---------------------------------------------------------------------------
// Task 16: odk-new-repeat fires once per new instance, scoped
// ---------------------------------------------------------------------------

function newRepeatForm() {
  return html(
    head(
      title('NewRepeat'),
      model(
        mainInstance(t('data id="nr"', t('reps jr:template=""', t('x')))),
        bind('/data/reps/x').type('string'),
      ),
    ),
    body(repeat('/data/reps', input('./x'), setvalue('odk-new-repeat', './x', "'default'"))),
  ).asXml();
}

describe('odk-new-repeat fire point', () => {
  it('fires once per new repeat instance, writing only into that instance', () => {
    const def = parseForm(newRepeatForm());
    const session = createFormSession(def);

    addRepeatAndInitialize(session, '/data/reps');
    addRepeatAndInitialize(session, '/data/reps');

    const reps = session.tree.root.children.filter((c) => c.name === 'reps' && c.multiplicity !== INDEX_TEMPLATE);
    expect(reps).toHaveLength(2);
    for (const rep of reps) {
      const x = rep.children.find((c) => c.name === 'x');
      expect((x?.value as { value: string } | null)?.value).toBe('default');
    }
  });

  it('does not write into an existing sibling instance when a new one is created', () => {
    const def = parseForm(newRepeatForm());
    const session = createFormSession(def);

    addRepeatAndInitialize(session, '/data/reps');
    const firstRep = session.tree.root.children.find((c) => c.name === 'reps' && c.multiplicity !== INDEX_TEMPLATE)!;
    const firstX = firstRep.children.find((c) => c.name === 'x')!;
    firstX.value = { value: 'edited-by-user' } as never;

    addRepeatAndInitialize(session, '/data/reps');

    const reps = session.tree.root.children.filter((c) => c.name === 'reps' && c.multiplicity !== INDEX_TEMPLATE);
    expect((reps[0]!.children.find((c) => c.name === 'x')?.value as { value: string } | null)?.value).toBe(
      'edited-by-user',
    );
    expect((reps[1]!.children.find((c) => c.name === 'x')?.value as { value: string } | null)?.value).toBe(
      'default',
    );
  });
});

// ---------------------------------------------------------------------------
// Task 17: jr-insert fires before odk-new-repeat, model-level only
// ---------------------------------------------------------------------------

function jrInsertOrderingForm() {
  return html(
    head(
      title('JrInsertOrdering'),
      model(
        mainInstance(t('data id="ji"', t('log'), t('reps jr:template=""', t('y')))),
        bind('/data/log').type('string'),
        bind('/data/reps/y').type('string'),
        setvalue('jr-insert', '/data/log', "concat(/data/log, 'jr-insert;')"),
      ),
    ),
    body(repeat('/data/reps', input('./y'), setvalue('odk-new-repeat', './y', "concat(/data/log, 'new-repeat')"))),
  ).asXml();
}

describe('jr-insert fire point', () => {
  it('fires before odk-new-repeat and observably at model level', () => {
    const def = parseForm(jrInsertOrderingForm());
    const session = createFormSession(def);

    addRepeatAndInitialize(session, '/data/reps');

    const log = session.tree.root.children.find((c) => c.name === 'log');
    expect((log?.value as { value: string } | null)?.value).toBe('jr-insert;');

    const rep = session.tree.root.children.find((c) => c.name === 'reps' && c.multiplicity !== INDEX_TEMPLATE)!;
    const y = rep.children.find((c) => c.name === 'y');
    // odk-new-repeat's value expr reads /data/log AFTER jr-insert already wrote it.
    expect((y?.value as { value: string } | null)?.value).toBe('jr-insert;new-repeat');
  });

  it('does not fire jr-insert a second time for the new instance itself', () => {
    const def = parseForm(jrInsertOrderingForm());
    const session = createFormSession(def);

    addRepeatAndInitialize(session, '/data/reps');
    addRepeatAndInitialize(session, '/data/reps');

    const log = session.tree.root.children.find((c) => c.name === 'log');
    // Fired exactly twice total (once per new-repeat creation), never doubled
    // by a per-instance re-fire.
    expect((log?.value as { value: string } | null)?.value).toBe('jr-insert;jr-insert;');
  });

  it('rejects jr-insert declared on a body-nested setvalue at parse time', () => {
    const form = html(
      head(
        title('BadJrInsert'),
        model(mainInstance(t('data id="bad"', t('reps jr:template=""', t('y')))), bind('/data/reps/y').type('string')),
      ),
      body(repeat('/data/reps', input('./y'), setvalue('jr-insert', './y', "'x'"))),
    ).asXml();

    expect(() => parseForm(form)).toThrow(/jr-insert/);
  });
});

// ---------------------------------------------------------------------------
// Task 18: chain-depth guard bounds a cycle initiated from odk-new-repeat
// ---------------------------------------------------------------------------

describe('odk-new-repeat action chain depth guard (MAX_ACTION_CHAIN_DEPTH=16)', () => {
  it('bounds a runaway xforms-value-changed cycle triggered from an odk-new-repeat write, without hanging', () => {
    const form = html(
      head(
        title('NewRepeatCycle'),
        model(
          mainInstance(t('data id="nrc"', t('a'), t('b'), t('reps jr:template=""', t('x')))),
          bind('/data/a').type('int'),
          bind('/data/b').type('int'),
          bind('/data/reps/x').type('string'),
        ),
      ),
      body(
        input('/data/a', setvalue('xforms-value-changed', '/data/b', '/data/a + 1')),
        input('/data/b', setvalue('xforms-value-changed', '/data/a', '/data/b + 1')),
        repeat('/data/reps', input('./x'), setvalue('odk-new-repeat', '/data/a', '1')),
      ),
    ).asXml();
    const def = parseForm(form);
    const session = createFormSession(def);

    expect(() => addRepeatAndInitialize(session, '/data/reps')).toThrow(/max depth|cycle/i);
  });
});

// ---------------------------------------------------------------------------
// Task 19: ADR-1 (no new DAG vertex) / ADR-3 (constraint gating bypassed)
// ---------------------------------------------------------------------------

describe('odk-new-repeat / jr-insert dispatch stays outside the DAG (ADR-1) and bypasses constraint gating (ADR-3)', () => {
  it('does not add a new TriggerableDag vertex for the fired actions', () => {
    const def = parseForm(newRepeatForm());
    const session = createFormSession(def);
    const dag = (session.evaluator as unknown as { dag: { triggerablesDAG: readonly unknown[] } | null }).dag;
    const vertexCountBefore = dag?.triggerablesDAG.length ?? 0;

    addRepeatAndInitialize(session, '/data/reps');

    const vertexCountAfter = dag?.triggerablesDAG.length ?? 0;
    expect(vertexCountAfter).toBe(vertexCountBefore);
  });

  it('writes the odk-new-repeat target even when it would fail an unrelated constraint on that field', () => {
    const form = html(
      head(
        title('ConstraintBypass'),
        model(
          mainInstance(t('data id="cb"', t('reps jr:template=""', t('x')))),
          bind('/data/reps/x').type('string').constraint(". = 'never-matches'"),
        ),
      ),
      body(repeat('/data/reps', input('./x'), setvalue('odk-new-repeat', './x', "'default'"))),
    ).asXml();
    const def = parseForm(form);
    const session = createFormSession(def);

    expect(() => addRepeatAndInitialize(session, '/data/reps')).not.toThrow();

    const rep = session.tree.root.children.find((c) => c.name === 'reps' && c.multiplicity !== INDEX_TEMPLATE)!;
    const x = rep.children.find((c) => c.name === 'x');
    expect((x?.value as { value: string } | null)?.value).toBe('default');
  });
});
