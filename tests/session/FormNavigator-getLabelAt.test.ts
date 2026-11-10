/**
 * FormNavigator.getLabelAt — resolved label for any element kind
 * (question, group, repeat), itext + <output> substituted.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { createFormSession } from '../../src/session/FormSession.ts';
import { beginningOfForm as BOF } from '../../src/session/FormIndex.ts';

function form(body: string, itext = ''): string {
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Test</h:title>
    <model>
      <instance>
        <data id="test">
          <name>Ana</name>
          <grp><q1/></grp>
          <rep jr:template=""><item>Beto</item></rep>
          <rep><item>Beto</item></rep>
        </data>
      </instance>
      <itext>${itext}</itext>
      <bind nodeset="/data/name" type="string"/>
      <bind nodeset="/data/grp/q1" type="string"/>
      <bind nodeset="/data/rep/item" type="string"/>
    </model>
  </h:head>
  <h:body>${body}</h:body>
</h:html>`;
}

const ITEXT = `
  <translation lang="en">
    <text id="g:label"><value>Group EN <output value="/data/name"/></value></text>
    <text id="r:label"><value>Repeat EN</value></text>
  </translation>
  <translation lang="es">
    <text id="g:label"><value>Grupo ES <output value="/data/name"/></value></text>
    <text id="r:label"><value>Repetición ES</value></text>
  </translation>`;

function labelsOf(xml: string) {
  const session = createFormSession(parseForm(xml));
  const nav = session.navigator;
  const out: { kind: string; label: string | null }[] = [];
  let idx = nav.incrementIndex(BOF);
  while (idx.kind !== 'eof') {
    out.push({ kind: nav.eventAt(idx).kind, label: nav.getLabelAt(idx) });
    idx = nav.incrementIndex(idx);
  }
  return { session, out };
}

describe('FormNavigator.getLabelAt', () => {
  it('resolves an itext group label with <output> in the active language', () => {
    const xml = form(
      `<group ref="/data/grp"><label ref="jr:itext('g:label')"/>
         <input ref="/data/grp/q1"><label>Q1</label></input>
       </group>`,
      ITEXT,
    );
    const { session, out } = labelsOf(xml);
    expect(out[0]).toEqual({ kind: 'group', label: 'Group EN Ana' });
    session.evaluator.setLanguage('es');
    const idx = session.navigator.incrementIndex(BOF);
    expect(session.navigator.getLabelAt(idx)).toBe('Grupo ES Ana');
  });

  it('resolves an inline group label with <output>', () => {
    const xml = form(
      `<group ref="/data/grp"><label>Hola <output value="/data/name"/></label>
         <input ref="/data/grp/q1"><label>Q1</label></input>
       </group>`,
    );
    expect(labelsOf(xml).out[0]).toEqual({ kind: 'group', label: 'Hola Ana' });
  });

  it('resolves a repeat label (itext) and delegates question labels', () => {
    const xml = form(
      `<group ref="/data/rep"><label ref="jr:itext('r:label')"/>
         <repeat nodeset="/data/rep">
           <input ref="/data/rep/item"><label>Item</label></input>
         </repeat>
       </group>`,
      ITEXT,
    );
    const { out } = labelsOf(xml);
    expect(out.some((e) => e.kind === 'repeat')).toBe(true);
    expect(out.find((e) => e.kind === 'question')?.label).toBe('Item');
  });

  it('returns null at BOF/EOF and keeps getQuestionAtIndex null for groups', () => {
    const xml = form(
      `<group ref="/data/grp"><label>G</label>
         <input ref="/data/grp/q1"><label>Q1</label></input>
       </group>`,
    );
    const { session } = labelsOf(xml);
    expect(session.navigator.getLabelAt(BOF)).toBeNull();
    const idx = session.navigator.incrementIndex(BOF);
    expect(session.navigator.getQuestionAtIndex(idx)).toBeNull();
  });
});
