/**
 * XFormParser — 4-step pure pipeline for XForms parsing.
 *
 * Step 1: Walk <instance> DOM → build InstanceTree
 * Step 2: Parse <bind> elements → build DataBinding map (XPATH FIREWALL)
 * Step 3: Parse <body> children → build FormElement tree
 * Step 4: applyBindings (second pure pass) → set dataType + cast values on InstanceNodes
 */

import type { FormDefinition } from '../model/def/FormDefinition.ts';
import type { InstanceNode } from '../model/instance/InstanceNode.ts';
import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import type { DataBinding } from '../model/def/DataBinding.ts';
import type { FormElement } from '../model/def/FormElement.ts';
import { newNode, getAttribute, setAttribute, deleteAttribute } from '../model/instance/InstanceNode.ts';
import { resolveReference } from '../model/instance/InstanceTree.ts';
import { INDEX_TEMPLATE } from '../model/instance/multiplicity.ts';
import { cast } from '../model/data/codecs.ts';
import { getXmlParser } from '../platform/XmlParser.ts';
import { bindProcessor, compileBindings } from './bindProcessor.ts';
import { finalizeDag, addTriggerable } from '../eval/TriggerableDag.ts';
import { makeRecalculate, makeCondition, type Triggerable } from '../eval/Triggerable.ts';
import { genericize, refToString } from '../model/instance/TreeReference.ts';
import type { TriggerableDag } from '../eval/TriggerableDag.ts';
import type { CompiledBinding } from './bindProcessor.ts';
import { bodyHandlers, buildFormElements } from './handlers.ts';
import { childElementsByLocalName, firstByLocalName, directTextContent, textContent } from './domHelpers.ts';
import { parseItext } from './itextParser.ts';
import { collectModelActions, collectBodyActions } from './actionParser.ts';
import type { SetValueAction } from '../eval/SetValueAction.ts';

// ---------------------------------------------------------------------------
// Step 1: Build InstanceTree from <instance> element
// ---------------------------------------------------------------------------

/** Internal: raw text holder before applyBindings casts it */
const RAW_TEXT_ATTR = '__rawText';

export function buildInstanceNode(el: Element): InstanceNode {
  const node = newNode(el.localName ?? el.nodeName);

  // Copy non-namespace attributes
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr && !attr.name.startsWith('xmlns')) {
      setAttribute(node, attr.name, attr.value);
    }
  }

  // Check if this is a repeat template.
  // Only elements with jr:template="" attribute are templates. Elements named
  // "repeat" in instance data are NOT automatically templates — they are live
  // data instances. (A form may use any element name for a repeat group.)
  const isTemplate = el.getAttribute('jr:template') !== null;
  if (isTemplate) {
    node.multiplicity = INDEX_TEMPLATE;
  }

  // Walk child nodes.
  //
  // Multiplicity is assigned directly instead of via appendChild(): appendChild
  // recomputes it by scanning ALL of the parent's existing same-name children
  // on every call, which is O(n) per child and O(n²) overall for n children —
  // catastrophic for a large inline secondary instance (e.g. a lookup table
  // pasted directly into the XForm's <instance> block instead of referenced
  // via jr://file-csv). A running per-name counter reproduces the exact same
  // count appendChild would have computed (including template children,
  // which count toward the total but never receive a computed multiplicity
  // themselves) without the rescan.
  let hasElementChildren = false;
  const sameNameCounts = new Map<string, number>();
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    if (child.nodeType === 1 /* ELEMENT_NODE */) {
      hasElementChildren = true;
      const childNode = buildInstanceNode(child as Element);
      const sameNameCount = sameNameCounts.get(childNode.name) ?? 0;
      if (childNode.multiplicity !== INDEX_TEMPLATE) {
        childNode.multiplicity = sameNameCount;
      }
      sameNameCounts.set(childNode.name, sameNameCount + 1);
      childNode.parent = node;
      node.children.push(childNode);
    }
  }

  // Leaf node: capture raw text for later casting in applyBindings
  if (!hasElementChildren) {
    const raw = directTextContent(el);
    if (raw !== null) {
      // Store raw text in attributes map for retrieval in applyBindings
      setAttribute(node, RAW_TEXT_ATTR, raw);
    }
  }

  return node;
}

function buildInstanceTree(instanceEl: Element): InstanceTree {
  // The instance element may wrap the actual data root element
  const childEls = childElementsByLocalName(instanceEl, '*');
  if (childEls.length === 0) {
    // Empty instance: create a placeholder root
    return { root: newNode('instance'), name: null };
  }
  const dataRoot = childEls[0]!;
  const root = buildInstanceNode(dataRoot);
  const instanceId = instanceEl.getAttribute('id') ?? null;
  return { root, name: instanceId };
}

