/**
 * pyxform's "search and select": when a select's `appearance` carries a
 * `search(instanceId, ...)` call, real ODK Collect/Kobo/Enketo clients
 * resolve `jr://file-csv/<instanceId>.csv` directly off that string —
 * WITHOUT requiring a matching `<instance id="..." src="...">` declaration
 * in the model.
 *
 * Confirmed against a real production XForm: pyxform stops emitting that
 * `<instance>` declaration once a select is compiled to the single-<item>
 * column-mapping shape (search() still needs the CSV at runtime, but the
 * model no longer links it) — reported as a v0.7.2 regression where
 * getChoices() returned zero choices for such a field, even though the CSV
 * was present on the host, because resolveExternalInstances() never had an
 * entry to fetch it from.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { resolveExternalInstances } from '../../src/parse/resolveExternalInstances.ts';
import { registerExternalInstanceResolver } from '../../src/platform/ExternalInstanceResolver.ts';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import { stringValue } from '../../src/model/data/codecs.ts';
import { html, head, body, model, mainInstance, bind, input, t, title } from '../harness/XFormsElement.ts';

function fuentesCsv(): string {
  const header = 'id_fuente_abastecimiento,fuente_abastecimiento,id_huerta';
  const rows = [
    header,
    '1,Pozo A,10',
    '2,Pozo B,12',
    '3,Pozo C,10',
  ];
  return rows.join('\n') + '\n';
}

// The exact reported shape: NO <instance id="fuentes_abastecimientos"> at all.
function formWithoutInstanceDeclaration() {
  return html(
    head(
      title('Fuentes'),
      model(
        mainInstance(t('data id="test"', t('id_huerta'), t('id_fuente_abastecimiento'))),
        bind('/data/id_huerta').type('string'),
        bind('/data/id_fuente_abastecimiento').type('string'),
      ),
    ),
    body(
      input('/data/id_huerta'),
      t(
        'select1 ref="/data/id_fuente_abastecimiento" ' +
          'appearance="search search(\'fuentes_abastecimientos\',\'matches\',\'id_huerta\', /data/id_huerta )"',
        t('item', t('label', 'fuente_abastecimiento'), t('value', 'id_fuente_abastecimiento')),
      ),
    ),
  ).asXml();
}

describe('search() appearance instance id — implicit externalInstances synthesis', () => {
  it('parseForm synthesizes an externalInstances entry when the model declares none', () => {
    const def = parseForm(formWithoutInstanceDeclaration());
    expect(def.externalInstances.get('fuentes_abastecimientos')).toEqual({
      src: 'jr://file-csv/fuentes_abastecimientos.csv',
    });
  });

  it('getChoices() resolves the CSV and filters correctly with no <instance> declared', async () => {
    registerExternalInstanceResolver({ resolve: () => Promise.resolve(fuentesCsv()) });

    const def = parseForm(formWithoutInstanceDeclaration());
    const resolved = await resolveExternalInstances(def);
    const session = createFormSession(resolved);
    session.evaluator.answerQuestion(parseAbsoluteRef('/data/id_huerta'), stringValue('10'));

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/id_fuente_abastecimiento'));
    expect(choices.map((c) => c.value)).toEqual(['1', '3']);
  });

  it('does not override a real <instance src> declaration already present', () => {
    const def = parseForm(
      html(
        head(
          title('Fuentes'),
          model(
            mainInstance(t('data id="test"', t('id_huerta'), t('id_fuente_abastecimiento'))),
            t('instance id="fuentes_abastecimientos" src="jr://file-csv/custom-path.csv"'),
            bind('/data/id_huerta').type('string'),
            bind('/data/id_fuente_abastecimiento').type('string'),
          ),
        ),
        body(
          input('/data/id_huerta'),
          t(
            'select1 ref="/data/id_fuente_abastecimiento" ' +
              'appearance="search search(\'fuentes_abastecimientos\',\'matches\',\'id_huerta\', /data/id_huerta )"',
            t('item', t('label', 'fuente_abastecimiento'), t('value', 'id_fuente_abastecimiento')),
          ),
        ),
      ).asXml(),
    );

    expect(def.externalInstances.get('fuentes_abastecimientos')).toEqual({
      src: 'jr://file-csv/custom-path.csv',
    });
  });

  it('does not synthesize an entry for a form with no search() appearance at all', () => {
    const def = parseForm(
      html(
        head(
          title('Plain'),
          model(mainInstance(t('data id="test"', t('name'))), bind('/data/name').type('string')),
        ),
        body(input('/data/name')),
      ).asXml(),
    );

    expect(def.externalInstances.size).toBe(0);
  });
});
