/**
 * Unit / equivalence tests — FormNavigator.deleteRepeat(idx?)
 *
 * sdd/repeat-removal-wiring, tasks T2-T5.
 *
 * deleteRepeat composes the existing removeRepeatInstance (data layer) +
 * triggerRepeatRemoval (DAG cascade) into a public navigator method, plus
 * JavaRosa-pinned cursor re-mapping (design decision 3, cases a-d) and
 * validation/rejection paths (spec "Resolve target repeat from idx",
 * "jr:count-bound repeats reject manual deletion").
 *
 * ts-rosa-original (no JavaRosa source vendored in this repo; cursor
 * semantics are pinned per the design artifact's documented JavaRosa
 * FormEntryController.deleteRepeat / FormDef.deleteRepeat analysis, not a
 * line-by-line port).
 */

import { describe, it, expect } from 'vitest';
import { createFormSession, type FormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { addRepeatInstance } from '../../src/model/instance/InstanceTree.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import { INDEX_TEMPLATE } from '../../src/model/instance/multiplicity.ts';
import { intValue } from '../../src/model/data/codecs.ts';
import type { InstanceNode } from '../../src/model/instance/InstanceNode.ts';
import { FORM_ENTRY_EVENT } from '../../src/session/FormEntryEvent.ts';
import { atIndex, type AtFormIndex } from '../../src/session/FormIndex.ts';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  bind,
  input,
  repeat,
  t,
  title,
} from '../harness/XFormsElement.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mirrors Scenario.createNewRepeat, without going through the Scenario harness. */
function addRepeat(session: FormSession, xPath: string): void {
  const ref = parseAbsoluteRef(xPath);
  const node = addRepeatInstance(session.tree, ref);
  if (node === null) throw new Error(`addRepeat: could not add instance at ${xPath}`);
  const instances = (() => {
    const parent = node.parent;
    if (!parent) return 0;
    return parent.children.filter(
      (c) => c.name === node.name && c.multiplicity !== -2 /* INDEX_TEMPLATE */,
    ).length - 1;
  })();
  const concreteRef = parseAbsoluteRef(`${xPath}[${instances + 1}]`);
  session.evaluator.initializeRepeatInstance(concreteRef);
}

function simpleRepeatForm() {
  return html(
    head(
      title('Simple Repeat'),
      model(
        mainInstance(t('data id="simple-repeat"', t('repeat jr:template=""', t('q')))),
        bind('/data/repeat/q').type('int'),
      ),
    ),
    body(repeat('/data/repeat', input('/data/repeat/q'))),
  );
}

function nestedRepeatForm() {
  return html(
    head(
      title('Nested Repeat'),
      model(
        mainInstance(t('data id="nested-repeat"',
          t('repeat1 jr:template=""',
            t('q1'),
            t('repeat2 jr:template=""', t('q2')),
          ),
        )),
        bind('/data/repeat1/q1').type('int'),
        bind('/data/repeat1/repeat2/q2').type('int'),
      ),
    ),
    body(
      repeat('/data/repeat1',
        input('/data/repeat1/q1'),
        repeat('/data/repeat1/repeat2', input('/data/repeat1/repeat2/q2')),
      ),
    ),
  );
}

