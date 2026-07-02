/**
 * Unit tests — FormEvaluator.invalidateChoiceCache()
 *
 * sdd/repeat-removal-wiring, task T1.
 *
 * invalidateChoiceCache() fully clears the choiceCache map (no prefix
 * scoping — see design decision 4 / tasks resolution 2). This closes the
 * only real correctness gap identified for repeat removal: a shifted
 * select node could otherwise inherit a stale cache entry keyed by a
 * concrete ref that previously belonged to a different repeat instance
 * with an identical trigger signature.
 *
 * ts-rosa-original (no direct JavaRosa counterpart — choiceCache is a
 * ts-rosa-specific performance optimization).
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
  select1,
  t,
  title,
} from '../harness/XFormsElement.ts';

/** A select1 whose itemset has a constant nodeset (no trigger fields), so the
 * trigger signature never changes across calls — cache hits are stable
 * unless explicitly invalidated. */
function constantItemsetForm() {
  return html(
    head(
      title('Constant itemset'),
      model(
        mainInstance(t('data id="const-itemset"', t('q'))),
        instance(
          'items',
          t('item', t('name', 'a'), t('label', 'A')),
          t('item', t('name', 'b'), t('label', 'B')),
        ),
        bind('/data/q').type('string'),
      ),
    ),
    body(
      t(
        'select1 ref="/data/q"',
        t(
          "itemset nodeset=\"instance('items')/root/item\"",
          t('value ref="name"'),
          t('label ref="label"'),
        ),
      ),
    ),
  );
}

describe('FormEvaluator.invalidateChoiceCache', () => {
  it('recomputes choices (new array reference) after invalidateChoiceCache, even with an unchanged trigger signature', () => {
    const def = parseForm(constantItemsetForm().asXml());
    const session = createFormSession(def);
    const ref = parseAbsoluteRef('/data/q');

    const first = session.evaluator.getChoices(ref);
    const second = session.evaluator.getChoices(ref);
    // Same trigger sig (no triggers) -> cache hit -> identical array reference
    expect(second).toBe(first);

    session.evaluator.invalidateChoiceCache();

    const third = session.evaluator.getChoices(ref);
    // Cache was cleared -> recomputed -> a NEW array reference, even though
    // content is equivalent
    expect(third).not.toBe(first);
    expect(third.map((c) => c.value)).toEqual(first.map((c) => c.value));
  });
});
