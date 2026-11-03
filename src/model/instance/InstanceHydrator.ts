/**
 * InstanceHydrator — populate a fresh InstanceTree from a previously-submitted
 * ODK instance XML, for editing an existing submission.
 *
 * Pure module: no dependency on FormSession/FormEvaluator/FormNavigator.
 * Depends only on InstanceNode/InstanceTree primitives, codecs.cast, the
 * XmlParser seam, and domHelpers.
 *
 * Algorithm (design §3): parallel walk of the definition template tree
 * (`definition.mainInstance.root`) against the parsed submission XML DOM.
 * The template is authoritative for structure/types; the XML is authoritative
 * for values and repeat multiplicity.
 *
 * Drift policy (design ADR-E): strict on extras (throw HydrationError),
 * default-fill on missing template nodes, throw on cast failure.
 *
 * sdd/instance-editing-hydration, PR1 — tasks 1-11.
 */

import type { FormDefinition } from '../def/FormDefinition.ts';
import { cast } from '../data/codecs.ts';
import { getXmlParser } from '../../platform/XmlParser.ts';
import { childElementsByLocalName, directTextContent } from '../../parse/domHelpers.ts';
import { cloneNode, deleteAttribute, setAttribute, type InstanceNode } from './InstanceNode.ts';
import { INDEX_TEMPLATE } from './multiplicity.ts';
import type { InstanceTree } from './InstanceTree.ts';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Thrown for any hydration drift: root-name mismatch, unknown/extra XML
 * nodes not present in the template, unexpected multiplicity on a
 * non-repeat node, or a value that fails `cast()`. Always includes the
 * offending node's path (design ADR-E error contract).
 */
export class HydrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HydrationError';
  }
}

/**
 * Hydrate a fresh InstanceTree from a previously-submitted instance XML,
 * using `definition`'s template tree for structure, types, and repeat
 * templates.
 *
 * Does NOT mutate `definition.mainInstance` — the definition's template
 * tree is cloned before population (design ADR-A), so the returned tree is
 * independent and hydration is repeatable.
 */
export function hydrateInstance(definition: FormDefinition, instanceXml: string): InstanceTree {
  const doc = getXmlParser().parse(instanceXml);
  const dataRootEl = firstElementChild(doc);
  if (dataRootEl === null) {
    throw new HydrationError('hydration failed: submission XML has no root element');
  }

  const workingRoot = cloneNode(definition.mainInstance.root);

  if (workingRoot.name !== dataRootEl.localName) {
    throw new HydrationError(
      `hydration root mismatch: expected <${workingRoot.name}>, got <${dataRootEl.localName}>`,
    );
  }

  copyAttributes(workingRoot, dataRootEl);
  hydrateNode(workingRoot, dataRootEl, `/${workingRoot.name}`);

  return { root: workingRoot, name: definition.mainInstance.name };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function firstElementChild(doc: Document): Element | null {
  const children = doc.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1 /* ELEMENT_NODE */) {
      return child as Element;
    }
  }
  return null;
}

/** Copy non-namespace attributes from `el` onto `node`, overwriting template attrs (ADR-D). */
function copyAttributes(node: InstanceNode, el: Element): void {
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr && !attr.name.startsWith('xmlns')) {
      setAttribute(node, attr.name, attr.value);
    }
  }
}

/**
 * Recursive parallel walk: populate `templateNode`'s children (and, for
 * repeats, expand INDEX_TEMPLATE children to match the XML's actual
 * instance count) from `xmlEl`'s element children.
 *
 * `path` is the absolute path to `templateNode`, used for HydrationError
 * messages on its children.
 */
function hydrateNode(templateNode: InstanceNode, xmlEl: Element, path: string): void {
  const repeatTemplateNames = new Set<string>();
  for (const child of templateNode.children) {
    if (child.multiplicity === INDEX_TEMPLATE) {
      repeatTemplateNames.add(child.name);
    }
  }

  // A definition may carry a live default sibling next to a repeat's
  // jr:template element (e.g. KoboToolbox output). That sibling belongs to
  // the repeat, not to the non-repeat children.
  const nonRepeatChildren: InstanceNode[] = templateNode.children.filter(
    (c) => c.multiplicity !== INDEX_TEMPLATE && !repeatTemplateNames.has(c.name),
  );

  const definedNames = new Set<string>([
    ...repeatTemplateNames,
    ...nonRepeatChildren.map((c) => c.name),
  ]);

  // --- Non-repeat children: overlay values/attrs, or recurse into containers ---
  for (const t of nonRepeatChildren) {
    const childPath = `${path}/${t.name}`;
    const matches = childElementsByLocalName(xmlEl, t.name);

    if (matches.length === 0) {
      // Missing-node policy (ADR-E): leave template default, no error.
      continue;
    }
    if (matches.length > 1) {
      throw new HydrationError(
        `multiple <${t.name}> elements at ${childPath} but definition declares it non-repeating`,
      );
    }

    const match = matches[0]!;
    copyAttributes(t, match);

    if (t.children.length === 0) {
      const raw = directTextContent(match);
      if (raw === null) {
        t.value = null;
      } else {
        const value = cast(t.dataType, raw);
        if (value === null) {
          throw new HydrationError(`cannot cast "${raw}" to ${t.dataType} at ${childPath}`);
        }
        t.value = value;
      }
    } else {
      hydrateNode(t, match, childPath);
    }
  }

  // --- Repeat templates: expand INDEX_TEMPLATE to match XML instance count ---
  for (const name of repeatTemplateNames) {
    const tt = templateNode.children.find(
      (c) => c.name === name && c.multiplicity === INDEX_TEMPLATE,
    );
    if (tt === undefined) continue;

    const instances = childElementsByLocalName(xmlEl, name);
    const childPath = `${path}/${name}`;

    // The XML is authoritative for repeat count: drop the definition's live
    // default sibling(s) and put the hydrated instances in their place. With
    // no XML instances the default is kept (missing-node policy, ADR-E).
    if (instances.length === 0) continue;
    let insertAt = templateNode.children.length;
    for (let j = templateNode.children.length - 1; j >= 0; j--) {
      const c = templateNode.children[j]!;
      if (c.name === name && c.multiplicity !== INDEX_TEMPLATE) {
        templateNode.children.splice(j, 1);
        insertAt = j;
      }
    }

    for (let i = 0; i < instances.length; i++) {
      const xmlInstance = instances[i]!;
      // Mirrors addRepeatInstance (InstanceTree.ts): manual multiplicity
      // assignment + direct push, NOT appendChild — appendChild's
      // same-name sibling count would incorrectly include the
      // INDEX_TEMPLATE node itself, off-by-one-ing every instance.
      const clone = cloneNode(tt);
      clone.multiplicity = i;
      clone.parent = templateNode;
      templateNode.children.splice(insertAt + i, 0, clone);

      // The template's marker must not survive onto a real instance.
      deleteAttribute(clone, 'jr:template');
      copyAttributes(clone, xmlInstance);
      hydrateNode(clone, xmlInstance, `${childPath}[${i + 1}]`);
    }
  }

  // --- Drift detection (ADR-E): every XML element child must be known ---
  const xmlChildren = childElementsByLocalName(xmlEl, '*');
  for (const el of xmlChildren) {
    const name = el.localName ?? '';
    if (!definedNames.has(name)) {
      throw new HydrationError(
        `unknown node in submission XML not present in form definition: ${path}/${name}`,
      );
    }
  }
}
