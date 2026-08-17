/**
 * InstanceSerializer tests — Slice 6a RED bar
 *
 * Covers:
 *   - 6A-S1: basic round-trip
 *   - 6A-S2: non-relevant field excluded
 *   - 6A-S3: template excluded, repeat instances in order
 *   - 6A-S4: attributes preserved + escaped
 *   - 6A-S5: unicode preserved verbatim
 *   - 6A-S6: null-value leaf emits empty element
 *   - ADR-1 guards: boolean→"1"/"0", decimal→"1.0"
 *   - XML escaping in text content and attribute values
 *   - Idempotency (REQ-6A-9)
 *
 * JavaRosa provenance:
 *   - ONE test is ported from JavaRosa:
 *       6A-S5 "preserves multi-byte unicode characters"
 *       Source: XFormSerializingVisitorTest#serializeInstance_preservesUnicodeCharacters
 *       (XFormSerializingVisitorTest.java has exactly 1 @Test method)
 *   - Answer wire-format (ADR-1/ADR-2 guards: boolean→"1"/"0", decimal→"1.0") is
 *     informed by XFormAnswerDataSerializerTest, but re-implemented as ts-rosa-original
 *     unit tests — not direct ports.
 *   - All remaining tests (6A-S1, 6A-S2, 6A-S3, 6A-S4, 6A-S6, XML escaping,
 *     idempotency, ADR guards) are ts-rosa-original serialization-contract tests
 *     (Phase 6 slice 6a, ADR-1/ADR-2). No direct JavaRosa counterpart.
 */

import { describe, expect, it } from 'vitest';
import {
  serializeInstance,
  type SerializeOptions,
} from '../../../src/model/instance/InstanceSerializer.ts';
import { newNode, appendChild, setAttribute } from '../../../src/model/instance/InstanceNode.ts';
import { INDEX_TEMPLATE } from '../../../src/model/instance/multiplicity.ts';
import {
  stringValue,
  intValue,
  decimalValue,
  booleanValue,
} from '../../../src/model/data/codecs.ts';
import type { InstanceTree } from '../../../src/model/instance/InstanceTree.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTree(root: ReturnType<typeof newNode>): InstanceTree {
  return { root, name: null };
}

function alwaysRelevant(): SerializeOptions {
  return { isRelevant: () => true };
}

// ---------------------------------------------------------------------------
// 6A-S1 — basic round-trip
// ---------------------------------------------------------------------------

describe('serializeInstance — 6A-S1 basic round-trip', () => {
  it('emits root element containing a leaf with text content', () => {
    const root = newNode('data');
    const name = newNode('name');
    name.value = stringValue('Alice');
    appendChild(root, name);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('<name>Alice</name>');
    expect(xml).toMatch(/^<data>/);
    expect(xml).toMatch(/<\/data>$/);
  });

  it('is idempotent — two calls return the same string (REQ-6A-9)', () => {
    const root = newNode('data');
    const f = newNode('field');
    f.value = stringValue('hello');
    appendChild(root, f);

    const tree = makeTree(root);
    const opts = alwaysRelevant();
    expect(serializeInstance(tree, opts)).toBe(serializeInstance(tree, opts));
  });
});

// ---------------------------------------------------------------------------
// 6A-S2 — non-relevant field excluded
// ---------------------------------------------------------------------------

describe('serializeInstance — 6A-S2 non-relevant field excluded', () => {
  it('omits non-relevant nodes and their descendants', () => {
    const root = newNode('data');
    const show = newNode('show');
    show.value = booleanValue(false);
    const detail = newNode('detail');
    detail.value = stringValue('hidden');
    appendChild(root, show);
    appendChild(root, detail);

    // detail is not relevant
    const opts: SerializeOptions = {
      isRelevant: (node) => node.name !== 'detail',
    };

    const xml = serializeInstance(makeTree(root), opts);
    expect(xml).not.toContain('<detail>');
    expect(xml).toContain('<show>');
  });
});

// ---------------------------------------------------------------------------
// 6A-S3 — template excluded, repeat instances in order
// ---------------------------------------------------------------------------

