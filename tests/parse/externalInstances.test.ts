/**
 * Tests for parse-time detection of `<instance id="..." src="jr://...">`
 * external secondary instance declarations (PR2, tasks 9 + 11).
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { html, head, body, model, mainInstance, bind, input, t, label, instance } from '../harness/XFormsElement.ts';
import type { XFormsElement } from '../harness/XFormsElement.ts';

function formXml(form: XFormsElement): string {
  return form.asXml();
}

describe('parseForm: external secondary instance detection (jr://)', () => {
  it('records {id, src} in externalInstances without adding to secondaryInstances', () => {
    const xml = formXml(
      html(
        head(
          model(
            mainInstance(t('data id="test"', t('name', 'Alice'))),
            t('instance id="cities" src="jr://file-csv/cities.csv"'),
            bind('/data/name').type('string')
          )
        ),
        body(input('/data/name', label('Your Name')))
      )
    );

    const def = parseForm(xml);

    expect(def.externalInstances.get('cities')).toEqual({ src: 'jr://file-csv/cities.csv' });
    expect(def.secondaryInstances.has('cities')).toBe(false);
  });

  it('a form with only inline instances yields an empty externalInstances map (regression guard)', () => {
    const xml = formXml(
      html(
        head(
          model(
            mainInstance(t('data id="test"', t('name', 'Alice'))),
            instance('colors', t('item', t('label', 'Red'), t('value', 'red'))),
            bind('/data/name').type('string')
          )
        ),
        body(input('/data/name', label('Your Name')))
      )
    );

    const def = parseForm(xml);

    expect(def.externalInstances.size).toBe(0);
    expect(def.secondaryInstances.has('colors')).toBe(true);
  });

  it('an instance with both src and inline children resolves to external (src wins)', () => {
    const xml = formXml(
      html(
        head(
          model(
            mainInstance(t('data id="test"', t('name', 'Alice'))),
            t('instance id="cities" src="jr://file-csv/cities.csv"', t('root', t('item', t('name', 'ignored')))),
            bind('/data/name').type('string')
          )
        ),
        body(input('/data/name', label('Your Name')))
      )
    );

    const def = parseForm(xml);

    expect(def.externalInstances.get('cities')).toEqual({ src: 'jr://file-csv/cities.csv' });
    expect(def.secondaryInstances.has('cities')).toBe(false);
  });
});
