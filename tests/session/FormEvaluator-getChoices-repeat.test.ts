/**
 * Regression test — FormEvaluator.getChoices() for a select1/itemset inside a repeat.
 *
 * Bug: findQuestionByRef() compared the runtime ref (concrete multiplicity,
 * e.g. /data/repeat[0]/q) against the body-tree definition ref (template
 * multiplicity, e.g. /data/repeat/q) using an exact string match. Those
 * never match for any question nested under a repeat, so the question
 * FormElement was never found, its itemset was never read, and getChoices()
 * silently returned an empty array for every repeat instance.
 *
 * Fix: findQuestionByRef() now genericizes the runtime ref before comparing,
 * since body-tree refs are always templates (unbound multiplicity on every
 * ancestor level).
 */

import { describe, it, expect } from 'vitest';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  instance,
  bind,
  repeat,
  t,
  title,
} from '../harness/XFormsElement.ts';

function itemsetInRepeatForm() {
  return html(
    head(
      title('Itemset inside repeat'),
      model(
        mainInstance(
          t('data id="itemset-in-repeat"', t('rep', t('q')), t('rep', t('q'))),
        ),
        instance(
          'items',
          t('item', t('name', 'a'), t('label', 'A')),
          t('item', t('name', 'b'), t('label', 'B')),
        ),
        bind('/data/rep/q').type('string'),
      ),
    ),
    body(
      repeat(
        '/data/rep',
        t(
          'select1 ref="/data/rep/q"',
          t(
            "itemset nodeset=\"instance('items')/root/item\"",
            t('value ref="name"'),
            t('label ref="label"'),
          ),
        ),
      ),
    ),
  );
}

describe('FormEvaluator.getChoices — itemset nested in a repeat', () => {
  it('resolves choices for the first repeat instance', () => {
    const def = parseForm(itemsetInRepeatForm().asXml());
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/rep[1]/q'));

    expect(choices.map((c) => c.value)).toEqual(['a', 'b']);
  });

  it('resolves choices for a second repeat instance identically', () => {
    const def = parseForm(itemsetInRepeatForm().asXml());
    const session = createFormSession(def);

    const choices = session.evaluator.getChoices(parseAbsoluteRef('/data/rep[2]/q'));

    expect(choices.map((c) => c.value)).toEqual(['a', 'b']);
  });
});
