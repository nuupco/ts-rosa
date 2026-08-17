/**
 * Unit tests — InstanceHydrator.hydrateInstance()
 *
 * sdd/instance-editing-hydration, PR1, tasks 1-11.
 *
 * Fully isolated: exercises `hydrateInstance` standalone via `parseForm`,
 * with NO dependency on FormSession/FormEvaluator/FormNavigator.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../../src/parse/XFormParser.ts';
import {
  hydrateInstance,
  HydrationError,
} from '../../../src/model/instance/InstanceHydrator.ts';
import { INDEX_TEMPLATE } from '../../../src/model/instance/multiplicity.ts';
import { getAttribute, type InstanceNode } from '../../../src/model/instance/InstanceNode.ts';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  bind,
  input,
  repeat,
  t,
  title,
} from '../../harness/XFormsElement.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function simpleForm() {
  return html(
    head(
      title('Simple'),
      model(
        mainInstance(t('data id="simple"', t('a'), t('b'))),
        bind('/data/a').type('int'),
        bind('/data/b').type('string'),
      ),
    ),
    body(input('/data/a'), input('/data/b')),
  );
}

function containerForm() {
  return html(
    head(
      title('Container'),
      model(
        mainInstance(t('data id="container"', t('grp', t('a')))),
        bind('/data/grp/a').type('int'),
      ),
    ),
    body(input('/data/grp/a')),
  );
}

function simpleRepeatForm() {
  return html(
    head(
      title('Simple Repeat'),
      model(
        mainInstance(t('data id="simple-repeat"', t('repeat jr:template=""', t('q')))),
        bind('/data/repeat/q').type('int'),
      ),
    ),
    body(repeat('/data/repeat', input('/data/repeat/q'))),
  );
}

function nestedRepeatForm() {
  return html(
    head(
      title('Nested Repeat'),
      model(
        mainInstance(
          t(
            'data id="nested-repeat"',
            t('outer jr:template=""', t('label'), t('inner jr:template=""', t('q'))),
          ),
        ),
        bind('/data/outer/label').type('string'),
        bind('/data/outer/inner/q').type('int'),
      ),
    ),
    body(repeat('/data/outer', input('/data/outer/label'), repeat('/data/outer/inner', input('/data/outer/inner/q')))),
  );
}

function findChildren(node: InstanceNode, name: string): InstanceNode[] {
  return node.children.filter((c) => c.name === name);
}

function findInstances(node: InstanceNode, name: string): InstanceNode[] {
  return node.children.filter((c) => c.name === name && c.multiplicity !== INDEX_TEMPLATE);
}

function findTemplate(node: InstanceNode, name: string): InstanceNode | undefined {
  return node.children.find((c) => c.name === name && c.multiplicity === INDEX_TEMPLATE);
}

// ---------------------------------------------------------------------------
// Task 1: leaf scalar cast, cast failure, container recursion, missing default
// ---------------------------------------------------------------------------

describe('hydrateInstance — leaf and container basics', () => {
  it('casts leaf scalar values to typed AnswerValue', () => {
    const definition = parseForm(simpleForm().asXml());
    const xml = '<data id="simple"><a>42</a><b>hello</b></data>';

    const tree = hydrateInstance(definition, xml);

    const a = findChildren(tree.root, 'a')[0]!;
    const b = findChildren(tree.root, 'b')[0]!;
    expect(a.value).toEqual({ kind: 'int', value: 42, displayText: '42' });
    expect(b.value).toEqual({ kind: 'string', value: 'hello', displayText: 'hello' });
  });

  it('throws HydrationError with path when a leaf value fails cast()', () => {
    const definition = parseForm(simpleForm().asXml());
    const xml = '<data id="simple"><a>not-a-number</a><b>hello</b></data>';

    expect(() => hydrateInstance(definition, xml)).toThrow(HydrationError);
    expect(() => hydrateInstance(definition, xml)).toThrow(/\/data\/a/);
  });

  it('recurses into container nodes', () => {
    const definition = parseForm(containerForm().asXml());
    const xml = '<data id="container"><grp><a>7</a></grp></data>';

    const tree = hydrateInstance(definition, xml);

    const grp = findChildren(tree.root, 'grp')[0]!;
    const a = findChildren(grp, 'a')[0]!;
    expect(a.value).toEqual({ kind: 'int', value: 7, displayText: '7' });
  });

  it('defaults an optional node missing from the XML to its template value', () => {
    const definition = parseForm(simpleForm().asXml());
    const xml = '<data id="simple"><a>1</a></data>';

    const tree = hydrateInstance(definition, xml);

    const b = findChildren(tree.root, 'b')[0]!;
    // Template default for a plain string leaf with no text content is null.
    expect(b.value).toBeNull();
  });

  it('does not mutate the shared form definition tree', () => {
    const definition = parseForm(simpleForm().asXml());
    const xml = '<data id="simple"><a>42</a><b>hello</b></data>';

    hydrateInstance(definition, xml);

    const defA = findChildren(definition.mainInstance.root, 'a')[0]!;
    expect(defA.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 4/5: repeat multiplicity — multiple instances
// ---------------------------------------------------------------------------

describe('hydrateInstance — repeat multiplicity', () => {
  it('expands a repeat template to match the XML instance count, preserving the template', () => {
    const definition = parseForm(simpleRepeatForm().asXml());
    const xml =
      '<data id="simple-repeat"><repeat><q>1</q></repeat><repeat><q>2</q></repeat><repeat><q>3</q></repeat></data>';

    const tree = hydrateInstance(definition, xml);

    const instances = findInstances(tree.root, 'repeat');
    expect(instances).toHaveLength(3);
    expect(instances.map((i) => findChildren(i, 'q')[0]!.value)).toEqual([
      { kind: 'int', value: 1, displayText: '1' },
      { kind: 'int', value: 2, displayText: '2' },
      { kind: 'int', value: 3, displayText: '3' },
    ]);
    expect(instances.map((i) => i.multiplicity)).toEqual([0, 1, 2]);
    expect(findTemplate(tree.root, 'repeat')).toBeDefined();
  });

  // Task 6: zero instances
  it('leaves zero instance nodes and preserves the template when the XML has none', () => {
    const definition = parseForm(simpleRepeatForm().asXml());
    const xml = '<data id="simple-repeat"></data>';

    const tree = hydrateInstance(definition, xml);

    expect(findInstances(tree.root, 'repeat')).toHaveLength(0);
    expect(findTemplate(tree.root, 'repeat')).toBeDefined();
  });

  // Task 7: nested repeats
  it('populates nested repeats independently per outer instance, with varying counts', () => {
    const definition = parseForm(nestedRepeatForm().asXml());
    const xml =
      '<data id="nested-repeat">' +
      '<outer><label>first</label><inner><q>1</q></inner><inner><q>2</q></inner></outer>' +
      '<outer><label>second</label></outer>' +
      '<outer><label>third</label><inner><q>9</q></inner></outer>' +
      '</data>';

    const tree = hydrateInstance(definition, xml);

    const outers = findInstances(tree.root, 'outer');
    expect(outers).toHaveLength(3);

    expect(findChildren(outers[0]!, 'label')[0]!.value).toEqual({
      kind: 'string',
      value: 'first',
      displayText: 'first',
    });
    const innersOfFirst = findInstances(outers[0]!, 'inner');
    expect(innersOfFirst).toHaveLength(2);
    expect(innersOfFirst.map((i) => findChildren(i, 'q')[0]!.value)).toEqual([
      { kind: 'int', value: 1, displayText: '1' },
      { kind: 'int', value: 2, displayText: '2' },
    ]);

    const innersOfSecond = findInstances(outers[1]!, 'inner');
    expect(innersOfSecond).toHaveLength(0);
    expect(findTemplate(outers[1]!, 'inner')).toBeDefined();

    const innersOfThird = findInstances(outers[2]!, 'inner');
    expect(innersOfThird).toHaveLength(1);
    expect(findChildren(innersOfThird[0]!, 'q')[0]!.value).toEqual({
      kind: 'int',
      value: 9,
      displayText: '9',
    });
  });
});

// ---------------------------------------------------------------------------
// Task 8/9: drift policy — strict on extras / unexpected multiplicity
// ---------------------------------------------------------------------------

describe('hydrateInstance — drift policy (strict-on-extra)', () => {
  it('throws HydrationError on an unknown extra node, identifying its path', () => {
    const definition = parseForm(simpleForm().asXml());
    const xml = '<data id="simple"><a>1</a><b>x</b><surprise>oops</surprise></data>';

    expect(() => hydrateInstance(definition, xml)).toThrow(HydrationError);
    expect(() => hydrateInstance(definition, xml)).toThrow(/\/data\/surprise/);
  });

  it('throws HydrationError on multiple elements for a declared non-repeat node', () => {
    const definition = parseForm(simpleForm().asXml());
    const xml = '<data id="simple"><a>1</a><a>2</a><b>x</b></data>';

    expect(() => hydrateInstance(definition, xml)).toThrow(HydrationError);
    expect(() => hydrateInstance(definition, xml)).toThrow(/\/data\/a/);
  });

  it('throws HydrationError on root name mismatch before any tree mutation', () => {
    const definition = parseForm(simpleForm().asXml());
    const xml = '<other id="simple"><a>1</a></other>';

    expect(() => hydrateInstance(definition, xml)).toThrow(HydrationError);
    expect(() => hydrateInstance(definition, xml)).toThrow(/root mismatch/);
  });
});

// ---------------------------------------------------------------------------
// Task 10: attribute round-trip
// ---------------------------------------------------------------------------

describe('hydrateInstance — attribute round-trip (ADR-D)', () => {
  it('copies submission attributes onto hydrated nodes, excluding xmlns*, overwriting template attrs', () => {
    const definition = parseForm(containerForm().asXml());
    const xml =
      '<data id="container" xmlns:jr="http://openrosa.org/javarosa" instanceID="uuid:abc">' +
      '<grp foo="bar"><a>5</a></grp></data>';

    const tree = hydrateInstance(definition, xml);

    expect(getAttribute(tree.root, 'id')).toBe('container');
    expect(getAttribute(tree.root, 'instanceID')).toBe('uuid:abc');
    expect(getAttribute(tree.root, 'xmlns:jr')).toBeUndefined();

    const grp = findChildren(tree.root, 'grp')[0]!;
    expect(getAttribute(grp, 'foo')).toBe('bar');
  });
});