// ---------------------------------------------------------------------------
// Step 4: Apply bindings (second pure pass)
// ---------------------------------------------------------------------------

function applyBindingsToNode(node: InstanceNode, bindings: ReadonlyMap<string, DataBinding>, path: string): void {
  const currentPath = `${path}/${node.name}`;

  // Find binding by nodeset path
  const binding = bindings.get(currentPath);
  if (binding) {
    node.dataType = binding.dataType;
    // Stamp preload metadata onto the node (Phase 7, Slice 7-INFRA-A — T-INFRA-A-6)
    node.preload = binding.preload;
    node.preloadParams = binding.preloadParams;
    // Cast raw text to typed AnswerValue
    const rawText = getAttribute(node, RAW_TEXT_ATTR);
    if (rawText !== undefined) {
      node.value = cast(binding.dataType, rawText) ?? null;
      deleteAttribute(node, RAW_TEXT_ATTR);
    }
  } else {
    // Clean up raw text attribute for unbound nodes — keep as string AnswerValue
    const rawText = getAttribute(node, RAW_TEXT_ATTR);
    if (rawText !== undefined) {
      node.value = cast('string', rawText) ?? null;
      deleteAttribute(node, RAW_TEXT_ATTR);
    }
  }

  // Recurse into children
  for (const child of node.children) {
    applyBindingsToNode(child, bindings, currentPath);
  }
}

/**
 * Applies bindings to a tree and casts raw text leaves to typed AnswerValues.
 *
 * Exported for reuse by other tree builders (e.g. csvToInstanceTree) that need
 * the exact same string-cast normalization pass that inline secondary
 * instances get, without duplicating the casting logic.
 */
export function applyBindings(tree: InstanceTree, bindings: ReadonlyMap<string, DataBinding>): void {
  // The root path segment is the root node's name
  applyBindingsToNode(tree.root, bindings, '');
}

/**
 * Attribute key used to stash a leaf's raw text before applyBindings casts it.
 * Exported so other tree builders (e.g. csvToInstanceTree) can produce trees
 * that applyBindings knows how to normalize.
 */
export { RAW_TEXT_ATTR };

// ---------------------------------------------------------------------------
// Step 3: Build body FormElements
// ---------------------------------------------------------------------------

