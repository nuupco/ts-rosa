/**
 * Integration test — pulldata() end-to-end against a CSV-hydrated external
 * secondary instance (PR3, task 18, spec R6).
 *
 * Confirms zero-change XPath reuse: pulldata() resolves the same way over a
 * `jr://file-csv/*.csv`-declared instance, once resolved via
 * `resolveExternalInstances`, as it does over an inline secondary instance
 * (see tests/xpath/pulldata.test.ts for the inline baseline).
 */

import { describe, expect, it } from 'vitest';
import {
  bind,
  body,
  head,
  html,
  input,
  model,
  mainInstance,
  t,
  title,
} from '../harness/XFormsElement.ts';
import { Scenario } from '../harness/Scenario.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { resolveExternalInstances } from '../../src/parse/resolveExternalInstances.ts';
import { registerExternalInstanceResolver } from '../../src/platform/ExternalInstanceResolver.ts';
import '../harness/matchers.ts';

describe('pulldata() — end-to-end through a CSV-hydrated external instance', () => {
  it('resolves the correct cell from a jr://file-csv/*.csv external instance', async () => {
    registerExternalInstanceResolver({
      resolve: (uri: string) => {
        expect(uri).toBe('jr://file-csv/cities.csv');
        return Promise.resolve(
          'name,region\n' + 'Merida,Yucatan\n' + 'Oaxaca,Oaxaca\n' + 'Tuxtla,Chiapas\n',
        );
      },
    });

    const xml = html(
      head(
        title('pulldata csv external smoke test'),
        model(
          mainInstance(t('data id="pulldata-csv-external"', t('result'), t('key'))),
          t('instance id="cities" src="jr://file-csv/cities.csv"'),
          bind('/data/result')
            .type('string')
            .calculate("pulldata('cities', 'region', 'name', /data/key)"),
          bind('/data/key').type('string'),
        ),
      ),
      body(input('/data/key')),
    ).asXml();

    const def = parseForm(xml);
    const resolved = await resolveExternalInstances(def);
    const scenario = Scenario.fromDefinition(resolved);

    scenario.answer('/data/key', 'Merida');
    expect(scenario.answerOf('/data/result')).stringAnswer('Yucatan');

    scenario.answer('/data/key', 'Tuxtla');
    expect(scenario.answerOf('/data/result')).stringAnswer('Chiapas');

    scenario.answer('/data/key', 'missing');
    expect(scenario.answerOf('/data/result')).stringAnswer('');
  });
});
