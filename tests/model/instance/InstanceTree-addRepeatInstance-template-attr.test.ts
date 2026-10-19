/**
 * Regression test — cloning a repeat instance from its jr:template node must
 * not carry the jr:template="" attribute onto the new real instance.
 *
 * Bug: cloneNode() copies the source node's attributes verbatim, including
 * jr:template="" when the source is the repeat template. The clone (a real
 * instance) kept that orphaned jr:-prefixed attribute. serializeInstance has
 * no namespace-emission (documented out of scope), so the resulting XML had
 * a jr:-prefixed attribute with no xmlns:jr declaration anywhere in the
 * document. Re-parsing that XML with @xmldom/xmldom (used in production, see
 * tests/rn-smoke/xmldom-smoke.test.ts) throws:
 *   NamespaceError: prefix is non-null and namespace is null
 * which made any saved instance with 2+ repeat instances unrecoverable.
 */

import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { buildInstanceNode } from '../../../src/parse/XFormParser.ts';
import { getAttribute } from '../../../src/model/instance/InstanceNode.ts';
import { addRepeatInstance } from '../../../src/model/instance/InstanceTree.ts';
import { serializeInstance } from '../../../src/model/instance/InstanceSerializer.ts';
import { parseAbsoluteRef } from '../../../src/model/instance/TreeReference.ts';
import { getXmlParser } from '../../../src/platform/XmlParser.ts';
import type { InstanceTree } from '../../../src/model/instance/InstanceTree.ts';

function parseTree(xml: string): InstanceTree {
  const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
  const el = doc.documentElement as unknown as Element;
  return { root: buildInstanceNode(el), name: null };
}

describe('addRepeatInstance — jr:template attribute must not leak onto real instances', () => {
  it('strips jr:template from the cloned instance', () => {
    const tree = parseTree(
      '<data xmlns:jr="http://openrosa.org/javarosa">' +
        '<rep jr:template=""><child/></rep>' +
        '</data>',
    );

    const clone = addRepeatInstance(tree, parseAbsoluteRef('/data/rep'));

    expect(clone).not.toBeNull();
    expect(getAttribute(clone!, 'jr:template')).toBeUndefined();
  });

  it('round-trips through serialize → re-parse with xmldom without a NamespaceError, for 2+ instances cloned from the template', () => {
    const tree = parseTree(
      '<data xmlns:jr="http://openrosa.org/javarosa">' +
        '<rep jr:template=""><child/></rep>' +
        '</data>',
    );

    addRepeatInstance(tree, parseAbsoluteRef('/data/rep'));
    addRepeatInstance(tree, parseAbsoluteRef('/data/rep'));

    const xml = serializeInstance(tree, { isRelevant: () => true });

    // The template node itself is skipped by serializeInstance; only the two
    // real clones should appear, and neither should carry jr:template.
    expect(xml).not.toContain('jr:template');

    const parser = getXmlParser();
    expect(() => parser.parse(xml)).not.toThrow();
  });
});
