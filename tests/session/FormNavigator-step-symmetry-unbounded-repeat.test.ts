import { describe, it, expect } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { createFormSession } from '../../src/session/FormSession.ts';

function formWithUnboundedRepeat(existingInstances: number) {
  const instances = Array.from({ length: existingInstances }, () => '<rep><q1/></rep>').join('\n');
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Unbounded repeat symmetry</h:title>
    <model>
      <instance>
        <data id="repro">
          <q0/>
          <rep jr:template="">
            <q1/>
          </rep>
          ${instances}
        </data>
      </instance>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/q0"><label>Q0</label></input>
    <group ref="/data/rep">
      <repeat nodeset="/data/rep">
        <input ref="/data/rep/q1"><label>Q1</label></input>
      </repeat>
    </group>
  </h:body>
</h:html>`;
}

describe.each([0, 1, 2])(
  'FormNavigator — step symmetry across an unbounded repeat with %i existing instance(s)',
  (existingInstances) => {
    it('N forward steps (one past the prompt-new-repeat slot) then N backward steps returns to start', () => {
      const definition = parseForm(formWithUnboundedRepeat(existingInstances));
      const session = createFormSession(definition);
      const nav = session.navigator;

      nav.stepToNextEvent(); // -> q0
      const start = nav.getCurrentIndex();

      let n = 0;
      const forwardKinds: string[] = [];
      for (;;) {
        const ev = nav.stepToNextEvent();
        forwardKinds.push(ev.kind);
        n++;
        if (ev.kind === 'end-of-form' || n > 20) break;
      }

      for (let i = 0; i < n; i++) {
        nav.stepToPreviousEvent();
      }

      expect(nav.getCurrentIndex()).toEqual(start);
    });
  },
);
