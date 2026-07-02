/**
 * resolveExternalInstances — async hydration step for `jr://` external
 * secondary instances (design §6, spec R4).
 *
 * Fetches raw content for each declared `FormDefinition.externalInstances`
 * entry via the registered `ExternalInstanceResolver` and dispatches on the
 * declared `src`:
 *   - `jr://instance/last-saved` (spec: last-saved instance) is parsed as
 *     XML using the same inline-secondary-instance tree-building machinery
 *     (`buildInstanceNode` + `applyBindings`), with relaxed/tolerant schema
 *     drift handling. A `null` resolver result (no prior submission) yields
 *     an empty-root tree rather than an error (ADR-3).
 *   - Any other `src` keeps the existing CSV resolution path, unchanged.
 *
 * `parseForm` stays synchronous/pure; this step is the only place I/O
 * happens.
 *
 * Fail-loud (spec R5): a rejecting resolver, a `null` CSV result, malformed
 * CSV, or malformed last-saved XML all throw with an operation-prefixed
 * message identifying the offending instance id/src. An unregistered
 * resolver seam propagates its own error unchanged.
 */

import type { FormDefinition } from '../model/def/FormDefinition.ts';
import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import { getExternalInstanceResolver } from '../platform/ExternalInstanceResolver.ts';
import { getXmlParser } from '../platform/XmlParser.ts';
import { csvToInstanceTree } from './csv/csvToInstanceTree.ts';
import { buildInstanceNode, applyBindings } from './XFormParser.ts';
import { newNode } from '../model/instance/InstanceNode.ts';

/** ODK's reserved URI for the last-saved-submission secondary instance. */
const LAST_SAVED_SRC = 'jr://instance/last-saved';

export async function resolveExternalInstances(definition: FormDefinition): Promise<FormDefinition> {
  if (definition.externalInstances.size === 0) {
    return definition;
  }

  const resolver = getExternalInstanceResolver();
  const merged = new Map<string, InstanceTree>(definition.secondaryInstances);

  for (const [id, { src }] of definition.externalInstances) {
    let raw: string | null;
    try {
      raw = await resolver.resolve(src);
    } catch (cause) {
      throw new Error(
        `resolveExternalInstances: failed to resolve external instance '${id}' (${src}): ${String(cause)}`,
      );
    }

    if (src === LAST_SAVED_SRC) {
      merged.set(id, buildLastSavedTree(id, src, raw, definition));
      continue;
    }

    // CSV path (unchanged behavior): a null result is a failure — CSV
    // externals never legitimately have "no content" (ADR-1).
    if (raw === null) {
      throw new Error(
        `resolveExternalInstances: external instance '${id}' (${src}) has malformed CSV: resolver returned null`,
      );
    }

    let tree: InstanceTree;
    try {
      tree = csvToInstanceTree(id, raw);
    } catch (cause) {
      throw new Error(
        `resolveExternalInstances: external instance '${id}' (${src}) has malformed CSV: ${String(cause)}`,
      );
    }

    merged.set(id, tree);
  }

  return { ...definition, secondaryInstances: merged };
}

/**
 * Build the secondary InstanceTree for `jr://instance/last-saved` (ADR-2,
 * ADR-3). `raw === null` means "no prior submission" and yields an
 * empty-root tree, named after the form's own primary instance root
 * (ADR-3), rather than an error. A non-null `raw` is parsed as XML using the
 * same relaxed, best-effort tree-building machinery as inline secondary
 * instances — NOT InstanceHydrator's strict-walk machinery — so schema
 * drift between the prior submission and the current form is tolerated
 * silently.
 */
function buildLastSavedTree(
  id: string,
  src: string,
  raw: string | null,
  definition: FormDefinition,
): InstanceTree {
  if (raw === null) {
    const tree: InstanceTree = { root: newNode(definition.mainInstance.root.name), name: id };
    applyBindings(tree, new Map());
    return tree;
  }

  let documentElement: Element | null;
  try {
    documentElement = getXmlParser().parse(raw).documentElement;
  } catch (cause) {
    throw new Error(
      `resolveExternalInstances: external instance '${id}' (${src}) has malformed last-saved XML: ${String(cause)}`,
    );
  }

  if (documentElement === null || documentElement === undefined) {
    throw new Error(
      `resolveExternalInstances: external instance '${id}' (${src}) has malformed last-saved XML: no root element`,
    );
  }

  const tree: InstanceTree = { root: buildInstanceNode(documentElement), name: id };
  applyBindings(tree, new Map());
  return tree;
}
