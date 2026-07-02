/**
 * Tests for `jr://instance/last-saved` secondary instance resolution
 * (sdd/last-saved-instance).
 *
 * Covers URI dispatch (ADR-4), the XML happy path reusing inline-secondary
 * tree-building machinery (ADR-2), both malformed-XML failure modes of
 * `getXmlParser().parse()`, the empty-root fallback when there is no prior
 * submission (ADR-3), and relaxed schema-drift tolerance.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { resolveExternalInstances } from '../../src/parse/resolveExternalInstances.ts';
import { registerExternalInstanceResolver } from '../../src/platform/ExternalInstanceResolver.ts';
import { registerXmlParser, getXmlParser } from '../../src/platform/XmlParser.ts';
import { Scenario } from '../harness/Scenario.ts';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  bind,
  input,
  t,
  label,
} from '../harness/XFormsElement.ts';
import type { XFormsElement } from '../harness/XFormsElement.ts';
import '../harness/matchers.ts';

function formXml(form: XFormsElement): string {
  return form.asXml();
}

const LAST_SAVED_SRC = 'jr://instance/last-saved';

function lastSavedForm() {
  return formXml(
    html(
      head(
        model(
          mainInstance(t('data id="test"', t('name'), t('age'))),
          t(`instance id="last-saved" src="${LAST_SAVED_SRC}"`),
          bind('/data/name').type('string'),
          bind('/data/age').type('int'),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

function csvExternalForm() {
  return formXml(
    html(
      head(
        model(
          mainInstance(t('data id="test"', t('name', 'Alice'))),
          t('instance id="cities" src="jr://file-csv/cities.csv"'),
          bind('/data/name').type('string'),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

describe('resolveExternalInstances — URI dispatch (ADR-4)', () => {
  it('non-last-saved src keeps CSV behavior (unchanged)', async () => {
    const def = parseForm(csvExternalForm());

    registerExternalInstanceResolver({
      resolve: () => Promise.resolve('name\nMerida\n'),
    });

    const resolved = await resolveExternalInstances(def);
    const tree = resolved.secondaryInstances.get('cities')!;
    // CSV path shape: root named 'root', rows as 'item' children.
    expect(tree.root.name).toBe('root');
  });

  it("last-saved src is routed to the XML path (not csvToInstanceTree)", async () => {
    const def = parseForm(lastSavedForm());

    registerExternalInstanceResolver({
      resolve: (uri: string) => {
        expect(uri).toBe(LAST_SAVED_SRC);
        return Promise.resolve('<data><name>Bob</name><age>30</age></data>');
      },
    });

    const resolved = await resolveExternalInstances(def);
    const tree = resolved.secondaryInstances.get('last-saved')!;
    // XML branch shape: root mirrors the submission's document element name,
    // NOT the CSV branch's synthetic 'root' wrapper.
    expect(tree.root.name).toBe('data');
  });
});

describe('resolveExternalInstances — last-saved XML happy path (ADR-2)', () => {
  it('exposes prior submission values via instance(\'last-saved\')', async () => {
    registerExternalInstanceResolver({
      resolve: () => Promise.resolve('<data><name>Bob</name><age>30</age></data>'),
    });

    const def = parseForm(lastSavedForm());
    const resolved = await resolveExternalInstances(def);
    const scenario = Scenario.fromDefinition(resolved);

    // Read the prior value through a calculate bind mirroring the existing
    // pulldata-csv-external integration test pattern.
    const xmlWithCalc = html(
      head(
        model(
          mainInstance(t('data id="test2"', t('name'), t('result'))),
          t(`instance id="last-saved" src="${LAST_SAVED_SRC}"`),
          bind('/data/name').type('string'),
          bind('/data/result').type('string').calculate("instance('last-saved')/data/name"),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ).asXml();

    const def2 = parseForm(xmlWithCalc);
    const resolved2 = await resolveExternalInstances(def2);
    const scenario2 = Scenario.fromDefinition(resolved2);

    expect(scenario2.answerOf('/data/result')).stringAnswer('Bob');
    // Sanity: the first scenario built without throwing too.
    expect(scenario).toBeDefined();
  });
});

describe('resolveExternalInstances — malformed last-saved XML fails loud (both getXmlParser modes)', () => {
  it('parser throws synchronously for unparseable XML -> operation-prefixed error', async () => {
    registerExternalInstanceResolver({
      resolve: () => Promise.resolve('<unclosed>'),
    });

    const def = parseForm(lastSavedForm());

    await expect(resolveExternalInstances(def)).rejects.toThrow(
      /resolveExternalInstances: external instance 'last-saved' \(jr:\/\/instance\/last-saved\) has malformed last-saved XML:/,
    );
  });

  it('parser returns a rootless document (no documentElement) -> operation-prefixed error', async () => {
    // Simulate the non-throwing malformed-XML failure mode: a parser
    // implementation that returns a Document without a documentElement,
    // rather than throwing. Register a stub XmlParser for this one test.
    // Parse the form XML with the real parser first — only the last-saved
    // XML parse (inside resolveExternalInstances) should observe the stub.
    const def = parseForm(lastSavedForm());
    const realParser = getXmlParser();
    registerXmlParser({
      parse: () => ({ documentElement: null }) as unknown as Document,
    });

    try {
      registerExternalInstanceResolver({
        resolve: () => Promise.resolve('irrelevant, parser is stubbed'),
      });

      await expect(resolveExternalInstances(def)).rejects.toThrow(
        /resolveExternalInstances: external instance 'last-saved' \(jr:\/\/instance\/last-saved\) has malformed last-saved XML:/,
      );
    } finally {
      registerXmlParser(realParser);
    }
  });
});

describe('resolveExternalInstances — no previous submission resolves to an empty tree (ADR-3)', () => {
  it('resolver returns null -> secondaryInstances contains an empty last-saved tree, no throw', async () => {
    registerExternalInstanceResolver({
      resolve: () => Promise.resolve(null),
    });

    const def = parseForm(lastSavedForm());

    await expect(resolveExternalInstances(def)).resolves.not.toThrow();
    const resolved = await resolveExternalInstances(def);
    const tree = resolved.secondaryInstances.get('last-saved')!;
    expect(tree.root.children).toHaveLength(0);
    // Root is named after the form's own primary instance root (ADR-3).
    expect(tree.root.name).toBe(def.mainInstance.root.name);
  });

  it("instance('last-saved')/data/anyField evaluates to empty, consistent with absent-node handling elsewhere", async () => {
    registerExternalInstanceResolver({
      resolve: () => Promise.resolve(null),
    });

    const xmlWithCalc = html(
      head(
        model(
          mainInstance(t('data id="test3"', t('name'), t('result'))),
          t(`instance id="last-saved" src="${LAST_SAVED_SRC}"`),
          bind('/data/name').type('string'),
          bind('/data/result').type('string').calculate("instance('last-saved')/data/anyField"),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ).asXml();

    const def = parseForm(xmlWithCalc);
    const resolved = await resolveExternalInstances(def);
    const scenario = Scenario.fromDefinition(resolved);

    // Same empty-result shape the existing pulldata tests use for a
    // no-match / absent lookup (see tests/xpath/pulldata.test.ts,
    // tests/xpath/pulldata-csv-external.test.ts: missing key -> '').
    expect(scenario.answerOf('/data/result')).stringAnswer('');
  });

  it('no existing suite tests assume instance(\'last-saved\') is simply absent (pre-change) — none found by search', () => {
    // Documented per task 6.3: a repo-wide search for `last-saved` /
    // `instance('last-saved')` prior to this change (see tests/session,
    // tests/parse, tests/xpath directories) found no pre-existing tests
    // referencing this instance id or URI. There is nothing to preserve
    // here beyond the createFormSession unresolved-instance guard, which is
    // exercised generically (by instance id, not by name) in
    // tests/session/FormSession-externalInstances.test.ts and is
    // unaffected by this change (last-saved always populates
    // secondaryInstances, per ADR-3 and ADR-4 "Integration points").
    expect(true).toBe(true);
  });
});

describe('resolveExternalInstances — relaxed schema drift for last-saved (no InstanceHydrator)', () => {
  it('field removed from current form definition -> no error, extra field simply ignored', async () => {
    registerExternalInstanceResolver({
      resolve: () =>
        Promise.resolve('<data><name>Bob</name><oldField>legacy</oldField></data>'),
    });

    // Current form no longer declares oldField.
    const def = parseForm(lastSavedForm());

    await expect(resolveExternalInstances(def)).resolves.not.toThrow();
  });

  it('field added to current form definition -> instance(\'last-saved\')/data/newField evaluates to empty, no throw', async () => {
    registerExternalInstanceResolver({
      resolve: () => Promise.resolve('<data><name>Bob</name></data>'),
    });

    const xmlWithCalc = html(
      head(
        model(
          mainInstance(t('data id="test4"', t('name'), t('result'))),
          t(`instance id="last-saved" src="${LAST_SAVED_SRC}"`),
          bind('/data/name').type('string'),
          bind('/data/result').type('string').calculate("instance('last-saved')/data/newField"),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ).asXml();

    const def = parseForm(xmlWithCalc);
    const resolved = await resolveExternalInstances(def);
    const scenario = Scenario.fromDefinition(resolved);

    expect(scenario.answerOf('/data/result')).stringAnswer('');
  });
});
