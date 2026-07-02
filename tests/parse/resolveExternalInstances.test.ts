/**
 * Tests for the async hydration step `resolveExternalInstances` (PR3, task 14).
 *
 * Fetches raw CSV text via the registered ExternalInstanceResolver for each
 * declared external instance, converts it to an InstanceTree, and merges it
 * into `secondaryInstances` — producing a FormDefinition indistinguishable
 * in shape from one where the instance was declared inline.
 */

import { describe, it, expect, vi } from 'vitest';
import { parseForm } from '../../src/parse/XFormParser.ts';
import { resolveExternalInstances } from '../../src/parse/resolveExternalInstances.ts';
import { registerExternalInstanceResolver } from '../../src/platform/ExternalInstanceResolver.ts';
import { html, head, body, model, mainInstance, bind, input, t, label } from '../harness/XFormsElement.ts';
import type { XFormsElement } from '../harness/XFormsElement.ts';

function formXml(form: XFormsElement): string {
  return form.asXml();
}

function singleExternalForm() {
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

function multiExternalForm() {
  return formXml(
    html(
      head(
        model(
          mainInstance(t('data id="test"', t('name', 'Alice'))),
          t('instance id="cities" src="jr://file-csv/cities.csv"'),
          t('instance id="regions" src="jr://file-csv/regions.csv"'),
          bind('/data/name').type('string'),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

function inlineOnlyForm() {
  return formXml(
    html(
      head(
        model(
          mainInstance(t('data id="test"', t('name', 'Alice'))),
          bind('/data/name').type('string'),
        ),
      ),
      body(input('/data/name', label('Your Name'))),
    ),
  );
}

describe('resolveExternalInstances', () => {
  it('identity fast-path: no externalInstances returns an equivalent def unchanged', async () => {
    const def = parseForm(inlineOnlyForm());
    const resolved = await resolveExternalInstances(def);

    expect(resolved.secondaryInstances).toBe(def.secondaryInstances);
    expect(resolved.externalInstances.size).toBe(0);
  });

  it('single external instance with a registered resolver hydrates secondaryInstances', async () => {
    const def = parseForm(singleExternalForm());

    registerExternalInstanceResolver({
      resolve(uri: string): Promise<string> {
        expect(uri).toBe('jr://file-csv/cities.csv');
        return Promise.resolve('name,region\nMerida,Yucatan\nOaxaca,Oaxaca\n');
      },
    });

    const resolved = await resolveExternalInstances(def);

    expect(resolved.secondaryInstances.has('cities')).toBe(true);
    const tree = resolved.secondaryInstances.get('cities')!;
    expect(tree.root.name).toBe('root');
    expect(tree.root.children).toHaveLength(2);
  });

  it('multiple external instances are all resolved and merged', async () => {
    const def = parseForm(multiExternalForm());

    registerExternalInstanceResolver({
      resolve(uri: string): Promise<string> {
        if (uri === 'jr://file-csv/cities.csv') {
          return Promise.resolve('name\nMerida\n');
        }
        if (uri === 'jr://file-csv/regions.csv') {
          return Promise.resolve('name\nYucatan\n');
        }
        return Promise.reject(new Error(`unexpected uri: ${uri}`));
      },
    });

    const resolved = await resolveExternalInstances(def);

    expect(resolved.secondaryInstances.has('cities')).toBe(true);
    expect(resolved.secondaryInstances.has('regions')).toBe(true);
  });

  it('resolver rejects -> promise rejects with a prefixed error message', async () => {
    const def = parseForm(singleExternalForm());

    registerExternalInstanceResolver({
      resolve(): Promise<string> {
        return Promise.reject(new Error('network down'));
      },
    });

    await expect(resolveExternalInstances(def)).rejects.toThrow(
      "resolveExternalInstances: failed to resolve external instance 'cities' (jr://file-csv/cities.csv): Error: network down",
    );
  });

  it('malformed CSV -> promise rejects with a prefixed error message', async () => {
    const def = parseForm(singleExternalForm());

    registerExternalInstanceResolver({
      resolve(): Promise<string> {
        return Promise.resolve('');
      },
    });

    await expect(resolveExternalInstances(def)).rejects.toThrow(
      /resolveExternalInstances: external instance 'cities' \(jr:\/\/file-csv\/cities\.csv\) has malformed CSV:/,
    );
  });

  it('resolver resolves to null for a CSV external -> still throws a prefixed error (ADR-1 non-regression)', async () => {
    // sdd/last-saved-instance ADR-1: widening ExternalInstanceResolver.resolve
    // to `Promise<string | null>` must NOT weaken the CSV path's fail-loud
    // guarantee — a `null` result for a non-last-saved src is still a failure.
    const def = parseForm(singleExternalForm());

    registerExternalInstanceResolver({
      resolve(): Promise<string | null> {
        return Promise.resolve(null);
      },
    });

    await expect(resolveExternalInstances(def)).rejects.toThrow(
      "resolveExternalInstances: external instance 'cities' (jr://file-csv/cities.csv)",
    );
  });

  it("no resolver registered -> throws the seam's unregistered error", async () => {
    const def = parseForm(singleExternalForm());

    // `tests/setup.ts` registers a default (rejecting) resolver globally, so
    // to exercise the true unregistered-seam path we reset the module
    // registry and re-import fresh, unregistered instances of both the seam
    // and the hydration module under test (mirroring the technique used in
    // tests/platform/ExternalInstanceResolver.test.ts).
    vi.resetModules();
    const fresh = await import('../../src/parse/resolveExternalInstances.ts');

    await expect(fresh.resolveExternalInstances(def)).rejects.toThrow(
      /ExternalInstanceResolver provider is not registered/,
    );
  });
});
