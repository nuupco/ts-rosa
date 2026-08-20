/**
 * Regression coverage for issue #2: a calculate inside a jr:count-driven
 * repeat that reads a field OUTSIDE the repeat via a position()-dependent
 * expression (the "distribute a select-multi's items across repeat
 * instances" pattern) must resolve correctly, per-instance, on creation —
 * both when instances are added directly and when the repeat is
 * auto-created by real FormNavigator navigation.
 */

import { describe, it, expect } from 'vitest';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import { addRepeatInstance, resolveReference } from '../../src/model/instance/InstanceTree.ts';
import { stringValue } from '../../src/model/data/codecs.ts';

function positionOutsideRepeatForm() {
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Position Outside Repeat</h:title>
    <model>
      <instance>
        <data id="position-outside-repeat">
          <razon_visita/>
          <rep_razon jr:template="">
            <razon_actual/>
          </rep_razon>
        </data>
      </instance>
      <bind nodeset="/data/razon_visita" type="string"/>
      <bind nodeset="/data/rep_razon/razon_actual" calculate="selected-at(/data/razon_visita, position(..)-1)" type="string"/>
    </model>
  </h:head>
  <h:body>
    <select ref="/data/razon_visita">
      <item><label>A</label><value>a</value></item>
      <item><label>B</label><value>b</value></item>
      <item><label>C</label><value>c</value></item>
    </select>
    <repeat nodeset="/data/rep_razon" jr:count="/data/rep_razon_count">
      <input ref="/data/rep_razon/razon_actual"/>
    </repeat>
  </h:body>
</h:html>`;
}

/** Real-world shape: a separate count field drives jr:count, navigated via FormNavigator. */
function positionOutsideRepeatFormWithCountField() {
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Position Outside Repeat With Count</h:title>
    <model>
      <instance>
        <data id="position-outside-repeat-count">
          <razon_visita/>
          <rep_razon_count/>
          <rep_razon jr:template="">
            <razon_actual/>
          </rep_razon>
        </data>
      </instance>
      <bind nodeset="/data/razon_visita" type="string"/>
      <bind nodeset="/data/rep_razon_count" calculate="count-selected(/data/razon_visita)" type="int"/>
      <bind nodeset="/data/rep_razon/razon_actual" calculate="selected-at(/data/razon_visita, position(..)-1)" type="string"/>
    </model>
  </h:head>
  <h:body>
    <select ref="/data/razon_visita">
      <item><label>A</label><value>a</value></item>
      <item><label>B</label><value>b</value></item>
      <item><label>C</label><value>c</value></item>
    </select>
    <repeat nodeset="/data/rep_razon" jr:count="/data/rep_razon_count">
      <input ref="/data/rep_razon/razon_actual"/>
    </repeat>
  </h:body>
</h:html>`;
}

/** Mirrors FormNavigator.createModelIfNecessary's repeat-instance creation, without the navigator. */
function addRepeatAndInitialize(session: ReturnType<typeof createFormSession>, xPath: string): void {
  const ref = parseAbsoluteRef(xPath);
  const node = addRepeatInstance(session.tree, ref);
  if (node === null) throw new Error(`could not add repeat instance at ${xPath}`);
  const index = node.multiplicity;
  const concreteRef = parseAbsoluteRef(`${xPath}[${index + 1}]`);
  session.evaluator.initializeRepeatInstance(concreteRef);
}

describe('calculate with position()/selected-at() reading a trigger outside the repeat', () => {
  it('resolves each repeat instance to its own selected-at() value on creation', () => {
    const definition = parseForm(positionOutsideRepeatForm());
    const session = createFormSession(definition);

    session.evaluator.answerQuestion(parseAbsoluteRef('/data/razon_visita'), stringValue('a b c'));

    const razonActual = (i: number) =>
      resolveReference(session.tree, parseAbsoluteRef(`/data/rep_razon[${i + 1}]/razon_actual`))?.value?.displayText;

    addRepeatAndInitialize(session, '/data/rep_razon');
    addRepeatAndInitialize(session, '/data/rep_razon');
    addRepeatAndInitialize(session, '/data/rep_razon');

    expect(razonActual(0)).toBe('a');
    expect(razonActual(1)).toBe('b');
    expect(razonActual(2)).toBe('c');
  });

  it('resolves correctly when the repeat is auto-created by real FormNavigator navigation (jr:count field)', () => {
    const definition = parseForm(positionOutsideRepeatFormWithCountField());
    const session = createFormSession(definition);

    session.evaluator.answerQuestion(parseAbsoluteRef('/data/razon_visita'), stringValue('a b c'));

    // Drive the navigator forward so createModelIfNecessary auto-creates each
    // jr:count-bound rep_razon instance, exactly like real app navigation.
    for (let i = 0; i < 7; i++) {
      session.navigator.stepToNextEvent();
    }

    const razonActual = (i: number) =>
      resolveReference(session.tree, parseAbsoluteRef(`/data/rep_razon[${i + 1}]/razon_actual`))?.value?.displayText;

    expect(razonActual(0)).toBe('a');
    expect(razonActual(1)).toBe('b');
    expect(razonActual(2)).toBe('c');
  });
});
