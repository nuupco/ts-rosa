/**
 * Regression tests — FormEvaluator's equality-filter itemset fast path.
 *
 * `getChoices()` recognizes the classic choice_filter shape
 * `instance('id')/path/item[column = ref]` (either operand order) and
 * indexes candidate items by `column`'s string value once, mirroring
 * JavaRosa's EqualityExpressionIndexFilterStrategy, instead of rescanning
 * the whole secondary instance through the generic XPath evaluator on
 * every distinct ref value (e.g. every time the user picks a different
 * municipio in a cascading select).
 *
 * These tests exist to pin down correctness — same results as the generic
 * evaluator would produce, for both operand orders, across repeated filter
 * changes, and with a safe fallback for shapes the fast path doesn't
 * recognize — not to assert on timing (see the perf write-up in
 * CHANGELOG.md for the measured numbers).
 */

import { describe, it, expect } from 'vitest';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import { stringValue } from '../../src/model/data/codecs.ts';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  instance,
  bind,
  input,
  select1,
  t,
  title,
} from '../harness/XFormsElement.ts';

function cascadingSelectForm(itemsetNodeset: string) {
  return html(
    head(
      title('Cascading select'),
      model(
        mainInstance(t('data id="cascading"', t('municipio'), t('localidad'))),
        instance(
          'locs',
          t('item', t('name', 'a'), t('label', 'A'), t('id_municipio', '12')),
          t('item', t('name', 'b'), t('label', 'B'), t('id_municipio', '13')),
          t('item', t('name', 'c'), t('label', 'C'), t('id_municipio', '12')),
        ),
        bind('/data/municipio').type('string'),
        bind('/data/localidad').type('string'),
      ),
    ),
    body(
      input('/data/municipio'),
      select1(
        '/data/localidad',
        t(
          `itemset nodeset="${itemsetNodeset}"`,
          t('value ref="name"'),
          t('label ref="label"'),
        ),
      ),
    ),
  );
}

describe('FormEvaluator.getChoices — equality-filter itemset fast path', () => {
  it('matches column-on-left operand order (instance(...)/item[col = ref])', () => {
    const def = parseForm(
      cascadingSelectForm("instance('locs')/root/item[id_municipio = /data/municipio]").asXml(),
    );
    const session = createFormSession(def);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/municipio'), stringValue('12'));

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/localidad'));
    expect(choices.map((c) => c.value)).toEqual(['a', 'c']);
  });

  it('matches ref-on-left operand order (instance(...)/item[ref = col])', () => {
    const def = parseForm(
      cascadingSelectForm("instance('locs')/root/item[/data/municipio = id_municipio]").asXml(),
    );
    const session = createFormSession(def);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/municipio'), stringValue('13'));

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/localidad'));
    expect(choices.map((c) => c.value)).toEqual(['b']);
  });

  it('matches a quoted string literal on the ref side', () => {
    const def = parseForm(
      cascadingSelectForm("instance('locs')/root/item[id_municipio = '12']").asXml(),
    );
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/localidad'));
    expect(choices.map((c) => c.value)).toEqual(['a', 'c']);
  });

  it('reuses the index across distinct filter values (cascading-select re-selection)', () => {
    const def = parseForm(
      cascadingSelectForm("instance('locs')/root/item[id_municipio = /data/municipio]").asXml(),
    );
    const session = createFormSession(def);
    const municipioRef = parseAbsoluteRef('/data/municipio');
    const localidadRef = parseAbsoluteRef('/data/localidad');

    session.evaluator.answerQuestion(municipioRef, stringValue('12'));
    expect(session.evaluator.getChoices(localidadRef).map((c) => c.value)).toEqual(['a', 'c']);

    session.evaluator.answerQuestion(municipioRef, stringValue('13'));
    expect(session.evaluator.getChoices(localidadRef).map((c) => c.value)).toEqual(['b']);

    session.evaluator.answerQuestion(municipioRef, stringValue('12'));
    expect(session.evaluator.getChoices(localidadRef).map((c) => c.value)).toEqual(['a', 'c']);
  });

  it('returns no choices for a filter value with no matches', () => {
    const def = parseForm(
      cascadingSelectForm("instance('locs')/root/item[id_municipio = /data/municipio]").asXml(),
    );
    const session = createFormSession(def);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/municipio'), stringValue('999'));

    expect(session.evaluator.getChoices(parseAbsoluteRef('/data/localidad'))).toEqual([]);
  });

  it('falls back to the generic evaluator for a compound predicate (unrecognized shape)', () => {
    const def = parseForm(
      cascadingSelectForm(
        "instance('locs')/root/item[id_municipio = /data/municipio and name != 'a']",
      ).asXml(),
    );
    const session = createFormSession(def);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/municipio'), stringValue('12'));

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/localidad'));
    expect(choices.map((c) => c.value)).toEqual(['c']);
  });

  it('falls back to the generic evaluator for an unfiltered itemset (no predicate)', () => {
    const def = parseForm(cascadingSelectForm("instance('locs')/root/item").asXml());
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/localidad'));
    expect(choices.map((c) => c.value)).toEqual(['a', 'b', 'c']);
  });
});
