/**
 * createFormSession({ instanceXml, skipInitialCascade }) — literal load for
 * read-only views: calculates and load-time setvalue actions do not run, but
 * relevance (NodeState) is still evaluated.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';

const FORM = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:ev="http://www.w3.org/2001/xml-events"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Test</h:title>
    <model>
      <instance>
        <data id="test">
          <a/>
          <total/>
          <stamp/>
          <shown/>
        </data>
      </instance>
      <bind nodeset="/data/a" type="string"/>
      <bind nodeset="/data/total" type="string" calculate="concat('calc-', /data/a)"/>
      <bind nodeset="/data/stamp" type="string"/>
      <bind nodeset="/data/shown" type="string" relevant="/data/a = 'x'"/>
      <setvalue event="odk-instance-first-load" ref="/data/stamp" value="'loaded'"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/a"><label>A</label></input>
    <input ref="/data/total"><label>T</label></input>
    <input ref="/data/stamp"><label>S</label></input>
    <input ref="/data/shown"><label>Sh</label></input>
  </h:body>
</h:html>`;

const SAVED =
  '<data id="test"><a>y</a><total>SAVED</total><stamp>old</stamp><shown>kept</shown></data>';

function val(session: ReturnType<typeof createFormSession>, path: string): string | null {
  const node = session.tree.root.children.find((c) => c.name === path);
  const v = node?.value as { displayText?: string } | null | undefined;
  return v?.displayText ?? null;
}

describe('createFormSession skipInitialCascade', () => {
  it('default (option absent): calculates and load actions still win over loaded values', () => {
    const s = createFormSession(parseForm(FORM), { instanceXml: SAVED });
    expect(val(s, 'total')).toBe('calc-y');
    expect(val(s, 'stamp')).toBe('loaded');
  });

  it('skipInitialCascade keeps loaded values literal', () => {
    const s = createFormSession(parseForm(FORM), { instanceXml: SAVED, skipInitialCascade: true });
    expect(val(s, 'total')).toBe('SAVED');
    expect(val(s, 'stamp')).toBe('old');
    expect(val(s, 'shown')).toBe('kept');
  });

  it('skipInitialCascade still evaluates relevance', () => {
    const s = createFormSession(parseForm(FORM), { instanceXml: SAVED, skipInitialCascade: true });
    expect(s.evaluator.isEffectivelyRelevant(parseAbsoluteRef('/data/shown'))).toBe(false);
    expect(s.evaluator.isEffectivelyRelevant(parseAbsoluteRef('/data/total'))).toBe(true);
    const s2 = createFormSession(parseForm(FORM), {
      instanceXml: SAVED.replace('<a>y</a>', '<a>x</a>'),
      skipInitialCascade: true,
    });
    expect(s2.evaluator.isEffectivelyRelevant(parseAbsoluteRef('/data/shown'))).toBe(true);
  });

  it('skipInitialCascade is ignored without instanceXml', () => {
    const s = createFormSession(parseForm(FORM), { skipInitialCascade: true });
    expect(val(s, 'stamp')).toBe('loaded');
  });
});
