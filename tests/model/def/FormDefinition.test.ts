import { describe, it, expect, vi } from 'vitest';
import { controlTypeFromTag, type ControlType } from '../../../src/model/def/controlType';
import type { DataBinding } from '../../../src/model/def/DataBinding';
import type { FormElement } from '../../../src/model/def/FormElement';
import type { FormDefinition } from '../../../src/model/def/FormDefinition';
import { walkControls } from '../../../src/model/def/FormDefinition';
import { parseAbsoluteRef } from '../../../src/model/instance/TreeReference';

// ---- controlType ----

describe('controlTypeFromTag', () => {
  it('maps input → input', () => {
    expect(controlTypeFromTag('input')).toBe('input');
  });

  it('maps select1 → select1', () => {
    expect(controlTypeFromTag('select1')).toBe('select1');
  });

  it('maps select → select', () => {
    expect(controlTypeFromTag('select')).toBe('select');
  });

  it('maps trigger → trigger', () => {
    expect(controlTypeFromTag('trigger')).toBe('trigger');
  });

  it('maps upload → upload', () => {
    expect(controlTypeFromTag('upload')).toBe('upload');
  });

  it('unknown tag → unknown', () => {
    expect(controlTypeFromTag('blah')).toBe('unknown');
  });

  it('exhaustive: ControlType covers expected literals', () => {
    // Type-level check — if ControlType changes, this will fail to compile
    const _types: ControlType[] = ['input', 'select1', 'select', 'trigger', 'upload', 'unknown'];
    expect(_types).toHaveLength(6);
  });
});

// ---- DataBinding ----

describe('DataBinding', () => {
  it('stores raw XPath strings unchanged', () => {
    const binding: DataBinding = {
      nodeset: '/data/name',
      ref: parseAbsoluteRef('/data/name'),
      dataType: 'string',
      relevant: 'true()',
      required: null,
      readonly_: null,
      calculate: '../age + 1',
      constraint: null,
      constraintMsg: null,
      preload: null,
      preloadParams: null,
    };
    expect(binding.relevant).toBe('true()');
    expect(binding.calculate).toBe('../age + 1');
  });

  it('missing optional fields are null (set explicitly)', () => {
    const binding: DataBinding = {
      nodeset: '/data/age',
      ref: parseAbsoluteRef('/data/age'),
      dataType: 'int',
      relevant: null,
      required: null,
      readonly_: null,
      calculate: null,
      constraint: null,
      constraintMsg: null,
      preload: null,
      preloadParams: null,
    };
    expect(binding.relevant).toBeNull();
    expect(binding.calculate).toBeNull();
  });

  it('binding is structurally typed — no extra props required', () => {
    // just a compile-time check: DataBinding is assignable from a matching shape
    const b: DataBinding = {
      nodeset: '/d/x',
      ref: parseAbsoluteRef('/d/x'),
      dataType: 'boolean',
      relevant: null,
      required: null,
      readonly_: null,
      calculate: null,
      constraint: 'string-length(.) < 5',
      constraintMsg: 'Too long',
      preload: null,
      preloadParams: null,
    };
    expect(b.constraint).toBe('string-length(.) < 5');
    expect(b.constraintMsg).toBe('Too long');
  });
});

// ---- FormElement ----

describe('FormElement discriminated union', () => {
  it('kind=question has required fields', () => {
    const q: FormElement = {
      kind: 'question',
      ref: parseAbsoluteRef('/data/name'),
      controlType: 'input',
      binding: null,
      labelText: 'Your name',
      labelInnerText: 'Your name',
      choices: [],
      itemset: null,
    };
    expect(q.kind).toBe('question');
    if (q.kind === 'question') {
      expect(q.controlType).toBe('input');
      expect(q.labelText).toBe('Your name');
    }
  });

  it('kind=group has children and no controlType', () => {
    const g: FormElement = {
      kind: 'group',
      ref: parseAbsoluteRef('/data/section'),
      children: [],
      labelText: null,
    };
    expect(g.kind).toBe('group');
    expect(g.children).toHaveLength(0);
  });

  it('kind=repeat is structurally valid', () => {
    const r: FormElement = {
      kind: 'repeat',
      ref: parseAbsoluteRef('/data/items'),
      children: [],
      labelText: null,
      countExpr: null,
    };
    expect(r.kind).toBe('repeat');
  });
});

// ---- FormDefinition + walkControls ----

describe('FormDefinition and walkControls', () => {
  function makeSimpleDef(): FormDefinition {
    const q1: FormElement = {
      kind: 'question',
      ref: parseAbsoluteRef('/data/name'),
      controlType: 'input',
      binding: null,
      labelText: 'Name',
      labelInnerText: 'Name',
      choices: [],
      itemset: null,
    };
    const q2: FormElement = {
      kind: 'question',
      ref: parseAbsoluteRef('/data/age'),
      controlType: 'input',
      binding: null,
      labelText: 'Age',
      labelInnerText: 'Age',
      choices: [],
      itemset: null,
    };
    const group: FormElement = {
      kind: 'group',
      ref: parseAbsoluteRef('/data/meta'),
      children: [q2],
      labelText: null,
    };

    return {
      title: 'Test Form',
      mainInstance: { root: { name: 'data', multiplicity: 0, value: null, children: [], attributes: new Map(), dataType: 'string', parent: null }, name: null },
      bindings: new Map(),
      body: [q1, group],
      dag: null,
      constraintBindings: new Map(),
      itext: null,
      secondaryInstances: new Map(),
    };
  }

  it('can be manually constructed', () => {
    const def = makeSimpleDef();
    expect(def.title).toBe('Test Form');
    expect(def.body).toHaveLength(2);
  });

  it('walkControls visits questions in document order', () => {
    const def = makeSimpleDef();
    const visited: string[] = [];
    walkControls(def, (q) => {
      // ref levels[0].name identifies the question
      visited.push(q.ref.levels[q.ref.levels.length - 1]!.name);
    });
    expect(visited).toEqual(['name', 'age']);
  });

  it('walkControls calls visitor once per question (not groups)', () => {
    const def = makeSimpleDef();
    const visitor = vi.fn();
    walkControls(def, visitor);
    expect(visitor).toHaveBeenCalledTimes(2);
  });

  it('walkControls receives FormElement with kind=question', () => {
    const def = makeSimpleDef();
    walkControls(def, (q) => {
      expect(q.kind).toBe('question');
    });
  });

  it('select1 question carries choices', () => {
    const q: FormElement = {
      kind: 'question',
      ref: parseAbsoluteRef('/data/color'),
      controlType: 'select1',
      binding: null,
      labelText: 'Color',
      labelInnerText: 'Color',
      choices: [
        { value: 'red', labelText: 'Red' },
        { value: 'blue', labelText: 'Blue' },
      ],
      itemset: null,
    };
    if (q.kind === 'question') {
      expect(q.choices).toHaveLength(2);
      expect(q.choices[0]!.value).toBe('red');
    }
  });

  it('question can carry optional range bounds', () => {
    const q: FormElement = {
      kind: 'question',
      ref: parseAbsoluteRef('/data/rating'),
      controlType: 'range',
      binding: null,
      labelText: 'Rate',
      labelInnerText: 'Rate',
      choices: [],
      itemset: null,
      rangeStart: 1,
      rangeEnd: 100,
      rangeStep: 5,
    };
    if (q.kind === 'question') {
      expect(q.rangeStart).toBe(1);
      expect(q.rangeEnd).toBe(100);
      expect(q.rangeStep).toBe(5);
    }
  });
});
