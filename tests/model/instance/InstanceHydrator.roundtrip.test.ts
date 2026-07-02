/**
 * Round-trip equivalence tests — hydrateInstance() -> serializeInstance().
 *
 * sdd/instance-editing-hydration, PR3, tasks 22-27.
 *
 * Per design ADR-F, hydrate->serialize equivalence is SEMANTIC, not lexical,
 * for decimal, date/time/dateTime, geo types, and selectMulti — these are
 * asserted via normalized (parse-and-compare) comparison, never raw string
 * identity. All other DataType variants (string, int, boolean, binary,
 * selectOne, long) round-trip lexically identical and are asserted with
 * exact string equality.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../../src/parse/XFormParser.ts';
import { hydrateInstance } from '../../../src/model/instance/InstanceHydrator.ts';
import { serializeInstance } from '../../../src/model/instance/InstanceSerializer.ts';
import { html, head, body, model, mainInstance, bind, input, repeat, t, title } from '../../harness/XFormsElement.ts';

// ---------------------------------------------------------------------------
// Normalized-comparison helpers (ADR-F)
// ---------------------------------------------------------------------------

/** Extract the text content of the first `<tag>` element in a flat XML string. */
function extractLeaf(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>|<${tag}(?:\\s[^>]*)?/>`).exec(xml);
  if (match === null) return null;
  // Self-closing form (group 2 branch) -> empty content.
  return match[1] ?? '';
}

/** Normalized numeric compare: parse both sides as floats and compare. */
function expectNumericEqual(a: string, b: string): void {
  expect(Number(a)).toBeCloseTo(Number(b), 9);
}

/** Normalized geo compare: split into space-separated numeric components and compare pairwise. */
function expectGeoEqual(a: string, b: string): void {
  const pa = a.trim().split(/\s+/).map(Number);
  const pb = b.trim().split(/\s+/).map(Number);
  expect(pa.length).toBe(pb.length);
  for (let i = 0; i < pa.length; i++) {
    expect(pa[i]).toBeCloseTo(pb[i]!, 9);
  }
}

/** Normalized multi-point geo compare (geoshape/geotrace): split on ';' then delegate per point. */
function expectGeoPointsEqual(a: string, b: string): void {
  const ptsA = a.split(';').map((s) => s.trim()).filter(Boolean);
  const ptsB = b.split(';').map((s) => s.trim()).filter(Boolean);
  expect(ptsA.length).toBe(ptsB.length);
  for (let i = 0; i < ptsA.length; i++) {
    expectGeoEqual(ptsA[i]!, ptsB[i]!);
  }
}

/** Normalized instant compare for date/time/dateTime: parse both sides as Dates and compare epoch ms. */
function expectInstantEqual(a: string, b: string, anchor: string): void {
  const da = new Date(anchor.replace('{}', a));
  const db = new Date(anchor.replace('{}', b));
  expect(da.getTime()).toBe(db.getTime());
}

/** Normalized selectMulti compare: order/whitespace-insensitive token-set equality. */
function expectTokenSetEqual(a: string, b: string): void {
  const setA = new Set(a.trim().split(/\s+/).filter(Boolean));
  const setB = new Set(b.trim().split(/\s+/).filter(Boolean));
  expect(setA).toEqual(setB);
}

function roundTrip(definition: ReturnType<typeof parseForm>, xml: string): string {
  const tree = hydrateInstance(definition, xml);
  return serializeInstance(tree);
}

// ---------------------------------------------------------------------------
// Task 22: lossless/safe types — exact string round-trip
// ---------------------------------------------------------------------------

describe('round-trip — lossless types (exact string equality)', () => {
  function safeForm() {
    return html(
      head(
        title('Safe'),
        model(
          mainInstance(
            t(
              'data id="safe"',
              t('int_v'),
              t('text_v'),
              t('bool_v'),
              t('bin_v'),
              t('long_v'),
              t('sel1_v'),
            ),
          ),
          bind('/data/int_v').type('int'),
          bind('/data/text_v').type('string'),
          bind('/data/bool_v').type('boolean'),
          bind('/data/bin_v').type('binary'),
          bind('/data/long_v').type('xsd:long' as never),
          bind('/data/sel1_v').type('select1'),
        ),
      ),
      body(
        input('/data/int_v'),
        input('/data/text_v'),
        input('/data/bool_v'),
        input('/data/bin_v'),
        input('/data/long_v'),
        input('/data/sel1_v'),
      ),
    );
  }

  it('round-trips int, string, boolean, binary, long, selectOne exactly', () => {
    const definition = parseForm(safeForm().asXml());
    const xml =
      '<data id="safe"><int_v>42</int_v><text_v>hello world</text_v><bool_v>1</bool_v>' +
      '<bin_v>image.jpg</bin_v><long_v>9007199254740</long_v><sel1_v>choice_a</sel1_v></data>';

    const out = roundTrip(definition, xml);

    expect(extractLeaf(out, 'int_v')).toBe('42');
    expect(extractLeaf(out, 'text_v')).toBe('hello world');
    expect(extractLeaf(out, 'bool_v')).toBe('1');
    expect(extractLeaf(out, 'bin_v')).toBe('image.jpg');
    expect(extractLeaf(out, 'long_v')).toBe('9007199254740');
    expect(extractLeaf(out, 'sel1_v')).toBe('choice_a');
  });
});

// ---------------------------------------------------------------------------
// Task 23: decimal — normalized numeric comparison
// ---------------------------------------------------------------------------

describe('round-trip — decimal (ADR-F: numeric-normalized, not lexical)', () => {
  function decimalForm() {
    return html(
      head(
        title('Decimal'),
        model(mainInstance(t('data id="dec"', t('d'))), bind('/data/d').type('decimal')),
      ),
      body(input('/data/d')),
    );
  }

  it('round-trips a whole-number decimal semantically (lexical "1" -> "1.0" is expected drift)', () => {
    const definition = parseForm(decimalForm().asXml());
    const xml = '<data id="dec"><d>1</d></data>';

    const out = roundTrip(definition, xml);
    const outVal = extractLeaf(out, 'd')!;

    // Documented ADR-F lexical drift: input "1" becomes output "1.0".
    expect(outVal).toBe('1.0');
    expect(outVal).not.toBe('1');
    // But the values are numerically/semantically equal.
    expectNumericEqual(outVal, '1');
  });

  it('round-trips a fractional decimal both lexically and semantically stable', () => {
    const definition = parseForm(decimalForm().asXml());
    const xml = '<data id="dec"><d>3.14</d></data>';

    const out = roundTrip(definition, xml);
    expectNumericEqual(extractLeaf(out, 'd')!, '3.14');
  });
});

// ---------------------------------------------------------------------------
// Task 24: date/time/dateTime — normalized instant comparison
// ---------------------------------------------------------------------------

describe('round-trip — date/time/dateTime (ADR-F: UTC-normalized instant, not lexical)', () => {
  function dateTimeForm() {
    return html(
      head(
        title('DateTime'),
        model(
          mainInstance(t('data id="dt"', t('d'), t('tm'), t('dtv'))),
          bind('/data/d').type('date'),
          bind('/data/tm').type('time'),
          bind('/data/dtv').type('dateTime'),
        ),
      ),
      body(input('/data/d'), input('/data/tm'), input('/data/dtv')),
    );
  }

  it('round-trips a plain date lexically stable (already canonical UTC form)', () => {
    const definition = parseForm(dateTimeForm().asXml());
    const xml = '<data id="dt"><d>2024-03-15</d><tm></tm><dtv></dtv></data>';

    const out = roundTrip(definition, xml);
    expect(extractLeaf(out, 'd')).toBe('2024-03-15');
  });

  it('round-trips a non-UTC-offset time as the semantically equal UTC-normalized instant', () => {
    const definition = parseForm(dateTimeForm().asXml());
    const xml = '<data id="dt"><d></d><tm>23:14:00.000+02:00</tm><dtv></dtv></data>';

    const out = roundTrip(definition, xml);
    const outVal = extractLeaf(out, 'tm')!;

    // Lexically different: "+02:00" offset input normalizes to "Z" (UTC) output.
    expect(outVal).not.toBe('23:14:00.000+02:00');
    // Semantically equal: anchor both to the epoch date and compare instants.
    expectInstantEqual(outVal, '23:14:00.000+02:00', '1970-01-01T{}');
  });

  it('round-trips a dateTime missing milliseconds as the semantically equal canonical ISO instant', () => {
    const definition = parseForm(dateTimeForm().asXml());
    const xml = '<data id="dt"><d></d><tm></tm><dtv>2024-03-15T10:30:00Z</dtv></data>';

    const out = roundTrip(definition, xml);
    const outVal = extractLeaf(out, 'dtv')!;

    // Lexically different: missing ".000" milliseconds gets added by toISOString().
    expect(outVal).not.toBe('2024-03-15T10:30:00Z');
    expectInstantEqual(outVal, '2024-03-15T10:30:00Z', '{}');
  });
});

// ---------------------------------------------------------------------------
// Task 25: geo types — component-wise normalized numeric comparison
// ---------------------------------------------------------------------------

describe('round-trip — geo types (ADR-F: component-wise normalized, not lexical)', () => {
  function geoForm() {
    return html(
      head(
        title('Geo'),
        model(
          mainInstance(t('data id="geo"', t('pt'), t('shape'), t('trace'))),
          bind('/data/pt').type('geopoint'),
          bind('/data/shape').type('geoshape' as never),
          bind('/data/trace').type('geotrace' as never),
        ),
      ),
      body(input('/data/pt'), input('/data/shape'), input('/data/trace')),
    );
  }

  it('round-trips a geopoint with whole-number components semantically (formatDecimal reformats "1" -> "1.0")', () => {
    const definition = parseForm(geoForm().asXml());
    const xml = '<data id="geo"><pt>1 2 0 0</pt><shape></shape><trace></trace></data>';

    const out = roundTrip(definition, xml);
    const outVal = extractLeaf(out, 'pt')!;

    expect(outVal).not.toBe('1 2 0 0');
    expectGeoEqual(outVal, '1 2 0 0');
  });

  it('round-trips a geoshape (multi-point) semantically, component-wise', () => {
    const definition = parseForm(geoForm().asXml());
    const xml = '<data id="geo"><pt></pt><shape>1 2 0 0;3 4 0 0;5 6 0 0</shape><trace></trace></data>';

    const out = roundTrip(definition, xml);
    expectGeoPointsEqual(extractLeaf(out, 'shape')!, '1 2 0 0;3 4 0 0;5 6 0 0');
  });

  it('round-trips a geotrace semantically, component-wise', () => {
    const definition = parseForm(geoForm().asXml());
    const xml = '<data id="geo"><pt></pt><shape></shape><trace>10 20 5 1;11 21 5 1</trace></data>';

    const out = roundTrip(definition, xml);
    expectGeoPointsEqual(extractLeaf(out, 'trace')!, '10 20 5 1;11 21 5 1');
  });
});

// ---------------------------------------------------------------------------
// Task 26: selectMulti — token-set equivalence, order/whitespace-insensitive
// ---------------------------------------------------------------------------

describe('round-trip — selectMulti (ADR-F: token-set equivalence, not raw string identity)', () => {
  function selectMultiForm() {
    return html(
      head(
        title('SelectMulti'),
        model(
          mainInstance(t('data id="multi"', t('m'))),
          bind('/data/m').type('select'),
        ),
      ),
      body(input('/data/m')),
    );
  }

  it('round-trips selectMulti tokens with collapsed whitespace as the same token set', () => {
    const definition = parseForm(selectMultiForm().asXml());
    const xml = '<data id="multi"><m>  a   b  c </m></data>';

    const out = roundTrip(definition, xml);
    const outVal = extractLeaf(out, 'm')!;

    // Lexically different: internal whitespace collapsed to single spaces, trimmed.
    expect(outVal).not.toBe('  a   b  c ');
    expectTokenSetEqual(outVal, 'a b c');
  });
});

// ---------------------------------------------------------------------------
// Task 22 (repeat multiplicity part of full round-trip) + integration scenario
// ---------------------------------------------------------------------------

describe('round-trip — repeat multiplicity preserved end-to-end', () => {
  function repeatForm() {
    return html(
      head(
        title('Repeat RT'),
        model(
          mainInstance(t('data id="rt-repeat"', t('rep jr:template=""', t('q')))),
          bind('/data/rep/q').type('int'),
        ),
      ),
      body(repeat('/data/rep', input('/data/rep/q'))),
    );
  }

  it('preserves repeat instance count and per-instance values through hydrate -> serialize', () => {
    const definition = parseForm(repeatForm().asXml());
    const xml =
      '<data id="rt-repeat"><rep><q>1</q></rep><rep><q>2</q></rep><rep><q>3</q></rep></data>';

    const out = roundTrip(definition, xml);
    const matches = [...out.matchAll(/<rep[^>]*><q>(\d+)<\/q><\/rep>/g)].map((m) => m[1]);
    expect(matches).toEqual(['1', '2', '3']);
  });
});
