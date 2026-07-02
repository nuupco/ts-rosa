/**
 * parseCsv — dependency-free RFC-4180 subset CSV parser.
 *
 * Supported: comma delimiter, double-quote-wrapped fields (may contain
 * commas/newlines), `""` escape for a literal quote inside a quoted field,
 * LF and CRLF line endings, a leading UTF-8 BOM (stripped), and a single
 * trailing newline (ignored — does not produce a trailing empty row).
 *
 * Not supported (out of scope, see design ADR-4): custom delimiters,
 * comment lines. An unterminated quoted field throws.
 */

const BOM = '﻿';

export function parseCsv(text: string): string[][] {
  const src = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  if (src.length === 0) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  let sawAnyFieldOnLine = false;

  const endField = (): void => {
    row.push(field);
    field = '';
  };

  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
    sawAnyFieldOnLine = false;
  };

  while (i < src.length) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field.length === 0) {
      inQuotes = true;
      sawAnyFieldOnLine = true;
      i += 1;
      continue;
    }

    if (ch === ',') {
      sawAnyFieldOnLine = true;
      endField();
      i += 1;
      continue;
    }

    if (ch === '\r') {
      if (src[i + 1] === '\n') {
        endRow();
        i += 2;
        continue;
      }
      endRow();
      i += 1;
      continue;
    }

    if (ch === '\n') {
      endRow();
      i += 1;
      continue;
    }

    sawAnyFieldOnLine = true;
    field += ch;
    i += 1;
  }

  if (inQuotes) {
    throw new Error('parseCsv: unterminated quoted field');
  }

  // Flush the final row unless it's an empty trailing line (trailing newline case).
  if (field.length > 0 || sawAnyFieldOnLine || row.length > 0) {
    endRow();
  }

  return rows;
}
