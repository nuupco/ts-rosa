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

it('A6: static <item> with jr:itext label resolves through active language (5c)', () => {
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
  expect(choices).toHaveLength(2);
  const labels = choices.map((c) => c.getDisplayText());
  expect(labels).toContain('Manzana');
  expect(labels).toContain('Plátano');
});

// ---------------------------------------------------------------------------
// Scenario C7 — itext label in itemset (REQ-5C-5)
// ---------------------------------------------------------------------------
// Depends on 5c (choicesOf + itemset parsing with labelIsItext=true).
// Mark it.fails until 5c lands and resolveChoiceLabel handles itext.

it('C7: itemset with jr:itext labels resolves through active language (5c)', () => {
  // Form with secondary instance and itext-driven itemset labels
  const xml = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>C7 itext itemset</h:title>
    <model>
      <instance>
        <data id="c7">
          <fruit/>
        </data>
      </instance>
      <instance id="fruits">
        <root>
          <item><name>apple</name><labelid>fruit:apple</labelid></item>
          <item><name>banana</name><labelid>fruit:banana</labelid></item>
        </root>
      </instance>
      <itext>
        <translation lang="en">
          <text id="fruit:apple"><value>Apple</value></text>
          <text id="fruit:banana"><value>Banana</value></text>
        </translation>
        <translation lang="es">
          <text id="fruit:apple"><value>Manzana</value></text>
          <text id="fruit:banana"><value>Plátano</value></text>
        </translation>
      </itext>
      <bind nodeset="/data/fruit" type="string"/>
    </model>
  </h:head>
  <h:body>
    <select1 ref="/data/fruit">
      <itemset nodeset="instance('fruits')/root/item">
        <value ref="name"/>
        <label ref="jr:itext(labelid)"/>
      </itemset>
    </select1>
  </h:body>
</h:html>`;

  const scenario = Scenario.init(xml);

  // Spanish
  scenario.setLanguage('es');
  const esChoices = scenario.choicesOf('/data/fruit');
  expect(esChoices).toHaveLength(2);
  const esLabels = esChoices.map((c) => (c as unknown as { getDisplayText(): string }).getDisplayText());
  expect(esLabels).toContain('Manzana');
  expect(esLabels).toContain('Plátano');

  // English
  scenario.setLanguage('en');
  const enChoices = scenario.choicesOf('/data/fruit');
  expect(enChoices).toHaveLength(2);
  const enLabels = enChoices.map((c) => (c as unknown as { getDisplayText(): string }).getDisplayText());
  expect(enLabels).toContain('Apple');
  expect(enLabels).toContain('Banana');
});

// ---------------------------------------------------------------------------
// Phase 1 (output-label-substitution PR1) — question label/hint itext wiring
// ---------------------------------------------------------------------------
// Question-level <label ref="jr:itext('id')"/> and <hint ref="jr:itext('id')"/>
// were previously unwired (only choices/itemset resolved itext). This phase
// wires resolution through getQuestionAtIndex().getQuestionText() /
// getSubstitutedHintText(), reusing the existing ItextResolver.resolve(id)
// path. No <output> substitution exists yet — that lands in PR2/PR3.
// original ts-rosa behavioral tests (no direct JavaRosa counterpart).

describe('Phase 1 — question label/hint itext wiring', () => {
  it('getQuestionText() resolves an itext-driven question label in the active language', () => {
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
    scenario.next();
    const question = scenario.getQuestionAtIndex();
    expect(question).not.toBeNull();
    expect(question!.getQuestionText()).toBe('Name');

    scenario.setLanguage('es');
    expect(question!.getQuestionText()).toBe('Nombre');
  });

  it('getSubstitutedHintText() resolves an itext-driven question hint in the active language', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:hint"><value>Enter your name</value></text>
       </translation>
       <translation lang="es">
         <text id="q1:hint"><value>Ingrese su nombre</value></text>
       </translation>`,
      `<input ref="/data/q1"><label>Name</label><hint ref="jr:itext('q1:hint')"/></input>`,
    );
    const scenario = Scenario.init(xml);
    scenario.next();
    const question = scenario.getQuestionAtIndex();
    expect(question).not.toBeNull();
    expect(question!.getSubstitutedHintText()).toBe('Enter your name');

    scenario.setLanguage('es');
    expect(question!.getSubstitutedHintText()).toBe('Ingrese su nombre');
  });

  it('getQuestionText() falls back to the plain label when not itext-driven', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="unused"><value>Unused</value></text>
       </translation>`,
      `<input ref="/data/q1"><label>Plain Name</label></input>`,
    );
    const scenario = Scenario.init(xml);
    scenario.next();
    const question = scenario.getQuestionAtIndex();
    expect(question).not.toBeNull();
    expect(question!.getQuestionText()).toBe('Plain Name');
  });

  it('raw getLabelInnerText() and getHintText() remain unaffected by itext wiring', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:label"><value>Name</value></text>
         <text id="q1:hint"><value>Enter your name</value></text>
       </translation>`,
      `<input ref="/data/q1"><label ref="jr:itext('q1:label')"/><hint ref="jr:itext('q1:hint')"/></input>`,
    );
    const scenario = Scenario.init(xml);
    scenario.next();
    const question = scenario.getQuestionAtIndex();
    expect(question).not.toBeNull();
    // Raw accessors do not resolve itext refs — no plain text content on the ref-driven elements.
    expect(question!.getLabelInnerText()).toBeNull();
    expect(question!.getHintText()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — read-time output substitution (PR3)
//
// Wires FormEvaluator.substituteText into getQuestionText() /
// getSubstitutedHintText(), for both plain labels/hints and itext-driven
// ones, using the parse-time labelOutputs/hintOutputs/ItextValue.outputs
// captured in PR2. Reuses evaluateRelativeOnNode (no new eval engine).
// original ts-rosa behavioral tests (no direct JavaRosa counterpart).
// ---------------------------------------------------------------------------

function formWithPlainOutput(labelBody: string, hintBody = ''): string {
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml">
  <h:head>
    <h:title>Plain Output</h:title>
    <model>
      <instance>
        <data id="plain-output">
          <name/>
          <q1/>
        </data>
      </instance>
      <bind nodeset="/data/q1" type="string"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/name"><label>Name</label></input>
    <input ref="/data/q1">${labelBody}${hintBody}</input>
  </h:body>
</h:html>`;
}

describe('Phase 3 — output substitution', () => {
  it('getQuestionText() substitutes a single output in a plain label', () => {
    const xml = formWithPlainOutput('<label>Hello, <output value="/data/name"/></label>');
    const scenario = Scenario.init(xml);
    scenario.answer('/data/name', 'Ana');
    scenario.next('/data/q1');
    const q = scenario.getQuestionAtIndex();
    expect(q).not.toBeNull();
    expect(q!.getQuestionText()).toBe('Hello, Ana');
    // Raw accessor keeps the placeholder.
    expect(q!.getLabelInnerText()).toBe('Hello, ${0}');
  });

  it('getSubstitutedHintText() substitutes a single output in a plain hint', () => {
    const xml = formWithPlainOutput(
      '<label>Q1</label>',
      '<hint>Value is <output value="/data/name"/></hint>',
    );
    const scenario = Scenario.init(xml);
    scenario.answer('/data/name', '42');
    scenario.next('/data/q1');
    const q = scenario.getQuestionAtIndex();
    expect(q).not.toBeNull();
    expect(q!.getSubstitutedHintText()).toBe('Value is 42');
    // Raw getHintText() is unaffected by this feature — it predates
    // hintInnerText/hintOutputs and uses plain textContent semantics.
    expect(q!.getHintText()).toBe('Value is');
  });

  it('getQuestionText() substitutes multiple outputs in document order', () => {
    const xml = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml">
  <h:head>
    <h:title>Multi Output</h:title>
    <model>
      <instance>
        <data id="multi-output">
          <first_name/>
          <last_name/>
          <q1/>
        </data>
      </instance>
      <bind nodeset="/data/q1" type="string"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/first_name"><label>First</label></input>
    <input ref="/data/last_name"><label>Last</label></input>
    <input ref="/data/q1"><label>Full name: <output value="/data/first_name"/> <output value="/data/last_name"/></label></input>
  </h:body>
</h:html>`;
    const scenario = Scenario.init(xml);
    scenario.answer('/data/first_name', 'Ada');
    scenario.answer('/data/last_name', 'Lovelace');
    scenario.next('/data/q1');
    const q = scenario.getQuestionAtIndex();
    expect(q!.getQuestionText()).toBe('Full name: Ada Lovelace');
  });

  it('substituted value reflects updated instance data on next read (no caching)', () => {
    const xml = formWithPlainOutput('<label>Hello, <output value="/data/name"/></label>');
    const scenario = Scenario.init(xml);
    scenario.answer('/data/name', 'Ana');
    scenario.next('/data/q1');
    const q = scenario.getQuestionAtIndex();
    expect(q!.getQuestionText()).toBe('Hello, Ana');
    scenario.answer('/data/name', 'Beto');
    expect(q!.getQuestionText()).toBe('Hello, Beto');
  });

  it('output referencing a non-existent node substitutes as empty string', () => {
    const xml = formWithPlainOutput('<label>Hello, <output value="/data/missing"/></label>');
    const scenario = Scenario.init(xml);
    scenario.next('/data/q1');
    const q = scenario.getQuestionAtIndex();
    expect(q!.getQuestionText()).toBe('Hello, ');
  });

  it('output with a malformed XPath expression resolves to empty string without throwing', () => {
    const xml = formWithPlainOutput('<label>Hello, <output value="((("/></label>');
    const scenario = Scenario.init(xml);
    expect(() => scenario.next('/data/q1')).not.toThrow();
    const q = scenario.getQuestionAtIndex();
    expect(() => q!.getQuestionText()).not.toThrow();
    expect(q!.getQuestionText()).toBe('Hello, ');
  });

  it('itext-driven label substitutes outputs against the currently active language template', () => {
    const xml = formWithItext(
      `<translation lang="en">
         <text id="q1:label"><value>Hello, <output value="/data/fruit"/></value></text>
       </translation>
       <translation lang="es">
         <text id="q1:label"><value>Hola, <output value="/data/fruit"/></value></text>
       </translation>`,
      `<input ref="/data/fruit"><label>Fruit</label></input>
       <input ref="/data/q1"><label ref="jr:itext('q1:label')"/></input>`,
    );
    const scenario = Scenario.init(xml);
    scenario.answer('/data/fruit', 'apple');
    scenario.next('/data/q1');
    const q = scenario.getQuestionAtIndex();
    expect(q!.getQuestionText()).toBe('Hello, apple');

    scenario.setLanguage('es');
    expect(q!.getQuestionText()).toBe('Hola, apple');
  });

  it('repeat-relative output resolves against the current repeat instance, not the primary root', () => {
    const xml = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Repeat Output</h:title>
    <model>
      <instance>
        <data id="repeat-output">
          <rep jr:template="">
            <name/>
            <greeting/>
          </rep>
        </data>
      </instance>
      <bind nodeset="/data/rep/name" type="string"/>
      <bind nodeset="/data/rep/greeting" type="string"/>
    </model>
  </h:head>
  <h:body>
    <repeat nodeset="/data/rep">
      <input ref="/data/rep/name"><label>Name</label></input>
      <input ref="/data/rep/greeting"><label>Hi <output value="../name"/></label></input>
    </repeat>
  </h:body>
</h:html>`;
    const scenario = Scenario.init(xml);
    scenario.createNewRepeat('/data/rep');
    scenario.createNewRepeat('/data/rep');
    scenario.answer('/data/rep[1]/name', 'Ana');
    scenario.answer('/data/rep[2]/name', 'Beto');

    scenario.next('/data/rep[1]/greeting');
    const first = scenario.getQuestionAtIndex();
    expect(first!.getQuestionText()).toBe('Hi Ana');

    scenario.next('/data/rep[2]/greeting');
    const second = scenario.getQuestionAtIndex();
    expect(second!.getQuestionText()).toBe('Hi Beto');
  });
});
