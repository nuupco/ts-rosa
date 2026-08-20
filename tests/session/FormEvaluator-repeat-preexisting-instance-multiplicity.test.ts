/**
 * Regression for issue #2's real root cause: a `jr:count`-driven repeat with
 * a `jr:template` AND at least one already-answered real instance loaded
 * directly from the initial instance XML (e.g. a resumed/edited submission)
 * had its real instance's stored multiplicity offset by one, because
 * buildInstanceNode's same-name counter counted the template toward the
 * running total. The position(nodeset) XPath extension's fast path
 * (src/xpath/functions/xforms-position.ts) trusts that stored multiplicity
 * directly, so a `position(..)`-relative calculate (the "distribute an
 * outside select-multi's items across repeat instances" pattern) silently
 * read the WRONG list item for every pre-loaded instance.
 *
 * Minimal structural extraction of the real cached form from issue #2's
 * follow-up report: an outer non-repeating group wraps the outside select
 * and the repeat, the repeat's choices come from an external CSV secondary
 * instance, and the instance XML already contains one concrete repeat
 * instance next to the jr:template (not just the template).
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { resolveExternalInstances } from '../../src/parse/resolveExternalInstances.ts';
import { registerExternalInstanceResolver } from '../../src/platform/ExternalInstanceResolver.ts';
import { createFormSession } from '../../src/session/FormSession.ts';
import { parseAbsoluteRef } from '../../src/model/instance/TreeReference.ts';
import { resolveReference } from '../../src/model/instance/InstanceTree.ts';
import { stringValue } from '../../src/model/data/codecs.ts';

function formWithPreexistingRepeatInstance() {
  return `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Preexisting Repeat Instance</h:title>
    <model>
      <instance>
        <data id="preexisting-repeat-instance">
          <grp>
            <razon_visita/>
            <rep_razon_count/>
            <rep_razon jr:template="">
              <razon_actual/>
            </rep_razon>
            <rep_razon>
              <razon_actual/>
            </rep_razon>
          </grp>
        </data>
      </instance>
      <instance id="listado_razon_visita" src="jr://file-csv/listado_razon_visita.csv"/>
      <bind nodeset="/data/grp/razon_visita" type="string"/>
      <bind nodeset="/data/grp/rep_razon_count" calculate="count-selected(/data/grp/razon_visita)" type="int"/>
      <bind nodeset="/data/grp/rep_razon/razon_actual" calculate="selected-at(/data/grp/razon_visita, position(..)-1)" type="string"/>
    </model>
  </h:head>
  <h:body>
    <select ref="/data/grp/razon_visita">
      <itemset nodeset="instance('listado_razon_visita')/root/item">
        <value ref="name"/>
        <label ref="label"/>
      </itemset>
    </select>
    <group ref="/data/grp/rep_razon">
      <repeat nodeset="/data/grp/rep_razon" jr:count="/data/grp/rep_razon_count">
        <input ref="/data/grp/rep_razon/razon_actual"/>
      </repeat>
    </group>
  </h:body>
</h:html>`;
}

describe('repeat instance pre-loaded from initial XML next to its jr:template', () => {
  it('gets the correct 0-indexed multiplicity, so position(..)-based calculates read the right list item', async () => {
    registerExternalInstanceResolver({
      resolve: (uri: string) => {
        expect(uri).toBe('jr://file-csv/listado_razon_visita.csv');
        return Promise.resolve('name,label\nRV1,Visita tecnica\nRV2,Taller\nRV3,Otra\n');
      },
    });

    const definition = parseForm(formWithPreexistingRepeatInstance());
    const resolved = await resolveExternalInstances(definition);
    const session = createFormSession(resolved);

    // Confirm the instance XML already has one real rep_razon instance
    // loaded (not just the jr:template) before anything is answered.
    const preExisting = resolveReference(session.tree, parseAbsoluteRef('/data/grp/rep_razon[1]'));
    expect(preExisting).not.toBeNull();
    expect(preExisting!.multiplicity).toBe(0);

    session.evaluator.answerQuestion(parseAbsoluteRef('/data/grp/razon_visita'), stringValue('RV1 RV2 RV3'));

    const razonActual = resolveReference(session.tree, parseAbsoluteRef('/data/grp/rep_razon[1]/razon_actual'));
    expect(razonActual?.value?.displayText).toBe('RV1');
  });
});
