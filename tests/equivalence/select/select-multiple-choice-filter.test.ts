/**
 * Equivalence tests — select (multi-select) choice filter
 *
 * JavaRosa source: SelectMultipleChoiceFilterTest.java
 *
 * Same filtering logic as select1 but via <select> (multi-select).
 * Verifies REQ-5C-2, REQ-5C-3 for the multi-select control type.
 */

import { describe, it, expect } from 'vitest';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  instance,
  bind,
  select,
  input,
  t,
  title,
} from '../../harness/XFormsElement.ts';
import { Scenario } from '../../harness/Scenario.ts';

// ---------------------------------------------------------------------------
// Multi-select C3 equivalent — empty before controlling answer
// ---------------------------------------------------------------------------

describe('SelectMultiple C3 — empty before controlling answer', () => {
  it('returns empty list when controlling question unanswered', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('Multi C3'),
          model(
            mainInstance(t('data id="mc3"', t('category'), t('items'))),
            instance(
              'items',
              t('item', t('name', 'item_a'), t('category', 'cat1'), t('label', 'Item A')),
              t('item', t('name', 'item_b'), t('category', 'cat1'), t('label', 'Item B')),
              t('item', t('name', 'item_c'), t('category', 'cat2'), t('label', 'Item C')),
            ),
            bind('/data/category').type('string'),
            bind('/data/items').type('string'),
          ),
        ),
        body(
          input('/data/category'),
          t(
            'select ref="/data/items"',
            t(
              "itemset nodeset=\"instance('items')/root/item[category = /data/category]\"",
              t('value ref="name"'),
              t('label ref="label"'),
            ),
          ),
        ),
      ),
    );

    const choices = scenario.choicesOf('/data/items');
    expect(choices).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-select C4 equivalent — filtered after controlling answer
// ---------------------------------------------------------------------------

describe('SelectMultiple C4 — filtered after controlling answer', () => {
  it('returns only items matching the selected category', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('Multi C4'),
          model(
            mainInstance(t('data id="mc4"', t('category'), t('items'))),
            instance(
              'items',
              t('item', t('name', 'item_a'), t('category', 'cat1'), t('label', 'Item A')),
              t('item', t('name', 'item_b'), t('category', 'cat1'), t('label', 'Item B')),
              t('item', t('name', 'item_c'), t('category', 'cat2'), t('label', 'Item C')),
            ),
            bind('/data/category').type('string'),
            bind('/data/items').type('string'),
          ),
        ),
        body(
          input('/data/category'),
          t(
            'select ref="/data/items"',
            t(
              "itemset nodeset=\"instance('items')/root/item[category = /data/category]\"",
              t('value ref="name"'),
              t('label ref="label"'),
            ),
          ),
        ),
      ),
    );

    scenario.answer('/data/category', 'cat1');
    const choices = scenario.choicesOf('/data/items');
    expect(choices).toHaveLength(2);
    const values = choices.map((c) => (c as unknown as { getValue(): string }).getValue());
    expect(values).toContain('item_a');
    expect(values).toContain('item_b');
    expect(values).not.toContain('item_c');
  });
});
