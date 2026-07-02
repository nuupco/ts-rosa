/**
 * Integration test — itemset() choice resolution against a CSV-hydrated
 * external secondary instance (PR3, task 19).
 *
 * This is the design's flagged Risk #1 / unverified assumption: ADR-3
 * asserts CSV-derived InstanceTrees are structurally identical to inline
 * secondary instances and therefore work with ZERO changes to XPath
 * resolution for instance()/pulldata()/search() AND itemsets — but only
 * pulldata()/instance-fn.ts consumers were directly inspected during design.
 * This test exercises the itemset path specifically: a select1 whose
 * `<itemset nodeset="instance('cities')/root/item">` references a
 * `jr://file-csv/*.csv` instance, resolved via `resolveExternalInstances`,
 * must produce the same choices as the equivalent inline-instance itemset.
 */

import { describe, expect, it } from 'vitest';
import {
  bind,
  body,
  head,
  html,
  model,
  mainInstance,
  instance,
  t,
  title,
} from '../harness/XFormsElement.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { createFormSession } from '../../src/session/FormSession.ts';
import { resolveExternalInstances } from '../../src/parse/resolveExternalInstances.ts';
import { registerExternalInstanceResolver } from '../../src/platform/ExternalInstanceResolver.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';

function itemsetForm(citiesInstance: ReturnType<typeof instance> | ReturnType<typeof t>) {
  return html(
    head(
      title('itemset csv external smoke test'),
      model(
        mainInstance(t('data id="itemset-csv-external"', t('q'))),
        citiesInstance,
        bind('/data/q').type('string'),
      ),
    ),
    body(
      t(
        'select1 ref="/data/q"',
        t(
          "itemset nodeset=\"instance('cities')/root/item\"",
          t('value ref="name"'),
          t('label ref="label"'),
        ),
      ),
    ),
  );
}

describe('itemset() — end-to-end through a CSV-hydrated external instance', () => {
  it('resolves the same choices as the equivalent inline-instance itemset', async () => {
    // Inline baseline — the known-good shape.
    const inlineDef = parseForm(
      itemsetForm(
        instance(
          'cities',
          t('item', t('name', 'merida'), t('label', 'Merida')),
          t('item', t('name', 'oaxaca'), t('label', 'Oaxaca')),
        ),
      ).asXml(),
    );
    const inlineSession = createFormSession(inlineDef);
    const ref = parseAbsoluteRef('/data/q');
    const inlineChoices = inlineSession.evaluator.getChoices(ref);

    expect(inlineChoices.map((c) => ({ value: c.value, label: c.label }))).toEqual([
      { value: 'merida', label: 'Merida' },
      { value: 'oaxaca', label: 'Oaxaca' },
    ]);

    // CSV-hydrated external instance — must resolve identical choices.
    registerExternalInstanceResolver({
      resolve: (uri: string) => {
        expect(uri).toBe('jr://file-csv/cities.csv');
        return Promise.resolve('name,label\nmerida,Merida\noaxaca,Oaxaca\n');
      },
    });

    const externalDef = parseForm(
      itemsetForm(t('instance id="cities" src="jr://file-csv/cities.csv"')).asXml(),
    );
    const resolvedDef = await resolveExternalInstances(externalDef);
    const externalSession = createFormSession(resolvedDef);
    const externalChoices = externalSession.evaluator.getChoices(ref);

    expect(externalChoices.map((c) => ({ value: c.value, label: c.label }))).toEqual(
      inlineChoices.map((c) => ({ value: c.value, label: c.label })),
    );
  });
});
