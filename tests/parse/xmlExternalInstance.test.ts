/**
 * Tests for `jr://file/*.xml` external secondary instances
 * (sdd/xml-external-instances).
 *
 * Covers case-insensitive `.xml` extension dispatch (distinct from the exact
 * `jr://instance/last-saved` literal and the CSV fallback), reuse of the
 * shared XML-to-tree hydration machinery, and the fail-loud contract (throw
 * on unregistered resolver, null resolver result, and malformed/rootless
 * XML) — the opposite of last-saved's relaxed/tolerant policy.
 */

import { describe, it, expect, vi } from 'vitest';
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

function xmlExternalForm(src = 'jr://file/choices.xml') {
  return formXml(
    html(
      head(
        model(
          mainInstance(t('data id="test"', t('name', 'Alice'))),
          t(`instance id="x" src="${src}"`),
          bind('/data/name').type('string'),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

function mixedExternalsForm() {
  return formXml(
    html(
      head(
        model(
          mainInstance(t('data id="test"', t('name'))),
          t(`instance id="last-saved" src="${LAST_SAVED_SRC}"`),
          t('instance id="cities" src="jr://file-csv/cities.csv"'),
          t('instance id="choices" src="jr://file/choices.xml"'),
          bind('/data/name').type('string'),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

function unknownExtensionForm() {
  return formXml(
    html(
      head(
        model(
          mainInstance(t('data id="test"', t('name', 'Alice'))),
          t('instance id="mystery" src="jr://file/mystery"'),
          bind('/data/name').type('string'),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

describe('resolveExternalInstances — .xml extension dispatch', () => {
  it('.xml src (lowercase) routes to the XML branch, not CSV', async () => {
    const def = parseForm(xmlExternalForm());

    registerExternalInstanceResolver({
      resolve: () => Promise.resolve('<root><item>a</item><item>b</item></root>'),
    });

    const resolved = await resolveExternalInstances(def);
    const tree = resolved.secondaryInstances.get('x')!;
    // XML branch shape: root mirrors the document element name, not the CSV
    // branch's synthetic 'root' wrapper built from rows.
    expect(tree.root.name).toBe('root');
    expect(tree.root.children).toHaveLength(2);
  });

  it('.XML uppercase extension routes to the XML branch (case-insensitive)', async () => {
    const def = parseForm(xmlExternalForm('jr://file/Choices.XML'));

    registerExternalInstanceResolver({
      resolve: (uri: string) => {
        expect(uri).toBe('jr://file/Choices.XML');
        return Promise.resolve('<root><item>a</item></root>');
      },
    });

    const resolved = await resolveExternalInstances(def);
    const tree = resolved.secondaryInstances.get('x')!;
    expect(tree.root.name).toBe('root');
  });

  it('exact last-saved literal is never shadowed by the .xml extension check', async () => {
    const def = parseForm(
      formXml(
        html(
          head(
            model(
              mainInstance(t('data id="test"', t('name'))),
              t(`instance id="last-saved" src="${LAST_SAVED_SRC}"`),
              bind('/data/name').type('string'),
            ),
          ),
          body(input('/data/name', label('Your Name'))),
        ),
      ),
    );

    registerExternalInstanceResolver({
      resolve: () => Promise.resolve(null),
    });

    // Last-saved's relaxed null->empty-tree policy applies, proving this
    // went through the last-saved branch and not the fail-loud XML branch
    // (which would throw on null).
    await expect(resolveExternalInstances(def)).resolves.not.toThrow();
  });

  it('unknown-extension src still hits the CSV path unchanged', async () => {
    const def = parseForm(unknownExtensionForm());

    registerExternalInstanceResolver({
      resolve: () => Promise.resolve('name\nMerida\n'),
    });

    const resolved = await resolveExternalInstances(def);
    const tree = resolved.secondaryInstances.get('mystery')!;
    // CSV branch shape: root named 'root', rows as 'item' children.
    expect(tree.root.name).toBe('root');
  });

  it('one form combining last-saved + .csv + .xml externals resolves all three correctly', async () => {
    const def = parseForm(mixedExternalsForm());

    registerExternalInstanceResolver({
      resolve: (uri: string) => {
        if (uri === LAST_SAVED_SRC) {
          return Promise.resolve('<data><name>Bob</name></data>');
        }
        if (uri === 'jr://file-csv/cities.csv') {
          return Promise.resolve('name\nMerida\n');
        }
        if (uri === 'jr://file/choices.xml') {
          return Promise.resolve('<root><item>a</item></root>');
        }
        return Promise.reject(new Error(`unexpected uri: ${uri}`));
      },
    });

    const resolved = await resolveExternalInstances(def);

    expect(resolved.secondaryInstances.get('last-saved')!.root.name).toBe('data');
    expect(resolved.secondaryInstances.get('cities')!.root.name).toBe('root');
    expect(resolved.secondaryInstances.get('choices')!.root.name).toBe('root');
  });
});

describe('resolveExternalInstances — .xml external hydration reuses shared machinery', () => {
  it("exposes content via instance('x') XPath queries, identical to an inline instance", async () => {
    registerExternalInstanceResolver({
      resolve: () => Promise.resolve('<root><item>Merida</item></root>'),
    });

    const xmlWithCalc = html(
      head(
        model(
          mainInstance(t('data id="test"', t('name'), t('result'))),
          t('instance id="x" src="jr://file/choices.xml"'),
          bind('/data/name').type('string'),
          bind('/data/result').type('string').calculate("instance('x')/root/item"),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ).asXml();

    const def = parseForm(xmlWithCalc);
    const resolved = await resolveExternalInstances(def);
    const scenario = Scenario.fromDefinition(resolved);

    expect(scenario.answerOf('/data/result')).stringAnswer('Merida');
  });
});

describe('resolveExternalInstances — .xml external instances are fail-loud', () => {
  it("no resolver registered -> propagates the seam's unregistered error unchanged", async () => {
    const def = parseForm(xmlExternalForm());

    vi.resetModules();
    const fresh = await import('../../src/parse/resolveExternalInstances.ts');

    await expect(fresh.resolveExternalInstances(def)).rejects.toThrow(
      /ExternalInstanceResolver provider is not registered/,
    );
  });

  it('resolver returns null -> throws an operation-prefixed error naming id and src', async () => {
    const def = parseForm(xmlExternalForm());

    registerExternalInstanceResolver({
      resolve: () => Promise.resolve(null),
    });

    await expect(resolveExternalInstances(def)).rejects.toThrow(
      "resolveExternalInstances: external instance 'x' (jr://file/choices.xml) has malformed external XML: resolver returned null",
    );
  });

  it('malformed (unparseable) XML -> throws "malformed external XML"', async () => {
    const def = parseForm(xmlExternalForm());

    registerExternalInstanceResolver({
      resolve: () => Promise.resolve('<unclosed>'),
    });

    await expect(resolveExternalInstances(def)).rejects.toThrow(
      /resolveExternalInstances: external instance 'x' \(jr:\/\/file\/choices\.xml\) has malformed external XML:/,
    );
  });

  it('rootless XML document (no documentElement) -> throws "malformed external XML: no root element"', async () => {
    const def = parseForm(xmlExternalForm());
    const realParser = getXmlParser();
    registerXmlParser({
      parse: () => ({ documentElement: null }) as unknown as Document,
    });

    try {
      registerExternalInstanceResolver({
        resolve: () => Promise.resolve('irrelevant, parser is stubbed'),
      });

      await expect(resolveExternalInstances(def)).rejects.toThrow(
        "resolveExternalInstances: external instance 'x' (jr://file/choices.xml) has malformed external XML: no root element",
      );
    } finally {
      registerXmlParser(realParser);
    }
  });
});
