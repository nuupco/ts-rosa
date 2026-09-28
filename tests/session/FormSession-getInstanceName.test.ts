/**
 * FormSession.getInstanceName — convenience accessor for the XLSForm
 * `instance_name` calculate, compiled to `/data/meta/instanceName`.
 */

import { describe, it, expect } from 'vitest';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { html, head, body, model, mainInstance, bind, input, t, label } from '../harness/XFormsElement.ts';
import type { XFormsElement } from '../harness/XFormsElement.ts';

function formXml(form: XFormsElement): string {
  return form.asXml();
}

function formWithInstanceName() {
  return formXml(
    html(
      head(
        model(
          mainInstance(
            t(
              'data id="test"',
              t('name', 'Alice'),
              t('meta', t('instanceName', '')),
            ),
          ),
          bind('/data/name').type('string'),
          bind('/data/meta/instanceName').type('string').calculate("concat('Form - ', /data/name)"),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

function formWithoutMeta() {
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

describe('FormSession.getInstanceName', () => {
  it('reads the calculated meta/instanceName value', () => {
    const def = parseForm(formWithInstanceName());
    const session = createFormSession(def);

    expect(session.getInstanceName()).toBe('Form - Alice');
  });

  it('still reflects the calculated value after finalize() re-runs the cascade', () => {
    const def = parseForm(formWithInstanceName());
    const session = createFormSession(def);

    session.finalize();

    expect(session.getInstanceName()).toBe('Form - Alice');
  });

  it('returns null when the form has no meta/instanceName node', () => {
    const def = parseForm(formWithoutMeta());
    const session = createFormSession(def);

    expect(session.getInstanceName()).toBeNull();
  });
});