describe('serializeInstance — 6A-S3 template excluded, repeat instances in order', () => {
  it('excludes INDEX_TEMPLATE nodes', () => {
    const root = newNode('data');
    const template = newNode('item');
    template.multiplicity = INDEX_TEMPLATE;
    template.value = stringValue('template-value');
    appendChild(root, template);
    // Restore template multiplicity (appendChild auto-assigns, we need to force it)
    template.multiplicity = INDEX_TEMPLATE;

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    // The template should not appear — only real instances appear
    // With no real instances, the output is just the root element
    expect(xml).not.toContain('template-value');
  });

  it('includes non-template repeat instances in document order', () => {
    const root = newNode('data');

    // Template
    const template = newNode('item');
    template.multiplicity = INDEX_TEMPLATE;
    root.children.push(template);
    template.parent = root;

    // Instance 0
    const inst0 = newNode('item');
    inst0.multiplicity = 0;
    const label0 = newNode('label');
    label0.value = stringValue('first');
    inst0.children.push(label0);
    label0.parent = inst0;
    root.children.push(inst0);
    inst0.parent = root;

    // Instance 1
    const inst1 = newNode('item');
    inst1.multiplicity = 1;
    const label1 = newNode('label');
    label1.value = stringValue('second');
    inst1.children.push(label1);
    label1.parent = inst1;
    root.children.push(inst1);
    inst1.parent = root;

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).not.toContain('INDEX_TEMPLATE');
    const firstIdx = xml.indexOf('first');
    const secondIdx = xml.indexOf('second');
    expect(firstIdx).toBeLessThan(secondIdx);
    // Exactly two <item> elements
    const itemMatches = xml.match(/<item>/g);
    expect(itemMatches).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 6A-S4 — attributes preserved
// ---------------------------------------------------------------------------

describe('serializeInstance — 6A-S4 attributes preserved', () => {
  it('emits attributes on leaf elements', () => {
    const root = newNode('data');
    const meta = newNode('meta');
    const instanceID = newNode('instanceID');
    instanceID.value = stringValue('uuid:abc-123');
    setAttribute(instanceID, 'id', 'uuid:abc-123');
    appendChild(root, meta);
    appendChild(meta, instanceID);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('id="uuid:abc-123"');
  });

  it('escapes double-quotes in attribute values', () => {
    const root = newNode('data');
    const node = newNode('field');
    node.value = stringValue('x');
    setAttribute(node, 'label', 'say "hello"');
    appendChild(root, node);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('label="say &quot;hello&quot;"');
  });

  it('escapes & in attribute values', () => {
    const root = newNode('data');
    const node = newNode('field');
    node.value = stringValue('x');
    setAttribute(node, 'key', 'a&b');
    appendChild(root, node);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('key="a&amp;b"');
  });
});

// ---------------------------------------------------------------------------
// 6A-S5 — unicode preserved verbatim
// ---------------------------------------------------------------------------

describe('serializeInstance — 6A-S5 unicode preserved verbatim', () => {
  // Source: XFormSerializingVisitorTest#serializeInstance_preservesUnicodeCharacters
  it('preserves multi-byte unicode characters (JR equivalence: serializeInstance_preservesUnicodeCharacters)', () => {
    const root = newNode('data');
    const greeting = newNode('greeting');
    greeting.value = stringValue('こんにちは');
    appendChild(root, greeting);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    // Must appear as literal UTF characters, not numeric entities
    expect(xml).toContain('こんにちは');
    expect(xml).not.toContain('&#');
  });

  it('preserves emoji verbatim', () => {
    const root = newNode('data');
    const emoji = newNode('note');
    emoji.value = stringValue('hello 🌍');
    appendChild(root, emoji);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('hello 🌍');
  });
});

// ---------------------------------------------------------------------------
// 6A-S6 — null-value leaf emits empty element (REQ-6A-7)
// ---------------------------------------------------------------------------

describe('serializeInstance — 6A-S6 null-value leaf emits empty element', () => {
  it('emits self-closing element for null value (ADR-3)', () => {
    const root = newNode('data');
    const notes = newNode('notes');
    // notes.value is null (default)
    appendChild(root, notes);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    // Should emit either <notes/> or <notes></notes> — NOT missing entirely
    const hasSelfClosing = xml.includes('<notes/>');
    const hasEmpty = xml.includes('<notes></notes>');
    expect(hasSelfClosing || hasEmpty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ADR-1 guards — wire-format value encoding
// ---------------------------------------------------------------------------

describe('serializeInstance — ADR-1 wire-format guards', () => {
  it('serializes boolean true → "1" (not "true")', () => {
    const root = newNode('data');
    const flag = newNode('flag');
    flag.value = booleanValue(true);
    flag.dataType = 'boolean';
    appendChild(root, flag);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('<flag>1</flag>');
    expect(xml).not.toContain('true');
  });

  it('serializes boolean false → "0" (not "false")', () => {
    const root = newNode('data');
    const flag = newNode('flag');
    flag.value = booleanValue(false);
    flag.dataType = 'boolean';
    appendChild(root, flag);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('<flag>0</flag>');
    expect(xml).not.toContain('false');
  });

  it('serializes decimal whole number → "1.0" (Java Double.toString format)', () => {
    const root = newNode('data');
    const amount = newNode('amount');
    amount.value = decimalValue(1);
    amount.dataType = 'decimal';
    appendChild(root, amount);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('<amount>1.0</amount>');
  });

  it('serializes integer → plain integer string', () => {
    const root = newNode('data');
    const count = newNode('count');
    count.value = intValue(42);
    count.dataType = 'int';
    appendChild(root, count);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('<count>42</count>');
  });
});

// ---------------------------------------------------------------------------
// XML escaping in text content
// ---------------------------------------------------------------------------

describe('serializeInstance — XML escaping in text content', () => {
  it('escapes & in text content', () => {
    const root = newNode('data');
    const field = newNode('field');
    field.value = stringValue('a & b');
    appendChild(root, field);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('a &amp; b');
  });

  it('escapes < in text content', () => {
    const root = newNode('data');
    const field = newNode('field');
    field.value = stringValue('<tag>');
    appendChild(root, field);

    const xml = serializeInstance(makeTree(root), alwaysRelevant());
    expect(xml).toContain('&lt;tag&gt;');
  });
});
