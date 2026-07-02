/**
 * Integration round-trip test — createFormSession({ instanceXml }) end-to-end.
 *
 * sdd/instance-editing-hydration, PR3, task 22 (integration scenario).
 *
 * Exercises the full pipeline through the public API: hydrate a session from
 * a submission XML, answer additional questions on top of the loaded data,
 * then serialize and confirm the final XML reflects BOTH the originally
 * loaded answers and the newly-entered ones, with repeat multiplicity intact.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import { cast } from '../../src/model/data/codecs.ts';
import { html, head, body, model, mainInstance, bind, input, repeat, t, title } from '../../tests/harness/XFormsElement.ts';

function editableForm() {
  return html(
    head(
      title('Editable'),
      model(
        mainInstance(
          t(
            'data id="editable"',
            t('name'),
            t('age'),
            t('note'),
            t('items jr:template=""', t('label'), t('qty')),
          ),
        ),
        bind('/data/name').type('string'),
        bind('/data/age').type('int'),
        bind('/data/note').type('string'),
        bind('/data/items/label').type('string'),
        bind('/data/items/qty').type('int'),
      ),
    ),
    body(
      input('/data/name'),
      input('/data/age'),
      input('/data/note'),
      repeat('/data/items', input('/data/items/label'), input('/data/items/qty')),
    ),
  );
}

describe('createFormSession(instanceXml) — hydrate, answer more, serialize', () => {
  it('preserves loaded answers, reflects newly-entered answers, and keeps repeat multiplicity', () => {
    const definition = parseForm(editableForm().asXml());
    const submissionXml =
      '<data id="editable">' +
      '<name>Alice</name><age>30</age><note></note>' +
      '<items><label>Widget</label><qty>2</qty></items>' +
      '<items><label>Gadget</label><qty>5</qty></items>' +
      '</data>';

    const session = createFormSession(definition, { instanceXml: submissionXml });

    // Loaded answers are present before any new interaction.
    expect(session.serializeToXml()).toContain('<name>Alice</name>');

    // Answer a previously-empty question on top of the loaded data.
    const noteRef = parseAbsoluteRef('/data/note');
    const result = session.evaluator.answerQuestion(noteRef, cast('string', 'Reviewed'));
    expect(result).toBeDefined();

    const xml = session.serializeToXml();

    // Both originally-loaded answers and the newly-entered answer are present.
    expect(xml).toContain('<name>Alice</name>');
    expect(xml).toContain('<age>30</age>');
    expect(xml).toContain('<note>Reviewed</note>');

    // Repeat multiplicity from the loaded XML is preserved through the edit.
    const itemMatches = [
      ...xml.matchAll(/<items[^>]*><label>([^<]+)<\/label><qty>(\d+)<\/qty><\/items>/g),
    ];
    expect(itemMatches.map((m) => [m[1], m[2]])).toEqual([
      ['Widget', '2'],
      ['Gadget', '5'],
    ]);
  });
});
