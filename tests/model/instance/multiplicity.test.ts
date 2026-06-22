import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MULTIPLICITY,
  INDEX_UNBOUND,
  INDEX_TEMPLATE,
  INDEX_ATTRIBUTE,
  type Multiplicity,
} from '../../../src/model/instance/multiplicity';

describe('multiplicity constants', () => {
  it('DEFAULT_MULTIPLICITY === 0', () => {
    expect(DEFAULT_MULTIPLICITY).toBe(0);
  });

  it('INDEX_UNBOUND === -1', () => {
    expect(INDEX_UNBOUND).toBe(-1);
  });

  it('INDEX_TEMPLATE === -2', () => {
    expect(INDEX_TEMPLATE).toBe(-2);
  });

  it('INDEX_ATTRIBUTE === -4', () => {
    expect(INDEX_ATTRIBUTE).toBe(-4);
  });

  it('Multiplicity type is assignable from number', () => {
    const m: Multiplicity = 0;
    expect(typeof m).toBe('number');
  });
});
