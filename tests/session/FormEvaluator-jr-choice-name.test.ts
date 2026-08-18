/**
 * Regression tests — jr:choice-name() (https://getodk.github.io/xforms-spec/#fn:jr:choice-name).
 *
 * Bug: `XPathChoiceNode` (src/xpath/vendor/xpath/adapter/interface/
 * XPathChoiceNode.ts) declared `getChoiceName(value): string | null`, but NO
 * node type implemented it — every jr:choice-name() call threw
 * "...which has no possible choices" for ANY well-formed form using it,
 * static choices or itemset alike. Reported by a field test against
 * xform-native: opening a real XForm with jr:choice-name() over a select1
 * crashed immediately.
 *
 * Fix: InstanceElementNode now implements getChoiceName by delegating to a
 * FormEvaluator-owned resolver (same seam pattern as setActiveRelevanceCheck),
 * which reuses getChoices() entirely — same cache, same static/itemset
 * branching, same itext resolution — to find the matching choice's label.
 */

import { describe, it, expect } from 'vitest';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import { stringValue } from '../../src/model/data/codecs.ts';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  instance,
  bind,
  select1,
  item,
  t,
  title,
} from '../harness/XFormsElement.ts';

describe('jr:choice-name() — static choices', () => {
  it('resolves the label for the currently-selected static choice', () => {
    const def = parseForm(
      html(
        head(
          title('choice-name static'),
          model(
            mainInstance(t('data id="cn-static"', t('tecnico'), t('resumen'))),
            bind('/data/tecnico').type('string'),
            bind('/data/resumen').type('string').calculate("jr:choice-name(/data/tecnico, '/data/tecnico')"),
          ),
        ),
        body(
          select1('/data/tecnico', item('juan', 'Juan Perez'), item('maria', 'Maria Lopez')),
        ),
      ).asXml(),
    );
    const session = createFormSession(def);

    session.evaluator.answerQuestion(parseAbsoluteRef('/data/tecnico'), stringValue('juan'));

    expect(session.evaluator.evaluateOnInstance('/data/resumen')).toBe('Juan Perez');
  });

  it('re-resolves when the selection changes', () => {
    const def = parseForm(
      html(
        head(
          title('choice-name static 2'),
          model(
            mainInstance(t('data id="cn-static-2"', t('tecnico'), t('resumen'))),
            bind('/data/tecnico').type('string'),
            bind('/data/resumen').type('string').calculate("jr:choice-name(/data/tecnico, '/data/tecnico')"),
          ),
        ),
        body(
          select1('/data/tecnico', item('juan', 'Juan Perez'), item('maria', 'Maria Lopez')),
        ),
      ).asXml(),
    );
    const session = createFormSession(def);
    const ref = parseAbsoluteRef('/data/tecnico');

    session.evaluator.answerQuestion(ref, stringValue('juan'));
    expect(session.evaluator.evaluateOnInstance('/data/resumen')).toBe('Juan Perez');

    session.evaluator.answerQuestion(ref, stringValue('maria'));
    expect(session.evaluator.evaluateOnInstance('/data/resumen')).toBe('Maria Lopez');
  });

  it("returns '' for a value with no matching choice, instead of throwing", () => {
    const def = parseForm(
      html(
        head(
          title('choice-name no match'),
          model(
            mainInstance(t('data id="cn-nomatch"', t('tecnico'), t('resumen'))),
            bind('/data/tecnico').type('string'),
            bind('/data/resumen').type('string').calculate("jr:choice-name(/data/tecnico, '/data/tecnico')"),
          ),
        ),
        body(
          select1('/data/tecnico', item('juan', 'Juan Perez')),
        ),
      ).asXml(),
    );
    const session = createFormSession(def);

    session.evaluator.answerQuestion(parseAbsoluteRef('/data/tecnico'), stringValue('nobody'));

    expect(session.evaluator.evaluateOnInstance('/data/resumen')).toBe('');
  });
});

describe('jr:choice-name() — itemset (dynamic choices)', () => {
  it('resolves the label from a secondary-instance-backed itemset', () => {
    const def = parseForm(
      html(
        head(
          title('choice-name itemset'),
          model(
            mainInstance(t('data id="cn-itemset"', t('tecnico'), t('resumen'))),
            instance(
              'tecnicos',
              t('item', t('name', 'juan'), t('label', 'Juan Perez')),
              t('item', t('name', 'maria'), t('label', 'Maria Lopez')),
            ),
            bind('/data/tecnico').type('string'),
            bind('/data/resumen').type('string').calculate("jr:choice-name(/data/tecnico, '/data/tecnico')"),
          ),
        ),
        body(
          t(
            'select1 ref="/data/tecnico"',
            t(
              "itemset nodeset=\"instance('tecnicos')/root/item\"",
              t('value ref="name"'),
              t('label ref="label"'),
            ),
          ),
        ),
      ).asXml(),
    );
    const session = createFormSession(def);

    session.evaluator.answerQuestion(parseAbsoluteRef('/data/tecnico'), stringValue('maria'));

    expect(session.evaluator.evaluateOnInstance('/data/resumen')).toBe('Maria Lopez');
  });
});