function countBoundRepeatXml() {
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Count Bound</h:title>
    <model>
      <instance>
        <data id="count-bound">
          <n>2</n>
          <repeat>
            <q/>
          </repeat>
        </data>
      </instance>
      <bind nodeset="/data/n" type="int"/>
      <bind nodeset="/data/repeat/q" type="int"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/n"/>
    <repeat nodeset="/data/repeat" jr:count="/data/n">
      <input ref="/data/repeat/q"/>
    </repeat>
  </h:body>
</h:html>`;
}

/** Non-template repeat instances of `name` under `node` (excludes the jr:template node). */
function instancesOf(node: InstanceNode, name: string): InstanceNode[] {
  return node.children.filter((c) => c.name === name && c.multiplicity !== INDEX_TEMPLATE);
}

function initSession(form: { asXml(): string }): FormSession {
  const def = parseForm(form.asXml());
  return createFormSession(def);
}

function initSessionXml(xml: string): FormSession {
  const def = parseForm(xml);
  return createFormSession(def);
}

// ---------------------------------------------------------------------------
// T2 — happy path + cursor re-mapping
// ---------------------------------------------------------------------------

describe('FormNavigator.deleteRepeat — happy path + cursor re-mapping (design decision 3)', () => {
  it('default idx uses the current cursor (removes the instance containing it)', () => {
    const session = initSession(simpleRepeatForm());
    addRepeat(session, '/data/repeat'); // instance[1]
    addRepeat(session, '/data/repeat'); // instance[2]
    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(2);

    const idx = session.navigator.indexOf('/data/repeat[1]');
    session.navigator.jumpToIndex(idx);

    session.navigator.deleteRepeat();

    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(1);
  });

  it('explicit idx targets a different repeat instance than the cursor', () => {
    const session = initSession(simpleRepeatForm());
    addRepeat(session, '/data/repeat'); // instance[1]
    addRepeat(session, '/data/repeat'); // instance[2]

    const cursorIdx = session.navigator.indexOf('/data/repeat[1]');
    session.navigator.jumpToIndex(cursorIdx);

    const targetIdx = session.navigator.indexOf('/data/repeat[2]');
    session.navigator.deleteRepeat(targetIdx);

    // instance[1] (cursor's instance) still exists; instance[2] was removed
    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(1);
    const cursorAfter = session.navigator.getCurrentIndex() as AtFormIndex;
    // cursor unchanged: still references repeat multiplicity 0 (case c — unrelated removal)
    expect(cursorAfter.ref.levels[cursorAfter.ref.levels.length - 1]!.multiplicity).toBe(0);
  });

  it('(a) removed-instance-contains-cursor: cursor is rebuilt to the shifted-down sibling', () => {
    const session = initSession(simpleRepeatForm());
    addRepeat(session, '/data/repeat'); // instance[1]
    addRepeat(session, '/data/repeat'); // instance[2]
    addRepeat(session, '/data/repeat'); // instance[3]

    // cursor at repeat[2] (multiplicity 1)
    const idx = session.navigator.indexOf('/data/repeat[2]');
    session.navigator.jumpToIndex(idx);

    const event = session.navigator.deleteRepeat();

    // 3 instances -> 2 remain; slot 1 (0-indexed) now holds what was repeat[3]
    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(2);
    expect(event.kind).toBe('repeat');
    const at = event.index as AtFormIndex;
    expect(at.ref.levels[at.ref.levels.length - 1]!.multiplicity).toBe(1);
  });

  it('(b) sibling-shift-after-removal: cursor in a later sibling is decremented, same logical node', () => {
    const session = initSession(simpleRepeatForm());
    addRepeat(session, '/data/repeat'); // instance[1]
    addRepeat(session, '/data/repeat'); // instance[2]
    addRepeat(session, '/data/repeat'); // instance[3]

    // Tag instance[3]'s q with a distinguishing value to confirm identity after shift.
    session.evaluator.setValue(parseAbsoluteRef('/data/repeat[3]/q'), intValue(999));

    // cursor at repeat[3]/q (multiplicity 2 at the repeat level)
    const idx = session.navigator.indexOf('/data/repeat[3]/q');
    session.navigator.jumpToIndex(idx);

    // remove repeat[1] (multiplicity 0) — precedes the cursor
    const removeIdx = session.navigator.indexOf('/data/repeat[1]');
    const event = session.navigator.deleteRepeat(removeIdx);

    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(2);
    // cursor rebuilt: same logical node (the one tagged 999), now at multiplicity 1
    expect(event.kind).toBe('question');
    const at = event.index as AtFormIndex;
    expect(at.path[0]!.multiplicity).toBe(1);
    const node = instancesOf(session.tree.root, 'repeat')[1]!
      .children.find((c) => c.name === 'q')!;
    expect(node.value).toEqual(intValue(999));
  });

  it('(c) unrelated-instance-removed: cursor before target multiplicity stays unchanged', () => {
    const session = initSession(simpleRepeatForm());
    addRepeat(session, '/data/repeat'); // instance[1]
    addRepeat(session, '/data/repeat'); // instance[2]
    addRepeat(session, '/data/repeat'); // instance[3]

    const idx = session.navigator.indexOf('/data/repeat[1]');
    session.navigator.jumpToIndex(idx);

    const removeIdx = session.navigator.indexOf('/data/repeat[3]');
    session.navigator.deleteRepeat(removeIdx);

    const cursorAfter = session.navigator.getCurrentIndex() as AtFormIndex;
    expect(cursorAfter.ref.levels[cursorAfter.ref.levels.length - 1]!.multiplicity).toBe(0);
  });

  it('(d) last-instance-removed-lands-on-prompt-new-repeat', () => {
    const session = initSession(simpleRepeatForm());
    addRepeat(session, '/data/repeat'); // the only instance (instance[1])

    const idx = session.navigator.indexOf('/data/repeat[1]');
    session.navigator.jumpToIndex(idx);

    const event = session.navigator.deleteRepeat();

    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(0);
    expect(event.kind).toBe('prompt-new-repeat');
  });

  it('nested repeats: deleting an inner instance leaves the outer instance untouched', () => {
    const session = initSession(nestedRepeatForm());
    addRepeat(session, '/data/repeat1'); // repeat1[1]
    addRepeat(session, '/data/repeat1[1]/repeat2'); // repeat1[1]/repeat2[1]
    addRepeat(session, '/data/repeat1[1]/repeat2'); // repeat1[1]/repeat2[2]

    const idx = session.navigator.indexOf('/data/repeat1[1]/repeat2[1]');
    session.navigator.deleteRepeat(idx);

    const outer = instancesOf(session.tree.root, 'repeat1');
    expect(outer).toHaveLength(1);
    const inner = instancesOf(outer[0]!, 'repeat2');
    expect(inner).toHaveLength(1);
  });

  it('nested repeats: deleting an outer instance cascades removal of its inner instances', () => {
    const session = initSession(nestedRepeatForm());
    addRepeat(session, '/data/repeat1'); // repeat1[1]
    addRepeat(session, '/data/repeat1[1]/repeat2'); // repeat1[1]/repeat2[1]

    const idx = session.navigator.indexOf('/data/repeat1[1]');
    session.navigator.deleteRepeat(idx);

    const outer = instancesOf(session.tree.root, 'repeat1');
    expect(outer).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T3 — invalid-index / non-repeat rejection
// ---------------------------------------------------------------------------

describe('FormNavigator.deleteRepeat — invalid-index / non-repeat rejection', () => {
  function questionOnlyForm() {
    return html(
      head(
        title('Question Only'),
        model(
          mainInstance(t('data id="q-only"', t('q'))),
          bind('/data/q').type('string'),
        ),
      ),
      body(input('/data/q')),
    );
  }

  it('throws when idx has no repeat ancestor', () => {
    const session = initSession(questionOnlyForm());
    const idx = session.navigator.indexOf('/data/q');
    expect(() => session.navigator.deleteRepeat(idx)).toThrow(/does not reference a repeat instance/);
  });

  it('throws when idx is BOF', () => {
    const session = initSession(questionOnlyForm());
    expect(() => session.navigator.deleteRepeat()).toThrow(/index is not resolvable/);
  });

  it('throws when idx points at a PROMPT_NEW_REPEAT slot (no backing instance)', () => {
    const session = initSession(simpleRepeatForm());
    // No instances exist yet — repeat[1] is a PROMPT_NEW_REPEAT slot.
    const idx = session.navigator.indexOf('/data/repeat[1]');
    expect(() => session.navigator.deleteRepeat(idx)).toThrow(/no repeat instance exists at index/);
  });

  it('throws on out-of-range multiplicity and leaves the tree unchanged', () => {
    const session = initSession(simpleRepeatForm());
    addRepeat(session, '/data/repeat'); // instance[1] only

    const idx = session.navigator.indexOf('/data/repeat[1]') as AtFormIndex;
    session.navigator.jumpToIndex(idx);

    // Hand-craft an AtFormIndex at an out-of-range multiplicity (index [6],
    // 0-indexed 5) — indexOf cannot produce this itself since its
    // relevance-blind walk never advances past the PROMPT_NEW_REPEAT slot
    // for a non-existent instance.
    const badPath = idx.path.map((l) => ({ elementIndex: l.elementIndex, multiplicity: 5 }));
    const badRef = parseAbsoluteRef('/data/repeat[6]');
    const outOfRangeIdx = atIndex(badPath, badRef);

    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(1);

    expect(() => session.navigator.deleteRepeat(outOfRangeIdx)).toThrow(
      /no repeat instance exists at index/,
    );
    // Unchanged: still exactly 1 instance
    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T4 — jr:count-bound rejection
// ---------------------------------------------------------------------------

describe('FormNavigator.deleteRepeat — jr:count-bound rejection', () => {
  it('throws when the resolved repeat has a non-null countExpr, and leaves state unchanged', () => {
    const session = initSessionXml(countBoundRepeatXml());
    // Count-bound repeats auto-create their instance on first navigation.
    session.navigator.jumpToBeginningOfForm();
    session.navigator.stepToNextEvent(); // /data/n
    session.navigator.stepToNextEvent(); // repeat[1] (auto-created via createModelIfNecessary)

    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(1);

    const idx = session.navigator.indexOf('/data/repeat[1]');
    expect(() => session.navigator.deleteRepeat(idx)).toThrow(/count-bound \(jr:count\)/);

    // Unchanged: instance still present
    expect(instancesOf(session.tree.root, 'repeat')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T2 (composition) — DAG cascade + choiceCache invalidation reuse
// ---------------------------------------------------------------------------

describe('FormNavigator.deleteRepeat — reuses existing cascade (no bespoke recompute)', () => {
  function countCascadeForm() {
    return html(
      head(
        title('Count cascade'),
        model(
          mainInstance(t('data id="count-cascade"', t('count'), t('repeat jr:template=""', t('q')))),
          bind('/data/count').type('int').calculate('count(/data/repeat)'),
          bind('/data/repeat/q').type('int'),
        ),
      ),
      body(repeat('/data/repeat', input('/data/repeat/q'))),
    );
  }

  it('count() outside the repeat is recomputed after deleteRepeat via triggerRepeatRemoval', () => {
    const session = initSession(countCascadeForm());
    addRepeat(session, '/data/repeat');
    addRepeat(session, '/data/repeat');
    addRepeat(session, '/data/repeat');

    expect(session.evaluator.evaluateOnInstance('/data/count', session.tree.root)).toBe('3');

    const idx = session.navigator.indexOf('/data/repeat[1]');
    session.navigator.deleteRepeat(idx);

    expect(session.evaluator.evaluateOnInstance('/data/count', session.tree.root)).toBe('2');
  });
});
