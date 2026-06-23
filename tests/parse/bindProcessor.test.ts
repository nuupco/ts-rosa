/**
 * Tests for bindProcessor (T-1.4.1 RED → T-1.4.2 GREEN)
 */

import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { bindProcessor, dataTypeFromBindType } from '../../src/parse/bindProcessor.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseElement(xml: string): Element {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return doc.documentElement as unknown as Element;
}

function makeBindElement(attrs: Record<string, string>): Element {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return parseElement(`<bind ${attrStr}/>`);
}

// ---------------------------------------------------------------------------
// dataTypeFromBindType
// ---------------------------------------------------------------------------

describe('dataTypeFromBindType', () => {
  it('maps "int" -> "int"', () => {
    expect(dataTypeFromBindType('int')).toBe('int');
  });

  it('maps "string" -> "string"', () => {
    expect(dataTypeFromBindType('string')).toBe('string');
  });

  it('null type -> "string" (default)', () => {
    expect(dataTypeFromBindType(null)).toBe('string');
  });

  it('maps "xsd:int" -> "int"', () => {
    expect(dataTypeFromBindType('xsd:int')).toBe('int');
  });

  it('maps "xsd:boolean" -> "boolean"', () => {
    expect(dataTypeFromBindType('xsd:boolean')).toBe('boolean');
  });

  it('uses control hint: null type + "select1" hint -> "selectOne"', () => {
    expect(dataTypeFromBindType(null, 'select1')).toBe('selectOne');
  });

  it('uses control hint: null type + "select" hint -> "selectMulti"', () => {
    expect(dataTypeFromBindType(null, 'select')).toBe('selectMulti');
  });

  it('explicit type wins over control hint', () => {
    expect(dataTypeFromBindType('int', 'select1')).toBe('int');
  });
});

// ---------------------------------------------------------------------------
// bindProcessor
// ---------------------------------------------------------------------------

describe('bindProcessor', () => {
  it('returns empty map for empty array', () => {
    const result = bindProcessor([]);
    expect(result.size).toBe(0);
  });

  it('extracts nodeset and dataType from a simple bind', () => {
    const el = makeBindElement({ nodeset: '/data/name', type: 'string' });
    const map = bindProcessor([el]);
    expect(map.has('/data/name')).toBe(true);
    const binding = map.get('/data/name')!;
    expect(binding.nodeset).toBe('/data/name');
    expect(binding.dataType).toBe('string');
  });

  it('extracts int dataType', () => {
    const el = makeBindElement({ nodeset: '/data/age', type: 'int' });
    const map = bindProcessor([el]);
    expect(map.get('/data/age')?.dataType).toBe('int');
  });

  it('defaults dataType to "string" when type attr absent', () => {
    const el = makeBindElement({ nodeset: '/data/q' });
    const map = bindProcessor([el]);
    expect(map.get('/data/q')?.dataType).toBe('string');
  });

  it('copies relevant as raw string (spec scenario)', () => {
    const el = makeBindElement({ nodeset: '/data/q', type: 'string', relevant: 'age > 0' });
    const map = bindProcessor([el]);
    expect(map.get('/data/q')?.relevant).toBe('age > 0');
  });

  it('copies calculate as raw string (spec scenario)', () => {
    const el = makeBindElement({ nodeset: '/data/q', type: 'string', calculate: '../x' });
    const map = bindProcessor([el]);
    expect(map.get('/data/q')?.calculate).toBe('../x');
  });

  it('sets relevant to null when absent', () => {
    const el = makeBindElement({ nodeset: '/data/q', type: 'string' });
    const map = bindProcessor([el]);
    expect(map.get('/data/q')?.relevant).toBeNull();
  });

  it('parses ref field from nodeset', () => {
    const el = makeBindElement({ nodeset: '/data/name', type: 'string' });
    const map = bindProcessor([el]);
    const binding = map.get('/data/name')!;
    expect(binding.ref).toBeDefined();
    expect(binding.ref.levels.length).toBe(2); // data + name
  });

  it('handles multiple binds', () => {
    const els = [
      makeBindElement({ nodeset: '/data/name', type: 'string' }),
      makeBindElement({ nodeset: '/data/age', type: 'int' }),
    ];
    const map = bindProcessor(els);
    expect(map.size).toBe(2);
    expect(map.get('/data/name')?.dataType).toBe('string');
    expect(map.get('/data/age')?.dataType).toBe('int');
  });
});
