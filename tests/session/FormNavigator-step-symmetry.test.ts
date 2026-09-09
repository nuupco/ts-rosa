/**
 * Regression: stepToNextEvent()/stepToPreviousEvent() must be exact
 * inverses of each other, including across a repeat instance.
 *
 * Root cause (fixed here): decrementHelper's descent into a repeat with an
 * EXISTING instance stopped at the repeat entry itself instead of
 * continuing to descend into that instance's last child — asymmetric with
 * incrementHelper, which reaches the same repeat entry and its child as two
 * separate stops. Backward navigation silently skipped the child stop, so
 * N stepToNextEvent() calls followed by N stepToPreviousEvent() calls
 * overshot past the starting position.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { createFormSession } from '../../src/session/FormSession.ts';

function formWithSingleInstanceRepeat() {
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Step symmetry</h:title>
    <model>
      <instance>
        <data id="repro">
          <q0/>
          <rep_count>1</rep_count>
          <rep jr:template="">
            <q1/>
          </rep>
          <rep>
            <q1/>
          </rep>
        </data>
      </instance>
      <bind nodeset="/data/rep_count" type="int"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/q0"><label>Q0</label></input>
    <group ref="/data/rep">
      <repeat nodeset="/data/rep" jr:count="/data/rep_count">
        <input ref="/data/rep/q1"><label>Q1</label></input>
      </repeat>
    </group>
  </h:body>
</h:html>`;
}

describe('FormNavigator — stepToNextEvent/stepToPreviousEvent symmetry', () => {
  it('N forward steps then N backward steps returns to the starting index, across a repeat, near EOF', () => {
    const definition = parseForm(formWithSingleInstanceRepeat());
    const session = createFormSession(definition);
    const nav = session.navigator;

    // Start mid-form (not BOF) so an overshoot past the start is visible
    // instead of being silently clamped by BOF's terminal no-op.
    nav.stepToNextEvent(); // -> q0
    const start = nav.getCurrentIndex();

    let n = 0;
    for (;;) {
      const ev = nav.stepToNextEvent();
      n++;
      if (ev.kind === 'end-of-form' || n > 20) break;
    }

    for (let i = 0; i < n; i++) {
      nav.stepToPreviousEvent();
    }

    expect(nav.getCurrentIndex()).toEqual(start);
  });

  it('backward walk visits the repeat entry AND its child as two distinct stops, mirroring forward', () => {
    const definition = parseForm(formWithSingleInstanceRepeat());
    const session = createFormSession(definition);
    const nav = session.navigator;

    // Drive to EOF, recording the forward stop sequence.
    const forwardKinds: string[] = [nav.getEvent().kind];
    for (;;) {
      const ev = nav.stepToNextEvent();
      forwardKinds.push(ev.kind);
      if (ev.kind === 'end-of-form') break;
    }
    expect(forwardKinds).toEqual(['beginning-of-form', 'question', 'repeat', 'question', 'end-of-form']);

    // Walking back must retrace the exact same stops in reverse.
    const backwardKinds: string[] = [];
    for (let i = 0; i < forwardKinds.length - 1; i++) {
      backwardKinds.push(nav.stepToPreviousEvent().kind);
    }
    expect(backwardKinds).toEqual([...forwardKinds].reverse().slice(1));
  });
});
