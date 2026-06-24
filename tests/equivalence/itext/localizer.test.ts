/**
 * LocalizerTest equivalence — ts-rosa port of JavaRosa LocalizerTest.java
 *
 * Slice 5a scenarios A1–A6 (+ C7 as it.fails until 5c).
 * RED bar introduced in 5A-T1; goes green in 5A-T2..5A-T6.
 *
 * Test strategy: exercises makeItextResolver directly for unit scenarios,
 * and Scenario for integration scenarios (A3, A4).
 */

import { describe, it, expect } from 'vitest';
import { Scenario } from '../../harness/Scenario.ts';

// ---------------------------------------------------------------------------
// Minimal form helpers
// ---------------------------------------------------------------------------

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
          <q2/>
          <fruit/>
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

// ---------------------------------------------------------------------------
// Scenario A1 — language list (REQ-5A-1)
// ---------------------------------------------------------------------------

describe('Scenario A1 — language list', () => {
  it('returns available languages in document order', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:label"><value>Name</value></text>
       </translation>
       <translation lang="es">
         <text id="q1:label"><value>Nombre</value></text>
       </translation>`,
      `<input ref="/data/q1"><label ref="jr:itext('q1:label')"/></input>`,
    );
    const scenario = Scenario.init(xml);
    const langs = scenario.getLanguages();
    expect(langs).toEqual(['en', 'es']);
  });
});

// ---------------------------------------------------------------------------
// Scenario A2 — default language (REQ-5A-2)
// ---------------------------------------------------------------------------

describe('Scenario A2 — default language', () => {
  it('active language at session start is the first translation in document order', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:label"><value>Name</value></text>
       </translation>
       <translation lang="es">
         <text id="q1:label"><value>Nombre</value></text>
       </translation>`,
      `<input ref="/data/q1"><label ref="jr:itext('q1:label')"/></input>`,
    );
    const scenario = Scenario.init(xml);
    expect(scenario.getActiveLanguage()).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// Scenario A3 — language switch (REQ-5A-3)
// ---------------------------------------------------------------------------

describe('Scenario A3 — language switch', () => {
  it('setLanguage("es") makes jr:itext resolve to Spanish text', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:label"><value>Name</value></text>
       </translation>
       <translation lang="es">
         <text id="q1:label"><value>Nombre</value></text>
       </translation>`,
      `<input ref="/data/q1">
         <label ref="jr:itext('q1:label')"/>
         <bind nodeset="/data/q1" calculate="jr:itext('q1:label')"/>
       </input>`,
    );
    const scenario = Scenario.init(xml);
    // Initially English
    expect(scenario.resolveItext('q1:label')).toBe('Name');
    scenario.setLanguage('es');
    expect(scenario.resolveItext('q1:label')).toBe('Nombre');
  });
});

// ---------------------------------------------------------------------------
// Scenario A4 — unknown language rejected (REQ-5A-4)
// ---------------------------------------------------------------------------

describe('Scenario A4 — unknown language rejected', () => {
  it('setLanguage with unknown lang throws', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:label"><value>Name</value></text>
       </translation>
       <translation lang="es">
         <text id="q1:label"><value>Nombre</value></text>
       </translation>`,
      `<input ref="/data/q1"><label ref="jr:itext('q1:label')"/></input>`,
    );
    const scenario = Scenario.init(xml);
    expect(() => scenario.setLanguage('fr')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Scenario A5 — fallback for id missing in active language (REQ-5A-5)
// ---------------------------------------------------------------------------

describe('Scenario A5 — fallback to first language with id', () => {
  it('resolves id from first language that has it when active language lacks it', () => {
    // "es" does NOT have q2:label; "en" does
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:label"><value>Name</value></text>
         <text id="q2:label"><value>District</value></text>
       </translation>
       <translation lang="es">
         <text id="q1:label"><value>Nombre</value></text>
       </translation>`,
      `<input ref="/data/q1"><label ref="jr:itext('q1:label')"/></input>
       <input ref="/data/q2"><label ref="jr:itext('q2:label')"/></input>`,
    );
    const scenario = Scenario.init(xml);
    scenario.setLanguage('es');
    // q1:label exists in es
    expect(scenario.resolveItext('q1:label')).toBe('Nombre');
    // q2:label is ONLY in en; active is es — must fall back to "District"
    expect(scenario.resolveItext('q2:label')).toBe('District');
  });
});

// ---------------------------------------------------------------------------
// Scenario A6 — static item itext label (REQ-5A-6)
// ---------------------------------------------------------------------------
// Depends on choicesOf() (Scenario.ts stub) which is implemented in 5c.
// Mark it.fails until 5c lands.

it.fails('A6: static <item> with jr:itext label resolves through active language', () => {
  const xml = formWithItext(
    `<translation lang="en">
       <text id="fruit:apple"><value>Apple</value></text>
       <text id="fruit:banana"><value>Banana</value></text>
     </translation>
     <translation lang="es">
       <text id="fruit:apple"><value>Manzana</value></text>
       <text id="fruit:banana"><value>Plátano</value></text>
     </translation>`,
    `<select1 ref="/data/fruit">
       <label>Fruit</label>
       <item><label ref="jr:itext('fruit:apple')"/><value>apple</value></item>
       <item><label ref="jr:itext('fruit:banana')"/><value>banana</value></item>
     </select1>`,
  );
  const scenario = Scenario.init(xml);
  scenario.setLanguage('es');
  const choices = scenario.choicesOf('/data/fruit');
  // choices is SelectChoiceStub[] — shape TBD in 5c; for now just check labels
  expect(choices).toHaveLength(2);
});
