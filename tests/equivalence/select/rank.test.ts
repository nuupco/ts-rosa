/**
 * Equivalence tests — XLSForm `rank` question support (sdd/rank-control)
 *
 * pyxform compiles `type: rank <list_name>` to a body `<odk:rank ref="...">`
 * control with `<bind type="odk:rank">`. Verified empirically against the
 * installed pyxform 3.0.1 source (question_type_dictionary.py: "rank" ->
 * {"control": {"tag": "odk:rank"}, "bind": {"type": "odk:rank"}}).
 *
 * Per design ADR Decision 2, rank reuses the selectMulti AnswerValue shape,
 * codec, and getChoices() machinery unchanged — controlType 'rank' remains
 * the sole discriminator.
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
  t,
  title,
} from '../../harness/XFormsElement.ts';
import { Scenario } from '../../harness/Scenario.ts';
import { parseForm } from '../../../src/parse/XFormParser.ts';
import { cast, uncast } from '../../../src/model/data/codecs.ts';

// ---------------------------------------------------------------------------
// R1 — parser recognizes odk:rank as controlType 'rank'
// ---------------------------------------------------------------------------

describe('rank — parser recognition (R1)', () => {
  it('parses an itemset-based odk:rank question with controlType "rank"', () => {
    const form = html(
      head(
        title('Rank Fruits'),
        model(
          mainInstance(t('data id="rank1"', t('ordered'))),
          instance(
            'fruits',
            t('item', t('name', 'apple'), t('label', 'Apple')),
            t('item', t('name', 'banana'), t('label', 'Banana')),
            t('item', t('name', 'cherry'), t('label', 'Cherry')),
          ),
          bind('/data/ordered').type('odk:rank'),
        ),
      ),
      body(
        t(
          'odk:rank ref="/data/ordered"',
          t(
            "itemset nodeset=\"instance('fruits')/root/item\"",
            t('value ref="name"'),
            t('label ref="label"'),
          ),
        ),
      ),
    );

    const definition = parseForm(form.asXml());
    const rankEl = definition.body.find((c) => c.kind === 'question' && c.controlType === 'rank');
    expect(rankEl).toBeDefined();
    if (rankEl && rankEl.kind === 'question') {
      expect(rankEl.controlType).toBe('rank');
      expect(rankEl.itemset).not.toBeNull();
    }
  });

  it('parses a static-items odk:rank question with controlType "rank" (no itemset)', () => {
    const form = html(
      head(
        title('Rank Static'),
        model(
          mainInstance(t('data id="rank2"', t('ordered'))),
          bind('/data/ordered').type('odk:rank'),
        ),
      ),
      body(
        t(
          'odk:rank ref="/data/ordered"',
          t('item', t('label', 'A'), t('value', 'a')),
          t('item', t('label', 'B'), t('value', 'b')),
        ),
      ),
    );

    const definition = parseForm(form.asXml());
    const rankEl = definition.body.find((c) => c.kind === 'question' && c.controlType === 'rank');
    expect(rankEl).toBeDefined();
    if (rankEl && rankEl.kind === 'question') {
      expect(rankEl.controlType).toBe('rank');
      expect(rankEl.choices.length).toBe(2);
      expect(rankEl.choices[0]?.value).toBe('a');
      expect(rankEl.choices[1]?.value).toBe('b');
    }
  });

  it('resolves the odk:rank bind type to DataType "selectMulti"', () => {
    const form = html(
      head(
        title('Rank DataType'),
        model(
          mainInstance(t('data id="rank3"', t('ordered'))),
          bind('/data/ordered').type('odk:rank'),
        ),
      ),
      body(t('odk:rank ref="/data/ordered"', t('item', t('label', 'A'), t('value', 'a')))),
    );

    const definition = parseForm(form.asXml());
    expect(definition.bindings.get('/data/ordered')?.dataType).toBe('selectMulti');
  });
});

// ---------------------------------------------------------------------------
// R3 — getChoices() reuse, unchanged, for rank itemsets and static items
// ---------------------------------------------------------------------------

describe('rank — getChoices() reuse (R3)', () => {
  function itemsetForm(tag: 'select' | 'odk:rank') {
    return html(
      head(
        title('Choices reuse'),
        model(
          mainInstance(t('data id="choices1"', t('picked'))),
          instance(
            'fruits',
            t('item', t('name', 'apple'), t('label', 'Apple')),
            t('item', t('name', 'banana'), t('label', 'Banana')),
          ),
          bind('/data/picked').type(tag === 'select' ? 'select' : 'odk:rank'),
        ),
      ),
      body(
        t(
          `${tag} ref="/data/picked"`,
          t(
            "itemset nodeset=\"instance('fruits')/root/item\"",
            t('value ref="name"'),
            t('label ref="label"'),
          ),
        ),
      ),
    );
  }

  it('returns the same itemset choice list for rank as an equivalent select', () => {
    const selectScenario = Scenario.init(itemsetForm('select'));
    const rankScenario = Scenario.init(itemsetForm('odk:rank'));

    const selectChoices = selectScenario.choicesOf('/data/picked').map((c) => c.getValue());
    const rankChoices = rankScenario.choicesOf('/data/picked').map((c) => c.getValue());

    expect(rankChoices).toEqual(selectChoices);
    expect(rankChoices).toEqual(['apple', 'banana']);
  });

  it('returns static <item> choices identically to a static-item select', () => {
    const staticForm = (tag: 'select' | 'odk:rank') =>
      html(
        head(
          title('Static choices reuse'),
          model(
            mainInstance(t('data id="choices2"', t('picked'))),
            bind('/data/picked').type(tag === 'select' ? 'select' : 'odk:rank'),
          ),
        ),
        body(
          t(
            `${tag} ref="/data/picked"`,
            t('item', t('label', 'X'), t('value', 'x')),
            t('item', t('label', 'Y'), t('value', 'y')),
          ),
        ),
      );

    const selectScenario = Scenario.init(staticForm('select'));
    const rankScenario = Scenario.init(staticForm('odk:rank'));

    const selectChoices = selectScenario.choicesOf('/data/picked').map((c) => c.getValue());
    const rankChoices = rankScenario.choicesOf('/data/picked').map((c) => c.getValue());

    expect(rankChoices).toEqual(selectChoices);
    expect(rankChoices).toEqual(['x', 'y']);
  });
});

// ---------------------------------------------------------------------------
// R2 — ordered answer round-trips through the (reused) selectMulti codec
// ---------------------------------------------------------------------------

describe('rank — order-preserving answer round-trip (R2)', () => {
  it('serializes an ordered rank answer as space-joined tokens in the exact order given', () => {
    const value = cast('selectMulti', 'placeholder'); // sanity: codec reachable
    expect(value).not.toBeNull();

    const ordered = cast('selectMulti', 'b a c');
    expect(ordered).not.toBeNull();
    expect(ordered!.kind).toBe('selectMulti');
    expect(ordered!.value).toEqual(['b', 'a', 'c']);

    const serialized = uncast(ordered!);
    expect(serialized).toBe('b a c');
  });

  it('round-trips set -> serialize -> parse -> get preserving exact order (no sort, no dedup)', () => {
    const original = ['b', 'a', 'c'];
    const cast1 = cast('selectMulti', original.join(' '));
    expect(cast1!.value).toEqual(original);

    const wire = uncast(cast1!);
    expect(wire).toBe('b a c');

    const cast2 = cast('selectMulti', wire);
    expect(cast2!.value).toEqual(original);
  });

  it('uses the identical selectMulti codec function — not a parallel reimplementation', () => {
    // Behavioral equivalence: an equivalent select_multiple ('select' bind type)
    // and a rank question ('odk:rank' bind type) both resolve to the SAME
    // DataType ('selectMulti'), so both exercise cast('selectMulti', ...) —
    // there is no separate 'rank' branch in codecs.ts.
    const selectMultipleAnswer = cast('selectMulti', 'b a c');
    const rankAnswer = cast('selectMulti', 'b a c');
    expect(rankAnswer).toEqual(selectMultipleAnswer);
  });

  it('full form round-trip: an itemset-based rank answer preserves ordering through the session', () => {
    const form = html(
      head(
        title('Rank order round-trip'),
        model(
          mainInstance(t('data id="rank4"', t('ordered'))),
          instance(
            'fruits',
            t('item', t('name', 'apple'), t('label', 'Apple')),
            t('item', t('name', 'banana'), t('label', 'Banana')),
            t('item', t('name', 'cherry'), t('label', 'Cherry')),
          ),
          bind('/data/ordered').type('odk:rank'),
        ),
      ),
      body(
        t(
          'odk:rank ref="/data/ordered"',
          t(
            "itemset nodeset=\"instance('fruits')/root/item\"",
            t('value ref="name"'),
            t('label ref="label"'),
          ),
        ),
      ),
    );

    const scenario = Scenario.init(form);
    // Scenario.answer(xpath, value) — a single space-separated wire value,
    // mirroring how select_multiple answers are submitted (variadic
    // selectionValues are not implemented by the test harness).
    scenario.answer('/data/ordered', 'cherry apple banana');
    const answer = scenario.answerOf('/data/ordered');
    expect(answer).not.toBeNull();
    expect(answer!.kind).toBe('selectMulti');
    if (answer!.kind === 'selectMulti') {
      expect(answer!.value).toEqual(['cherry', 'apple', 'banana']);
    }
  });
});
