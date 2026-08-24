/**
 * Unit tests — `normalizeEvent` token acceptance/rejection.
 *
 * sdd/setvalue-parity PR1 (Layer A: parser, multi-event + jr-insert gating).
 */

import { describe, it, expect } from 'vitest';
import { normalizeEvent } from '../../../src/eval/SetValueAction.ts';

describe('normalizeEvent', () => {
  it('accepts odk-instance-first-load', () => {
    expect(normalizeEvent('odk-instance-first-load')).toBe('odk-instance-first-load');
  });

  it('accepts the xforms-ready alias, normalizing to odk-instance-first-load', () => {
    expect(normalizeEvent('xforms-ready')).toBe('odk-instance-first-load');
  });

  it('accepts xforms-value-changed', () => {
    expect(normalizeEvent('xforms-value-changed')).toBe('xforms-value-changed');
  });

  it('accepts odk-new-repeat', () => {
    expect(normalizeEvent('odk-new-repeat')).toBe('odk-new-repeat');
  });

  it('accepts jr-insert (hyphenated, deprecated, not namespaced)', () => {
    expect(normalizeEvent('jr-insert')).toBe('jr-insert');
  });

  it('rejects the namespaced form jr:insert', () => {
    expect(normalizeEvent('jr:insert')).toBeNull();
  });

  it('rejects xforms-revalidate (explicitly out of scope for this change)', () => {
    expect(normalizeEvent('xforms-revalidate')).toBeNull();
  });

  it('rejects an unknown token', () => {
    expect(normalizeEvent('not-a-real-event')).toBeNull();
  });

  it('rejects null', () => {
    expect(normalizeEvent(null)).toBeNull();
  });

  it('rejects an empty/whitespace-only token', () => {
    expect(normalizeEvent('')).toBeNull();
    expect(normalizeEvent('   ')).toBeNull();
  });

  it('trims surrounding whitespace before matching', () => {
    expect(normalizeEvent('  xforms-value-changed  ')).toBe('xforms-value-changed');
  });
});
