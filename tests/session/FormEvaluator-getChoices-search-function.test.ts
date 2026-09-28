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
  item,
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

function sectoresFormWithAppearance(appearance: string) {
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
      t(
        `select1 ref="/data/sector" appearance="${appearance}"`,
        t(
          `itemset nodeset="instance('sectores')/root/item"`,
          t('value ref="name"'),
          t('label ref="label"'),
        ),
      ),
    ),
  );
}

describe('search() compiled onto appearance (real Kobo "search and select" shape)', () => {
  // Real device-extracted shape (reported bug): the itemset nodeset has NO
  // predicate at all — search(...) lives as literal text on `appearance`,
  // e.g. appearance="search search('sectores','matches','id_huerta', /data/id_huerta )".
  // Before this fix, getChoices() evaluated the bare nodeset and returned
  // every row unfiltered, since search() was never invoked by anything.
  it('filters using search() spliced from appearance, not the (predicate-less) itemset', () => {
    const def = parseForm(
      sectoresFormWithAppearance(
        "search search('sectores','matches','id_huerta', /data/id_huerta )",
      ).asXml(),
    );
    const session = createFormSession(def);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/id_huerta'), stringValue('H1'));

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s1', 's3']);
  });

  it('re-filters when the referenced value changes (cache invalidation via appearance-derived triggers)', () => {
    const def = parseForm(
      sectoresFormWithAppearance(
        "search search('sectores','matches','id_huerta', /data/id_huerta )",
      ).asXml(),
    );
    const session = createFormSession(def);
    const idHuertaRef = parseAbsoluteRef('/data/id_huerta');
    const sectorRef = parseAbsoluteRef('/data/sector');

    session.evaluator.answerQuestion(idHuertaRef, stringValue('H1'));
    expect(session.evaluator.getChoices(sectorRef).map((c) => c.value)).toEqual(['s1', 's3']);

    session.evaluator.answerQuestion(idHuertaRef, stringValue('H2'));
    expect(session.evaluator.getChoices(sectorRef).map((c) => c.value)).toEqual(['s2']);
  });

  it('returns no choices before id_huerta is answered', () => {
    const def = parseForm(
      sectoresFormWithAppearance(
        "search search('sectores','matches','id_huerta', /data/id_huerta )",
      ).asXml(),
    );
    const session = createFormSession(def);

    expect(session.evaluator.getChoices(parseAbsoluteRef('/data/sector'))).toEqual([]);
  });

  it('leaves a choice_filter-authored search() (already inside the nodeset) untouched by appearance', () => {
    // appearance carries only the plain "search" keyword here (no search()
    // call) — the nodeset's own predicate must still be the one that filters.
    const def = parseForm(
      html(
        head(
          title('Sectores'),
          model(
            mainInstance(t('data id="test"', t('id_huerta'), t('sector'))),
            instance(
              'sectores',
              t('item', t('name', 's1'), t('label', 'Sector 1'), t('id_huerta', 'H1')),
              t('item', t('name', 's2'), t('label', 'Sector 2'), t('id_huerta', 'H2')),
            ),
            bind('/data/id_huerta').type('string'),
            bind('/data/sector').type('string'),
          ),
        ),
        body(
          input('/data/id_huerta'),
          t(
            'select1 ref="/data/sector" appearance="search"',
            t(
              "itemset nodeset=\"instance('sectores')/root/item[search('sectores','matches','id_huerta',/data/id_huerta)]\"",
              t('value ref="name"'),
              t('label ref="label"'),
            ),
          ),
        ),
      ).asXml(),
    );
    const session = createFormSession(def);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/id_huerta'), stringValue('H2'));

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/sector'));
    expect(choices.map((c) => c.value)).toEqual(['s2']);
  });
});

describe('search() column-mapping shape (single <item>, no <itemset>)', () => {
  // Real device-confirmed production shape (running on ODK Collect + Kobo):
  // no <itemset> at all — a single inline <item> whose value/label TEXT name
  // the CSV columns to project (xlsform.org: "a row should indicate which
  // .csv columns to use for the label and selected value"), not a literal
  // static choice. Also exercises the 6-arg search() form with a trailing
  // columnToFilter/filterText pair.
  function productoresForm() {
    return html(
      head(
        title('Productores'),
        model(
          mainInstance(t('data id="test"', t('id_persona_tecnico'), t('id_persona'))),
          instance(
            'productores',
            t(
              'item',
              t('id_persona', 'P1'),
              t('productor', 'Juan Perez'),
              t('active', 'true'),
              t('id_persona_tecnico', 'T1'),
            ),
            t(
              'item',
              t('id_persona', 'P2'),
              t('productor', 'Maria Lopez'),
              t('active', 'false'),
              t('id_persona_tecnico', 'T1'),
            ),
            t(
              'item',
              t('id_persona', 'P3'),
              t('productor', 'Luis Ramos'),
              t('active', 'true'),
              t('id_persona_tecnico', 'T2'),
            ),
          ),
          bind('/data/id_persona_tecnico').type('string'),
          bind('/data/id_persona').type('string'),
        ),
      ),
      body(
        input('/data/id_persona_tecnico'),
        t(
          'select1 ref="/data/id_persona" ' +
            'appearance="search search(\'productores\',\'matches\',\'id_persona_tecnico\', /data/id_persona_tecnico ,\'active\',\'true\')"',
          item('id_persona', 'productor'),
        ),
      ),
    );
  }

  it('projects the CSV columns named by the single <item>, filtered by the 6-arg search()', () => {
    const def = parseForm(productoresForm().asXml());
    const session = createFormSession(def);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/id_persona_tecnico'), stringValue('T1'));

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/id_persona'));
    expect(choices).toEqual([{ value: 'P1', label: 'Juan Perez', geometry: null }]);
  });

  it('returns no choices before id_persona_tecnico is answered', () => {
    const def = parseForm(productoresForm().asXml());
    const session = createFormSession(def);

    expect(session.evaluator.getChoices(parseAbsoluteRef('/data/id_persona'))).toEqual([]);
  });
});

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