function buildBody(bodyEl: Element, bindings: ReadonlyMap<string, DataBinding>): readonly FormElement[] {
  const ctx = { bindings };
  return buildFormElements(bodyEl, ctx);
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

function extractTitle(doc: Document): string | null {
  // Look for h:title or title under h:head/head
  const headEl =
    firstDocumentElementByLocalName(doc, 'head') ??
    firstDocumentElementByLocalName(doc, 'html')
      ? findByLocalNameDeep(doc.documentElement!, 'head')
      : null;

  if (!headEl) return null;
  const titleEl = firstByLocalName(headEl, 'title');
  return titleEl ? textContent(titleEl) : null;
}

function firstDocumentElementByLocalName(doc: Document, localName: string): Element | null {
  const root = doc.documentElement;
  if (!root) return null;
  if (root.localName === localName) return root;
  return firstByLocalName(root, localName);
}

function findByLocalNameDeep(el: Element, localName: string): Element | null {
  if (el.localName === localName) return el;
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1) {
      const found = findByLocalNameDeep(child as Element, localName);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step 2b: Build reactive DAG from compiled bindings
// ---------------------------------------------------------------------------

/**
 * Builds the TriggerableDag from compiled bindings.
 *
 * 1. Runs compileBindings to get CompiledBindings per nodeset.
 * 2. For each non-constraint CompiledBinding, creates a Triggerable and adds
 *    it via addTriggerable (dedup via context intersection).
 * 3. Calls finalizeDag (Kahn topo sort + cycle detection).
 *
 * Throws /Cycle detected/i if a cycle is found — this propagates through
 * Scenario.init() → parseForm() → parseDocument() → here.
 *
 * Constraint bindings are explicitly excluded from allTriggerables (they are
 * validation-only, not cascade sources). A constraint self-ref does NOT create
 * a cycle edge by this design.
 */
function buildReactiveDag(
  bindEls: Element[],
  tree: InstanceTree,
): { dag: TriggerableDag; constraintBindings: Map<string, CompiledBinding> } {
  const allTriggerables = new Set<Triggerable>();
  const triggerablesPerTrigger = new Map<string, Set<Triggerable>>();
  const constraintBindings = new Map<string, CompiledBinding>();

  const processedBindings = compileBindings(bindEls);

  for (const processed of processedBindings.values()) {
    for (const cb of processed.compiledBindings) {
      // Constraints are NOT cascade sources — store separately, exclude from DAG
      if (cb.kind === 'condition' && cb.action === 'constraint') {
        // Key by nodeset (first target ref string)
        if (cb.targets.length > 0) {
          const key = processed.nodeset;
          constraintBindings.set(key, cb);
        }
        continue;
      }

      let triggerable: Triggerable;
      if (cb.kind === 'recalculate') {
        triggerable = makeRecalculate(
          cb.expr,
          cb.targets,
          cb.triggers,
          cb.contextRef,
          cb.originalContextRef,
        );
      } else {
        // cb.action is ConditionKind here (not 'constraint')
        triggerable = makeCondition(
          cb.expr,
          cb.targets,
          cb.triggers,
          cb.contextRef,
          cb.originalContextRef,
          cb.action as import('../eval/Triggerable.ts').ConditionKind,
        );
      }

      addTriggerable(triggerable, allTriggerables, triggerablesPerTrigger);
    }
  }

  // finalizeDag throws on cycle detection (Slice 3.3 requirement)
  const dag = finalizeDag(allTriggerables, triggerablesPerTrigger, tree);
  return { dag, constraintBindings };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * parseDocument — seam-free. Accepts a pre-parsed W3C Document.
 * All 4 pipeline steps run here.
 */
export function parseDocument(doc: Document): FormDefinition {
  const root = doc.documentElement;
  if (!root) {
    return { title: null, mainInstance: { root: newNode('data'), name: null }, bindings: new Map(), body: [], dag: null, constraintBindings: new Map(), itext: null, secondaryInstances: new Map(), externalInstances: new Map(), actions: [] };
  }

  // Find model (under h:head/head)
  const headEl = findByLocalNameDeep(root, 'head');
  const modelEl = headEl ? findByLocalNameDeep(headEl, 'model') : null;

  // Step 1: Find primary <instance> (first without id) + collect secondary instances
  const instanceEls = modelEl
    ? (childElementsByLocalName(modelEl, 'instance') as Element[])
    : [];
  // Main instance: first <instance> without an id attribute (fallback: first overall)
  const mainInstanceEl =
    instanceEls.find((e) => !e.hasAttribute('id')) ?? instanceEls[0] ?? null;
  const mainInstance: InstanceTree = mainInstanceEl
    ? buildInstanceTree(mainInstanceEl)
    : { root: newNode('data'), name: null };

  // Secondary instances: all id-bearing <instance id="..."> elements.
  // Apply string-value conversion (empty bindings → all nodes become 'string' AnswerValue).
  //
  // An id-bearing instance with a non-empty `src` attribute is an EXTERNAL
  // reference (e.g. `jr://file-csv/cities.csv`) — parsing is pure/sync and
  // MUST NOT fetch content, so it is recorded as an unresolved {id, src}
  // marker in `externalInstances` instead of being built into
  // `secondaryInstances`. If `src` is present, it wins over any inline
  // children (matches JavaRosa); inline children are ignored in that case.
  const secondaryInstances = new Map<string, InstanceTree>();
  const externalInstances = new Map<string, { src: string }>();
  for (const el of instanceEls) {
    const id = el.getAttribute('id');
    if (id === null || id === '') {
      continue;
    }
    const src = el.getAttribute('src');
    if (src !== null && src !== '') {
      externalInstances.set(id, { src });
      continue;
    }
    const secTree = buildInstanceTree(el);
    applyBindings(secTree, new Map());
    secondaryInstances.set(id, secTree);
  }

  // Step 2: bindProcessor — find all <bind> children of model
  const bindEls = modelEl
    ? (childElementsByLocalName(modelEl, 'bind') as Element[])
    : [];
  const bindings = bindProcessor(bindEls);

  // Step 2b: compileBindings — compile expressions + extract triggers (Phase 3)
  // Then finalizeDag — throws on cycle detection (Slice 3.3)
  const { dag, constraintBindings } = buildReactiveDag(bindEls, mainInstance);

  // Step 3: Find body (h:body or body)
  const bodyEl = findByLocalNameDeep(root, 'body');
  const body: readonly FormElement[] = bodyEl ? buildBody(bodyEl, bindings) : [];

  // Step 4: applyBindings — second pure pass
  applyBindings(mainInstance, bindings);

  // Title
  const title = extractTitle(doc);

  // Step 5: Parse itext translations (slice 5a)
  const itext = parseItext(modelEl);

  // Step 6: Collect setvalue actions (model-level + body-nested).
  // Parsing/storage only — NOT wired into the DAG (see actionParser.ts).
  const actions: readonly SetValueAction[] = [
    ...collectModelActions(modelEl),
    ...collectBodyActions(bodyEl),
  ];

  return { title, mainInstance, bindings, body, dag, constraintBindings, itext, secondaryInstances, externalInstances, actions };
}

/**
 * parseForm — entry point that uses the registered XmlParser seam.
 */
export function parseForm(xml: string): FormDefinition {
  const doc = getXmlParser().parse(xml);
  return parseDocument(doc);
}
