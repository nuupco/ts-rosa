/**
 * createFormSession — unresolved external instance guard (PR3, task 16).
 *
 * A FormDefinition with a declared `externalInstances` entry whose id is
 * absent from `secondaryInstances` (i.e. `resolveExternalInstances` was not
 * called, or hydration was skipped) must fail loud rather than silently
 * treating the external instance as absent (spec R4).
 */

import { describe, it, expect } from 'vitest';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { resolveExternalInstances } from '../../src/parse/resolveExternalInstances.ts';
import { registerExternalInstanceResolver } from '../../src/platform/ExternalInstanceResolver.ts';
import { html, head, body, model, mainInstance, bind, input, t, label } from '../harness/XFormsElement.ts';
import type { XFormsElement } from '../harness/XFormsElement.ts';

function formXml(form: XFormsElement): string {
  return form.asXml();
}

function externalInstanceForm() {
  return formXml(
    html(
      head(
        model(
          mainInstance(t('data id="test"', t('name', 'Alice'))),
          t('instance id="cities" src="jr://file-csv/cities.csv"'),
          bind('/data/name').type('string'),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

function inlineOnlyForm() {
  return formXml(
    html(
      head(
        model(
          mainInstance(t('data id="test"', t('name', 'Alice'))),
          bind('/data/name').type('string'),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

describe('createFormSession — unresolved external instance guard', () => {
  it('throws a clear error when an external instance is declared but not resolved', () => {
    const def = parseForm(externalInstanceForm());

    expect(() => createFormSession(def)).toThrow(
      "createFormSession: external instance 'cities' is declared but not resolved. " +
        'Call resolveExternalInstances(definition) before createFormSession().',
    );
  });

  it('does not throw once resolveExternalInstances has hydrated the external instance', async () => {
    const def = parseForm(externalInstanceForm());

    registerExternalInstanceResolver({
      resolve: () => Promise.resolve('name\nMerida\n'),
    });

    const resolved = await resolveExternalInstances(def);

    expect(() => createFormSession(resolved)).not.toThrow();
  });

  it('a form with no external instances is unaffected (loop is a no-op)', () => {
    const def = parseForm(inlineOnlyForm());

    expect(() => createFormSession(def)).not.toThrow();
  });
});
