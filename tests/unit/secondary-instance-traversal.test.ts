/**
 * Unit test: cross-tree traversal via instance() XPath function (Slice 5b).
 *
 * Validates that instance('id')/root/... resolves correctly across the main
 * and secondary InstanceTree boundaries: the main-instance evaluator can
 * navigate into a secondary instance document node, apply predicates (including
 * predicates that reference the main instance via absolute paths), and produce
 * correct string-value results.
 *
 * This is the early-validation gate for the most novel runtime path in 5b.
 */

import { describe, it, expect } from 'vitest';
import { html, head, body, model, mainInstance, instance, bind, input, t, title } from '../harness/XFormsElement.ts';
import { Scenario } from '../harness/Scenario.ts';
import '../harness/matchers.ts';

describe('5b — cross-tree traversal via instance()', () => {
  it('instance(id)/root/leaf resolves a simple value from a secondary instance', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('cross-tree simple'),
          model(
            mainInstance(t('data id="ct-simple"', t('calc'))),
            instance('lookup', t('item', t('name', 'hello'))),
            bind('/data/calc').type('string').calculate("instance('lookup')/root/item/name"),
          ),
        ),
        body(input('/data/calc')),
      ),
    );
    expect(scenario.answerOf('/data/calc')).stringAnswer('hello');
  });

  it('instance(id)/root/item[pred] filters correctly within the secondary instance', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('cross-tree predicate'),
          model(
            mainInstance(t('data id="ct-pred"', t('calc'))),
            instance(
              'colors',
              t('item', t('code', 'r'), t('label', 'Red')),
              t('item', t('code', 'g'), t('label', 'Green')),
              t('item', t('code', 'b'), t('label', 'Blue')),
            ),
            bind('/data/calc').type('string').calculate("instance('colors')/root/item[code = 'g']/label"),
          ),
        ),
        body(input('/data/calc')),
      ),
    );
    expect(scenario.answerOf('/data/calc')).stringAnswer('Green');
  });

  it('instance(id) predicate referencing the main instance (cross-tree) resolves correctly', () => {
    // The predicate [code = /data/filter] references the main instance from
    // within a secondary-instance step — the canonical cross-tree access pattern.
    const scenario = Scenario.init(
      html(
        head(
          title('cross-tree main-ref predicate'),
          model(
            mainInstance(t('data id="ct-cross"', t('calc'), t('filter'))),
            instance(
              'colors',
              t('item', t('code', 'r'), t('label', 'Red')),
              t('item', t('code', 'g'), t('label', 'Green')),
              t('item', t('code', 'b'), t('label', 'Blue')),
            ),
            bind('/data/calc')
              .type('string')
              .calculate("instance('colors')/root/item[code = /data/filter]/label"),
            bind('/data/filter').type('string'),
          ),
        ),
        body(input('/data/filter')),
      ),
    );
    // Initial: no filter → no match → empty string
    expect(scenario.answerOf('/data/calc')).stringAnswer('');

    // Set filter → recalculate triggers → correct label resolved
    scenario.answer('/data/filter', 'b');
    expect(scenario.answerOf('/data/calc')).stringAnswer('Blue');

    scenario.answer('/data/filter', 'r');
    expect(scenario.answerOf('/data/calc')).stringAnswer('Red');
  });
});
