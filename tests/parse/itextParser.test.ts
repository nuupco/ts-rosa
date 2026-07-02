/**
 * Tests for itextParser.ts and makeItextResolver — output expression capture
 * (output-label-substitution PR2).
 */

import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { parseItext } from '../../src/parse/itextParser.ts';
import { makeItextResolver } from '../../src/model/def/Itext.ts';

function parseModel(xml: string): Element {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return doc.documentElement as unknown as Element;
}

describe('parseItext — output expression capture', () => {
  it('captures outputs on an itext value alongside its ${n} placeholder text', () => {
    const modelEl = parseModel(`
      <model>
        <itext>
          <translation lang="en">
            <text id="q1:label">
              <value>Hi <output value="/data/name"/></value>
            </text>
          </translation>
        </itext>
      </model>
    `);
    const translations = parseItext(modelEl);
    expect(translations).not.toBeNull();
    const values = translations!.byLanguage.get('en')!.get('q1:label')!;
    expect(values).toHaveLength(1);
    expect(values[0]!.text).toBe('Hi ${0}');
    expect(values[0]!.outputs).toEqual(['/data/name']);
  });

  it('outputs is an empty array for a plain itext value with no <output>', () => {
    const modelEl = parseModel(`
      <model>
        <itext>
          <translation lang="en">
            <text id="q1:label"><value>Name</value></text>
          </translation>
        </itext>
      </model>
    `);
    const translations = parseItext(modelEl);
    const values = translations!.byLanguage.get('en')!.get('q1:label')!;
    expect(values[0]!.outputs).toEqual([]);
  });

  it('captures outputs when <text> has no <value> child (default text form)', () => {
    const modelEl = parseModel(`
      <model>
        <itext>
          <translation lang="en">
            <text id="q1:label">Hi <output value="/data/name"/></text>
          </translation>
        </itext>
      </model>
    `);
    const translations = parseItext(modelEl);
    const values = translations!.byLanguage.get('en')!.get('q1:label')!;
    expect(values[0]!.text).toBe('Hi ${0}');
    expect(values[0]!.outputs).toEqual(['/data/name']);
  });
});

describe('ItextResolver.resolveWithOutputs', () => {
  it('resolves the active-language {text, outputs} pair', () => {
    const modelEl = parseModel(`
      <model>
        <itext>
          <translation lang="en">
            <text id="q1:label"><value>Hi <output value="/data/name"/></value></text>
          </translation>
          <translation lang="es">
            <text id="q1:label"><value>Hola <output value="/data/name"/></value></text>
          </translation>
        </itext>
      </model>
    `);
    const translations = parseItext(modelEl)!;
    const resolver = makeItextResolver(translations);
    expect(resolver.resolveWithOutputs('q1:label')).toEqual({
      text: 'Hi ${0}',
      outputs: ['/data/name'],
    });

    resolver.setActiveLanguage('es');
    expect(resolver.resolveWithOutputs('q1:label')).toEqual({
      text: 'Hola ${0}',
      outputs: ['/data/name'],
    });
  });

  it('returns null when the id is absent in all languages', () => {
    const modelEl = parseModel(`
      <model>
        <itext>
          <translation lang="en">
            <text id="other"><value>x</value></text>
          </translation>
        </itext>
      </model>
    `);
    const translations = parseItext(modelEl)!;
    const resolver = makeItextResolver(translations);
    expect(resolver.resolveWithOutputs('missing')).toBeNull();
  });

  it('existing resolve(id) is unaffected and still returns text only', () => {
    const modelEl = parseModel(`
      <model>
        <itext>
          <translation lang="en">
            <text id="q1:label"><value>Hi <output value="/data/name"/></value></text>
          </translation>
        </itext>
      </model>
    `);
    const translations = parseItext(modelEl)!;
    const resolver = makeItextResolver(translations);
    expect(resolver.resolve('q1:label')).toBe('Hi ${0}');
  });
});
