/**
 * Tests for XFormParser pipeline (T-1.4.5 RED → T-1.4.6 GREEN)
 */

import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { parseForm, parseDocument, buildInstanceNode } from '../../src/parse/XFormParser.ts';
import { getAttribute } from '../../src/model/instance/InstanceNode.ts';
import { INDEX_TEMPLATE } from '../../src/model/instance/multiplicity.ts';
import { html, head, body, model, mainInstance, bind, input, select1, select, t, label, item } from '../harness/XFormsElement.ts';
import type { XFormsElement } from '../harness/XFormsElement.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formXml(form: XFormsElement): string {
  return form.asXml();
}

// ---------------------------------------------------------------------------
// Minimal form with input + bind
// ---------------------------------------------------------------------------

describe('parseForm: minimal input form', () => {
  const minimalXml = formXml(
    html(
      head(
        model(
          mainInstance(
            t('data id="test"', t('name', 'Alice'))
          ),
          bind('/data/name').type('string')
        )
      ),
      body(
        input('/data/name', label('Your Name'))
      )
    )
  );

  it('does not throw', () => {
    expect(() => parseForm(minimalXml)).not.toThrow();
  });

  it('returns a FormDefinition', () => {
    const fd = parseForm(minimalXml);
    expect(fd).toBeDefined();
    expect(fd.mainInstance).toBeDefined();
  });

  it('InstanceTree has node at /data/name', () => {
    const fd = parseForm(minimalXml);
    const root = fd.mainInstance.root;
    expect(root.name).toBe('data');
    expect(root.children.length).toBeGreaterThan(0);
    const nameNode = root.children.find((c) => c.name === 'name');
    expect(nameNode).toBeDefined();
  });

  it('applyBindings sets dataType=string on /data/name node', () => {
    const fd = parseForm(minimalXml);
    const nameNode = fd.mainInstance.root.children.find((c) => c.name === 'name');
    expect(nameNode?.dataType).toBe('string');
  });

  it('node value is cast to AnswerValue for pre-populated text', () => {
    const fd = parseForm(minimalXml);
    const nameNode = fd.mainInstance.root.children.find((c) => c.name === 'name');
    expect(nameNode?.value?.kind).toBe('string');
    expect(nameNode?.value?.value).toBe('Alice');
  });

  it('body contains input FormElement', () => {
    const fd = parseForm(minimalXml);
    expect(fd.body.length).toBeGreaterThan(0);
    const inputEl = fd.body[0];
    expect(inputEl?.kind).toBe('question');
    if (inputEl?.kind === 'question') {
      expect(inputEl.controlType).toBe('input');
    }
  });

  it('bindings map has /data/name entry', () => {
    const fd = parseForm(minimalXml);
    expect(fd.bindings.has('/data/name')).toBe(true);
    expect(fd.bindings.get('/data/name')?.dataType).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// select1 and select elements
// ---------------------------------------------------------------------------

describe('parseForm: select1 and select', () => {
  const multiXml = formXml(
    html(
      head(
        model(
          mainInstance(
            t('data id="test"', t('choice'), t('multi'))
          ),
          bind('/data/choice').type('string'),
          bind('/data/multi').type('string')
        )
      ),
      body(
        select1('/data/choice',
          label('Pick one'),
          item('a', 'Option A'),
          item('b', 'Option B')
        ),
        select('/data/multi',
          label('Pick many'),
          item('x', 'X'),
          item('y', 'Y')
        )
      )
    )
  );

  it('select1 -> controlType=select1', () => {
    const fd = parseForm(multiXml);
    const sel = fd.body.find((e) => e.kind === 'question' && e.controlType === 'select1');
    expect(sel).toBeDefined();
  });

  it('select -> controlType=select', () => {
    const fd = parseForm(multiXml);
    const sel = fd.body.find((e) => e.kind === 'question' && e.controlType === 'select');
    expect(sel).toBeDefined();
  });

  it('select1 choices are populated', () => {
    const fd = parseForm(multiXml);
    const sel = fd.body.find((e) => e.kind === 'question' && e.controlType === 'select1');
    if (sel?.kind === 'question') {
      expect(sel.choices.length).toBe(2);
      expect(sel.choices[0]?.value).toBe('a');
    }
  });
});

// ---------------------------------------------------------------------------
// h: namespace prefix robustness (spec global acceptance criterion)
// ---------------------------------------------------------------------------

describe('parseForm: h:-prefixed namespace document', () => {
  // The XFormsElement DSL always emits h:html, h:head, h:body — this tests localName matching
  const nsXml = formXml(
    html(
      head(
        model(
          mainInstance(
            t('data id="ns-test"', t('field'))
          ),
          bind('/data/field').type('int')
        )
      ),
      body(
        input('/data/field', label('Field'))
      )
    )
  );

  it('parses h:-prefixed form without error', () => {
    expect(() => parseForm(nsXml)).not.toThrow();
  });

  it('tree is built correctly under h: prefix', () => {
    const fd = parseForm(nsXml);
    const fieldNode = fd.mainInstance.root.children.find((c) => c.name === 'field');
    expect(fieldNode).toBeDefined();
  });

  it('applyBindings sets dataType=int on the field node', () => {
    const fd = parseForm(nsXml);
    const fieldNode = fd.mainInstance.root.children.find((c) => c.name === 'field');
    expect(fieldNode?.dataType).toBe('int');
  });
});

// ---------------------------------------------------------------------------
// bindProcessor firewall: raw XPath strings preserved
// ---------------------------------------------------------------------------

describe('parseForm: bindProcessor XPath firewall', () => {
  const rawXml = formXml(
    html(
      head(
        model(
          mainInstance(t('data id="raw"', t('age'))),
          bind('/data/age').type('int').relevant('age > 0').calculate('../x')
        )
      ),
      body(input('/data/age'))
    )
  );

  it('relevant is preserved as raw string', () => {
    const fd = parseForm(rawXml);
    expect(fd.bindings.get('/data/age')?.relevant).toBe('age > 0');
  });

  it('calculate is preserved as raw string', () => {
    const fd = parseForm(rawXml);
    expect(fd.bindings.get('/data/age')?.calculate).toBe('../x');
  });
});

// ---------------------------------------------------------------------------
// applyBindings second pass: nodes without binding default to 'string'
// ---------------------------------------------------------------------------

describe('parseForm: applyBindings second pass', () => {
  const noBindXml = formXml(
    html(
      head(
        model(
          mainInstance(t('data id="nb"', t('unbound')))
          // No bind element
        )
      ),
      body(input('/data/unbound'))
    )
  );

  it('unbound node defaults to dataType=string', () => {
    const fd = parseForm(noBindXml);
    const node = fd.mainInstance.root.children.find((c) => c.name === 'unbound');
    expect(node?.dataType).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// parseDocument is callable without XmlParser seam
// ---------------------------------------------------------------------------

describe('parseDocument (seam-free)', () => {
  it('accepts a Document and returns FormDefinition', () => {
    const rawXml = formXml(
      html(
        head(
          model(
            mainInstance(t('data id="doc"', t('q'))),
            bind('/data/q').type('string')
          )
        ),
        body(input('/data/q'))
      )
    );
    const doc = new DOMParser().parseFromString(rawXml, 'text/xml') as unknown as Document;
    expect(() => parseDocument(doc)).not.toThrow();
    const fd = parseDocument(doc);
    expect(fd.mainInstance).toBeDefined();
  });
});

describe('buildInstanceNode (public export — sdd/last-saved-instance)', () => {
  it('is part of the module public surface and builds the expected InstanceNode shape', () => {
    const doc = new DOMParser().parseFromString('<name>Alice</name>', 'text/xml') as unknown as Document;
    const el = doc.documentElement as unknown as Element;

    const node = buildInstanceNode(el);

    expect(node.name).toBe('name');
    expect(node.children).toHaveLength(0);
    expect(getAttribute(node, '__rawText')).toBe('Alice');
  });

  it('assigns sequential multiplicities to same-name siblings without calling appendChild', () => {
    const doc = new DOMParser().parseFromString(
      '<root><item>a</item><item>b</item><item>c</item></root>',
      'text/xml',
    ) as unknown as Document;
    const el = doc.documentElement as unknown as Element;

    const node = buildInstanceNode(el);

    expect(node.children.map((c) => c.multiplicity)).toEqual([0, 1, 2]);
  });

  it('counts a template sibling toward the running count without assigning it a computed multiplicity', () => {
    const doc = new DOMParser().parseFromString(
      '<root xmlns:jr="http://openrosa.org/javarosa"><item jr:template="">t</item><item>a</item><item>b</item></root>',
      'text/xml',
    ) as unknown as Document;
    const el = doc.documentElement as unknown as Element;

    const node = buildInstanceNode(el);

    expect(node.children.map((c) => c.multiplicity)).toEqual([INDEX_TEMPLATE, 1, 2]);
  });

  it('builds a large inline secondary instance (20k same-name children) in near-linear time', () => {
    // Regression test: appendChild(node, buildInstanceNode(child)) used to
    // recompute each child's multiplicity by scanning ALL of the parent's
    // existing same-name children on every call — O(n) per child, O(n²)
    // overall. A 20k-item inline (non-CSV) secondary instance took ~10s to
    // build. Fixed by tracking multiplicity with a running per-name counter
    // instead of appendChild's rescan.
    const N = 20_000;
    const items = Array.from({ length: N }, (_, i) => `<item>${i}</item>`).join('');
    const doc = new DOMParser().parseFromString(`<root>${items}</root>`, 'text/xml') as unknown as Document;
    const el = doc.documentElement as unknown as Element;

    const t0 = performance.now();
    const node = buildInstanceNode(el);
    const elapsedMs = performance.now() - t0;

    expect(node.children).toHaveLength(N);
    expect(node.children[0]!.multiplicity).toBe(0);
    expect(node.children[N - 1]!.multiplicity).toBe(N - 1);
    // O(n²) would take multiple seconds at this size; O(n) finishes in well
    // under a second even on a loaded CI runner.
    expect(elapsedMs).toBeLessThan(5000);
  });
});
