/**
 * Label media resolution — SelectChoice.geometry's sibling feature for
 * appearance="image-map": exposes the question label's itext media
 * reference (image/audio/video/big-image) as a raw, unresolved jr:// string.
 */

import { describe, it, expect } from 'vitest';
import { Scenario } from '../../harness/Scenario.ts';

function formWithItext(itextBlock: string, bodyBlock: string): string {
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Test</h:title>
    <model>
      <instance>
        <data id="test">
          <q1/>
        </data>
      </instance>
      <itext>
        ${itextBlock}
      </itext>
    </model>
  </h:head>
  <h:body>
    ${bodyBlock}
  </h:body>
</h:html>`;
}

describe('getLabelMediaUri', () => {
  it('resolves the raw jr:// reference for the requested media form', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:label">
           <value>Pick a zone</value>
           <value form="image">jr://images/zones.svg</value>
         </text>
       </translation>`,
      `<select1 ref="/data/q1" appearance="image-map">
         <label ref="jr:itext('q1:label')"/>
         <item><value>north</value><label>North</label></item>
       </select1>`,
    );
    const scenario = Scenario.init(xml);
    scenario.next();
    const prompt = scenario.getQuestionAtIndex();
    expect(prompt?.getLabelMediaUri('image')).toBe('jr://images/zones.svg');
  });

  it('returns null for a form with no matching itext value (no fallback to default text)', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:label"><value>Pick a zone</value></text>
       </translation>`,
      `<select1 ref="/data/q1">
         <label ref="jr:itext('q1:label')"/>
         <item><value>north</value><label>North</label></item>
       </select1>`,
    );
    const scenario = Scenario.init(xml);
    scenario.next();
    const prompt = scenario.getQuestionAtIndex();
    expect(prompt?.getLabelMediaUri('image')).toBeNull();
  });

  it('returns null when the label is not itext-driven', () => {
    const xml = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml">
  <h:head>
    <h:title>Test</h:title>
    <model>
      <instance><data id="test"><q1/></data></instance>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/q1"><label>Plain label</label></input>
  </h:body>
</h:html>`;
    const scenario = Scenario.init(xml);
    scenario.next();
    const prompt = scenario.getQuestionAtIndex();
    expect(prompt?.getLabelMediaUri('image')).toBeNull();
  });
});
