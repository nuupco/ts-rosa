/**
 * Equivalence tests — dynamic select update (stale-choice contract)
 *
 * JavaRosa sources: DynamicSelectUpdateTest.java, SelectCachingTest.java
 *
 * Scenarios:
 *   - SelectCachingTest: same trigger value → cache hit (stable reference)
 *   - DynamicSelectUpdateTest: changed trigger → recomputed list
 *   - REQ-5C-4 stale-choice contract: choicesOf reflects state AT query time
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
  select1,
  input,
  t,
  title,
} from '../../harness/XFormsElement.ts';
import { Scenario } from '../../harness/Scenario.ts';

// ---------------------------------------------------------------------------
// SelectCachingTest — stable triggers → same result on re-query
// ---------------------------------------------------------------------------

describe('SelectCachingTest — stable trigger yields consistent results', () => {
  it('re-querying choicesOf without an answer change returns consistent results', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('Caching test'),
          model(
            mainInstance(t('data id="caching"', t('region'), t('district'))),
            instance(
              'districts',
              t('item', t('name', 'ndist1'), t('region', 'north'), t('label', 'N-Dist-1')),
              t('item', t('name', 'ndist2'), t('region', 'north'), t('label', 'N-Dist-2')),
              t('item', t('name', 'sdist1'), t('region', 'south'), t('label', 'S-Dist-1')),
            ),
            bind('/data/region').type('string'),
            bind('/data/district').type('string'),
          ),
        ),
        body(
          select1('/data/region'),
          t(
            'select1 ref="/data/district"',
            t(
              "itemset nodeset=\"instance('districts')/root/item[region = /data/region]\"",
              t('value ref="name"'),
              t('label ref="label"'),
            ),
          ),
        ),
      ),
    );

    scenario.answer('/data/region', 'north');

    // First query
    const first = scenario.choicesOf('/data/district');
    expect(first).toHaveLength(2);

    // Second query — same state, same results (cache hit semantics)
    const second = scenario.choicesOf('/data/district');
    expect(second).toHaveLength(2);

    const firstValues = first.map((c) => (c as unknown as { getValue(): string }).getValue());
    const secondValues = second.map((c) => (c as unknown as { getValue(): string }).getValue());
    expect(firstValues).toEqual(secondValues);
  });
});

// ---------------------------------------------------------------------------
// DynamicSelectUpdateTest — changed trigger → recomputed list
// ---------------------------------------------------------------------------

describe('DynamicSelectUpdateTest — changed answer updates choicesOf result', () => {
  it('choicesOf reflects current answer after answer() is called', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('Dynamic update test'),
          model(
            mainInstance(t('data id="dynupdate"', t('region'), t('district'))),
            instance(
              'districts',
              t('item', t('name', 'ndist1'), t('region', 'north'), t('label', 'N-Dist-1')),
              t('item', t('name', 'ndist2'), t('region', 'north'), t('label', 'N-Dist-2')),
              t('item', t('name', 'sdist1'), t('region', 'south'), t('label', 'S-Dist-1')),
            ),
            bind('/data/region').type('string'),
            bind('/data/district').type('string'),
          ),
        ),
        body(
          select1('/data/region'),
          t(
            'select1 ref="/data/district"',
            t(
              "itemset nodeset=\"instance('districts')/root/item[region = /data/region]\"",
              t('value ref="name"'),
              t('label ref="label"'),
            ),
          ),
        ),
      ),
    );

    // Start with north
    scenario.answer('/data/region', 'north');
    const northChoices = scenario.choicesOf('/data/district');
    expect(northChoices).toHaveLength(2);

    // Switch to south
    scenario.answer('/data/region', 'south');
    const southChoices = scenario.choicesOf('/data/district');
    expect(southChoices).toHaveLength(1);
    const southValues = southChoices.map((c) => (c as unknown as { getValue(): string }).getValue());
    expect(southValues).toContain('sdist1');
  });

  it('stale-choice contract: re-querying AFTER answer() returns updated list', () => {
    // REQ-5C-4: choices only update when choicesOf() is called again
    const scenario = Scenario.init(
      html(
        head(
          title('Stale choice contract'),
          model(
            mainInstance(t('data id="stale"', t('region'), t('district'))),
            instance(
              'districts',
              t('item', t('name', 'ndist1'), t('region', 'north'), t('label', 'N-Dist-1')),
              t('item', t('name', 'sdist1'), t('region', 'south'), t('label', 'S-Dist-1')),
            ),
            bind('/data/region').type('string'),
            bind('/data/district').type('string'),
          ),
        ),
        body(
          select1('/data/region'),
          t(
            'select1 ref="/data/district"',
            t(
              "itemset nodeset=\"instance('districts')/root/item[region = /data/region]\"",
              t('value ref="name"'),
              t('label ref="label"'),
            ),
          ),
        ),
      ),
    );

    scenario.answer('/data/region', 'north');
    // Queried after answer — should get north districts
    const choices = scenario.choicesOf('/data/district');
    expect(choices).toHaveLength(1);
    const values = choices.map((c) => (c as unknown as { getValue(): string }).getValue());
    expect(values).toContain('ndist1');
  });
});
