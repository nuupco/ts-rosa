/**
 * `search()` XPath function — pyxform/Kobo/Enketo choice_filter extension.
 *
 * NOT part of the ODK XForms spec or JavaRosa (confirmed absent from
 * reference/javarosa's XPathFuncExpr — no test vectors exist there).
 * Semantics sourced from xlsform.org's "Dynamic selects from pre-loaded
 * data" documentation:
 *
 *   search(csvName)
 *   search(csvName, searchType, columnsToSearch, searchText)
 *   search(csvName, searchType, columnsToSearch, searchText, columnToFilter, filterText)
 *
 * pyxform compiles a `search(...)` choice_filter into the itemset's
 * nodeset predicate verbatim: `instance(csvName)/root/item[search(...)]` —
 * so search() must decide, per candidate item, whether THAT item matches
 * (context.contextNodes is a singleton set during predicate evaluation),
 * not build an independent global result set.
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

function sectoresForm(itemsetNodeset: string) {
  return html(
    head(
      title('Sectores'),
      model(
        mainInstance(t('data id="test"', t('id_huerta'), t('sector'))),
        instance(
          'sectores',
          t('item', t('name', 's1'), t('label', 'Sector 1'), t('id_huerta', 'H1')),
          t('item', t('name', 's2'), t('label', 'Sector 2'), t('id_huerta', 'H2')),
          t('item', t('name', 's3'), t('label', 'Sector 3'), t('id_huerta', 'H1')),
        ),
        bind('/data/id_huerta').type('string'),
        bind('/data/sector').type('string'),
      ),
    ),
    body(
      input('/data/id_huerta'),
      select1(
        '/data/sector',
        t(
          `itemset nodeset="${itemsetNodeset}"`,
          t('value ref="name"'),
          t('label ref="label"'),
        ),
      ),
    ),
  );
}

describe('search() choice_filter extension', () => {
  it('matches the reported bug: search(instance, "matches", column, ref)', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('sectores','matches','id_huerta',/data/id_huerta)]",
      ).asXml(),
    );
    const session = createFormSession(def);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/id_huerta'), stringValue('H1'));

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s1', 's3']);
  });

  it('reuses the index across distinct filter values (cascading re-selection)', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('sectores','matches','id_huerta',/data/id_huerta)]",
      ).asXml(),
    );
    const session = createFormSession(def);
    const idHuertaRef = parseAbsoluteRef('/data/id_huerta');
    const sectorRef = parseAbsoluteRef('/data/sector');

    session.evaluator.answerQuestion(idHuertaRef, stringValue('H1'));
    expect(session.evaluator.getChoices(sectorRef).map((c) => c.value)).toEqual(['s1', 's3']);

    session.evaluator.answerQuestion(idHuertaRef, stringValue('H2'));
    expect(session.evaluator.getChoices(sectorRef).map((c) => c.value)).toEqual(['s2']);

    session.evaluator.answerQuestion(idHuertaRef, stringValue('H1'));
    expect(session.evaluator.getChoices(sectorRef).map((c) => c.value)).toEqual(['s1', 's3']);
  });

  it('returns no choices when nothing matches', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('sectores','matches','id_huerta',/data/id_huerta)]",
      ).asXml(),
    );
    const session = createFormSession(def);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/id_huerta'), stringValue('nope'));

    expect(session.evaluator.getChoices(parseAbsoluteRef('/data/sector'))).toEqual([]);
  });

  it('"contains" matches a substring', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('sectores','contains','label','ector 2')]",
      ).asXml(),
    );
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s2']);
  });

  it('"startswith" matches a prefix', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('sectores','startswith','id_huerta','H1')]",
      ).asXml(),
    );
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s1', 's3']);
  });

  it('"endswith" matches a suffix', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('sectores','endswith','name','2')]",
      ).asXml(),
    );
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s2']);
  });

  it('supports a comma-separated column list — any match counts', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('sectores','matches','name,id_huerta','H2')]",
      ).asXml(),
    );
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s2']);
  });

  it('applies the optional columnToFilter/filterText pair as an additional exact filter', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('sectores','startswith','id_huerta','H','name','s3')]",
      ).asXml(),
    );
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s3']);
  });

  it('the 6-arg columnToFilter/filterText form with "matches" is not misparsed by the fast path', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('sectores','matches','id_huerta','H1','name','s3')]",
      ).asXml(),
    );
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s3']);
  });

  it('the 1-arg form (search(csvName)) matches every row', () => {
    const def = parseForm(
      sectoresForm("instance('sectores')/root/item[search('sectores')]").asXml(),
    );
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s1', 's2', 's3']);
  });

  it('an unresolved instance id matches nothing rather than throwing', () => {
    const def = parseForm(
      sectoresForm(
        "instance('sectores')/root/item[search('nope','matches','id_huerta',/data/id_huerta)]",
      ).asXml(),
    );
    const session = createFormSession(def);

    expect(() => session.evaluator.getChoices(parseAbsoluteRef('/data/sector'))).not.toThrow();
    expect(session.evaluator.getChoices(parseAbsoluteRef('/data/sector'))).toEqual([]);
  });
});
