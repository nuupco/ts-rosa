import { describe, it, expect } from 'vitest';
import { parseCsv } from '../../../src/parse/csv/parseCsv.ts';

describe('parseCsv', () => {
  it('parses basic comma-separated rows', () => {
    const result = parseCsv('name,region\nMerida,Yucatan\nOaxaca,Oaxaca\n');
    expect(result).toEqual([
      ['name', 'region'],
      ['Merida', 'Yucatan'],
      ['Oaxaca', 'Oaxaca'],
    ]);
  });

  it('parses quoted fields containing embedded commas', () => {
    const result = parseCsv('name,note\n"Merida, MX",capital\n');
    expect(result).toEqual([
      ['name', 'note'],
      ['Merida, MX', 'capital'],
    ]);
  });

  it('handles "" escape for a literal quote inside a quoted field', () => {
    const result = parseCsv('name,quote\n"Say ""hi""",greeting\n');
    expect(result).toEqual([
      ['name', 'quote'],
      ['Say "hi"', 'greeting'],
    ]);
  });

  it('handles quoted fields containing embedded newlines', () => {
    const result = parseCsv('name,note\n"line1\nline2",x\n');
    expect(result).toEqual([
      ['name', 'note'],
      ['line1\nline2', 'x'],
    ]);
  });

  it('supports CRLF line endings', () => {
    const result = parseCsv('name,region\r\nMerida,Yucatan\r\n');
    expect(result).toEqual([
      ['name', 'region'],
      ['Merida', 'Yucatan'],
    ]);
  });

  it('supports LF line endings', () => {
    const result = parseCsv('name,region\nMerida,Yucatan\n');
    expect(result).toEqual([
      ['name', 'region'],
      ['Merida', 'Yucatan'],
    ]);
  });

  it('strips a leading UTF-8 BOM', () => {
    const result = parseCsv('﻿name,region\nMerida,Yucatan\n');
    expect(result).toEqual([
      ['name', 'region'],
      ['Merida', 'Yucatan'],
    ]);
  });

  it('ignores a trailing newline', () => {
    const withTrailing = parseCsv('name,region\nMerida,Yucatan\n');
    const withoutTrailing = parseCsv('name,region\nMerida,Yucatan');
    expect(withTrailing).toEqual(withoutTrailing);
  });

  it('returns an empty array for an empty file', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('returns just the header row for a header-only file', () => {
    expect(parseCsv('name,region\n')).toEqual([['name', 'region']]);
  });

  it('throws a clear error for an unterminated quoted field', () => {
    expect(() => parseCsv('name,region\n"Merida,Yucatan\n')).toThrow(/unterminated quoted field/i);
  });
});
