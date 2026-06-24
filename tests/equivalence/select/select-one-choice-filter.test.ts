/**
 * Equivalence tests — select1 choice filter (cascading selects)
 *
 * JavaRosa source: SelectOneChoiceFilterTest.java
 *
 * Scenarios:
 *   C1 — itemset parsed (REQ-5C-1)
 *   C2 — choices from secondary instance without filter (REQ-5C-2)
 *   C3 — empty choices before controlling answer (REQ-5C-3)
 *   C4 — filtered choices after controlling answer (REQ-5C-3)
 *   C5 — 3-level cascade (REQ-5C-3)
 *
 * Slice 5c RED bar introduced here; goes green after 5C-T2..5C-T5.
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
// Scenario C2 — choices from secondary instance (no filter)
// JavaRosa: dependentLevelsInBlankInstance_ShouldHaveNoChoices subset
// ---------------------------------------------------------------------------

describe('Scenario C2 — choicesOf returns all items from secondary instance', () => {
  it('returns all items when itemset has no predicate filter', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('C2 no-filter test'),
          model(
            mainInstance(t('data id="c2"', t('district'))),
            instance(
              'districts',
              t('item', t('name', 'north'), t('label', 'North')),
              t('item', t('name', 'south'), t('label', 'South')),
              t('item', t('name', 'east'), t('label', 'East')),
            ),
            bind('/data/district').type('string'),
          ),
        ),
        body(
          t(
            'select1 ref="/data/district"',
            t(
              'itemset nodeset="instance(\'districts\')/root/item"',
              t('value ref="name"'),
              t('label ref="label"'),
            ),
          ),
        ),
      ),
    );

    const choices = scenario.choicesOf('/data/district');
    expect(choices).toHaveLength(3);
    const values = choices.map((c) => (c as unknown as { getValue(): string }).getValue());
    expect(values).toContain('north');
    expect(values).toContain('south');
    expect(values).toContain('east');
  });
});

// ---------------------------------------------------------------------------
// Scenario C3 — empty before controlling answer
// JavaRosa: dependentLevelsInBlankInstance_ShouldHaveNoChoices
// ---------------------------------------------------------------------------

describe('Scenario C3 — empty choices before controlling answer', () => {
  it('returns empty list when controlling select has no answer yet', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('C3 empty filter test'),
          model(
            mainInstance(t('data id="c3"', t('region'), t('district'))),
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

    // No region selected yet — predicate [region = ''] matches nothing
    const choices = scenario.choicesOf('/data/district');
    expect(choices).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario C4 — filtered after controlling answer
// JavaRosa: selectingValueAtLevel1_ShouldFilterChoicesAtLevel2
// ---------------------------------------------------------------------------

describe('Scenario C4 — filtered choices after controlling answer', () => {
  it('returns only districts matching the selected region', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('C4 filter test'),
          model(
            mainInstance(t('data id="c4"', t('region'), t('district'))),
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
    const choices = scenario.choicesOf('/data/district');
    expect(choices).toHaveLength(2);
    const values = choices.map((c) => (c as unknown as { getValue(): string }).getValue());
    expect(values).toContain('ndist1');
    expect(values).toContain('ndist2');
    expect(values).not.toContain('sdist1');
  });
});

// ---------------------------------------------------------------------------
// Scenario C5 — 3-level cascade
// JavaRosa: selectingValuesAtLevels1And2_ShouldFilterChoicesAtLevel3
// ---------------------------------------------------------------------------

describe('Scenario C5 — 3-level cascade', () => {
  it('returns only villages matching selected region and district', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('C5 3-level cascade'),
          model(
            mainInstance(
              t('data id="c5"', t('region'), t('district'), t('village')),
            ),
            instance(
              'districts',
              t('item', t('name', 'ndist1'), t('region', 'north'), t('label', 'N-Dist-1')),
              t('item', t('name', 'sdist1'), t('region', 'south'), t('label', 'S-Dist-1')),
            ),
            instance(
              'villages',
              t('item', t('name', 'nv1'), t('district', 'ndist1'), t('label', 'NV-1')),
              t('item', t('name', 'nv2'), t('district', 'ndist1'), t('label', 'NV-2')),
              t('item', t('name', 'sv1'), t('district', 'sdist1'), t('label', 'SV-1')),
            ),
            bind('/data/region').type('string'),
            bind('/data/district').type('string'),
            bind('/data/village').type('string'),
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
          t(
            'select1 ref="/data/village"',
            t(
              "itemset nodeset=\"instance('villages')/root/item[district = /data/district]\"",
              t('value ref="name"'),
              t('label ref="label"'),
            ),
          ),
        ),
      ),
    );

    scenario.answer('/data/region', 'north');
    scenario.answer('/data/district', 'ndist1');
    const choices = scenario.choicesOf('/data/village');
    expect(choices).toHaveLength(2);
    const values = choices.map((c) => (c as unknown as { getValue(): string }).getValue());
    expect(values).toContain('nv1');
    expect(values).toContain('nv2');
    expect(values).not.toContain('sv1');
  });
});
