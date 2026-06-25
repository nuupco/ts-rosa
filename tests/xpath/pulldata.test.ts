/**
 * Smoke test: pulldata() wiring verification — Phase 6, slice 6e.
 *
 * REQ-6E-1: pulldata evaluates without throwing for a valid inline secondary instance.
 * REQ-6E-2: pulldata is registered and callable.
 *
 * The vendor pulldata builds: instance(id)/root/item[lookupCol='val']/returnCol
 * The instance() test helper wraps children in <root>, so items are direct children of root.
 *
 * Design note (ADR — 6e): pulldata is already registered via xfString spread in index.ts
 * and the vendor implementation calls context.evaluator.evaluateString(), which exists
 * (Evaluator.ts:169). No shim is expected. This test is the gate.
 */

import { describe, expect, it } from 'vitest';
import {
  bind,
  body,
  head,
  html,
  input,
  instance,
  mainInstance,
  model,
  t,
  title,
} from '../harness/XFormsElement.ts';
import { Scenario } from '../harness/Scenario.ts';
import '../harness/matchers.ts';

describe('pulldata() — wiring verification (slice 6e)', () => {
  it('pulldata returns the correct cell from an inline secondary instance', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('pulldata smoke test'),
          model(
            mainInstance(
              t('data id="pulldata-smoke"', t('result'), t('key')),
            ),
            instance(
              'data',
              t('item', t('name', 'opt1'), t('label', 'Option 1')),
              t('item', t('name', 'opt2'), t('label', 'Option 2')),
              t('item', t('name', 'opt3'), t('label', 'Option 3')),
            ),
            bind('/data/result')
              .type('string')
              .calculate("pulldata('data', 'label', 'name', /data/key)"),
            bind('/data/key').type('string'),
          ),
        ),
        body(input('/data/key')),
      ),
    );

    scenario.answer('/data/key', 'opt1');
    expect(scenario.answerOf('/data/result')).stringAnswer('Option 1');

    scenario.answer('/data/key', 'opt2');
    expect(scenario.answerOf('/data/result')).stringAnswer('Option 2');

    scenario.answer('/data/key', 'opt3');
    expect(scenario.answerOf('/data/result')).stringAnswer('Option 3');

    // No match → empty string
    scenario.answer('/data/key', 'missing');
    expect(scenario.answerOf('/data/result')).stringAnswer('');
  });

  it('pulldata with literal lookup value returns correct cell', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('pulldata literal smoke test'),
          model(
            mainInstance(
              t('data id="pulldata-literal"', t('result')),
            ),
            instance(
              'choices',
              t('item', t('name', 'alpha'), t('label', 'Alpha')),
              t('item', t('name', 'beta'), t('label', 'Beta')),
            ),
            bind('/data/result')
              .type('string')
              .calculate("pulldata('choices', 'label', 'name', 'alpha')"),
          ),
        ),
        body(input('/data/result')),
      ),
    );

    expect(scenario.answerOf('/data/result')).stringAnswer('Alpha');
  });
});
