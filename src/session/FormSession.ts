/**
 * FormSession — mutable run-state for a form evaluation session.
 *
 * Slice 3.1 skeleton + Slice 3.4 extension:
 *   - Carries FormDefinition (includes compiled DAG from Slice 3.3)
 *   - Creates FormEvaluator wired to the InstanceTree
 *   - Calls evaluator.initializeInstance(dag) to compute initial calculate values
 */

import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import type { FormDefinition } from '../model/def/FormDefinition.ts';
import { FormEvaluator } from './FormEvaluator.ts';
import { FormNavigator } from './FormNavigator.ts';
import { serializeInstance } from '../model/instance/InstanceSerializer.ts';
import type { PreloadProvider } from './PreloadProvider.ts';
import { defaultPreloadProvider } from './PreloadProvider.ts';
import { applyPreloads } from './preload/applyPreloads.ts';
import { hydrateInstance } from '../model/instance/InstanceHydrator.ts';

export interface FormSession {
  /** The full form definition (immutable defs + compiled bindings + DAG). */
  readonly definition: FormDefinition;
  /** The mutable instance data tree (Option A: sole data store, no parallel DOM). */
  readonly tree: InstanceTree;
  /** The evaluator wired to this session's InstanceTree. */
  readonly evaluator: FormEvaluator;
  /**
   * @experimental The form entry cursor engine (Phase 4).
   * Owns the mutable cursor and all navigation methods.
   */
  readonly navigator: FormNavigator;
  /**
   * Serialize the primary instance to ODK-submission XML.
   *
   * Applies JavaRosa-default filtering: omits non-relevant nodes and
   * INDEX_TEMPLATE nodes. Relevance is determined via FormEvaluator.isNodeRelevant,
   * which reuses the proven nodeToRef + isEffectivelyRelevant path (ADR-2).
   *
   * No XML declaration is emitted (mirrors JavaRosa XFormSerializingVisitor).
   *
   * Slice 6a — serialization-odk-functions
   */
  readonly serializeToXml: () => string;
}

/** Options for createFormSession (Phase 7, Slice 7-INFRA-A). */
export interface CreateFormSessionOpts {
  /** Injectable preload provider. Defaults to defaultPreloadProvider (live wall-clock). */
  preloadProvider?: PreloadProvider;
  /**
   * Previously-submitted ODK instance XML to hydrate the session from, for
   * editing an existing submission (sdd/instance-editing-hydration).
   *
   * Additive, opt-in: when absent, session creation is 100% unchanged from
   * the template-defaults path. When present, the session's working tree is
   * built via `hydrateInstance(definition, instanceXml)` instead of using
   * `definition.mainInstance` directly, and `applyPreloads` is skipped
   * (ADR-C) so original submission timestamps/uids are preserved. The DAG
   * cascade still runs unconditionally afterwards (calculate always wins
   * over loaded values, per design decision 1).
   */
  instanceXml?: string;
}

/**
 * Create a FormSession from a FormDefinition.
 *
 * Runs initializeInstance on the DAG so all calculate expressions are
 * evaluated in topological order before the first user interaction.
 *
 * Phase 7: applyPreloads runs BEFORE initializeInstance so preloaded
 * dates/uids are visible to calculate expressions (T-VAL-2 ordering).
 *
 * sdd/instance-editing-hydration: when `opts.instanceXml` is provided, the
 * working tree is hydrated from it instead of using `definition.mainInstance`
 * directly, and `applyPreloads` is skipped (ADR-C). When absent, behavior is
 * unchanged from before this change.
 */
export function createFormSession(
  definition: FormDefinition,
  opts?: CreateFormSessionOpts,
): FormSession {
  // Fail-loud guard (sdd/external-secondary-instances, spec R4): a declared
  // external instance must be hydrated via resolveExternalInstances(def)
  // before a session is created, or XPath consumers would silently see it
  // as absent. Forms with no externalInstances are unaffected (no-op loop).
  for (const id of definition.externalInstances.keys()) {
    if (!definition.secondaryInstances.has(id)) {
      throw new Error(
        `createFormSession: external instance '${id}' is declared but not resolved. ` +
          'Call resolveExternalInstances(definition) before createFormSession().',
      );
    }
  }

  const provider = opts?.preloadProvider ?? defaultPreloadProvider;

  const tree =
    opts?.instanceXml !== undefined
      ? hydrateInstance(definition, opts.instanceXml)
      : definition.mainInstance;

  const evaluator = new FormEvaluator(tree, {
    itext: definition.itext ?? null,
    secondaryInstances: definition.secondaryInstances,
    body: definition.body,
  });

  // Phase 7: apply preloads BEFORE cascade so calculates can reference them.
  // ADR-C: skipped on the hydration path so loaded preload values (e.g.
  // original submission timestamps/uids) are not clobbered.
  if (opts?.instanceXml === undefined) {
    applyPreloads(tree, provider);
  }

  // Slice 3.4: evaluate all Recalculates in DAG order (initial steady state)
  // Slice 3.6: also pass constraint bindings for validation
  // Runs unconditionally on both paths: calculate always wins over loaded
  // values when relevant (design decision 1) — no special-casing here.
  if (definition.dag !== null) {
    evaluator.initializeInstance(definition.dag, definition.constraintBindings);
  }

  const navigator = new FormNavigator(definition, tree, evaluator);

  return {
    definition,
    tree,
    evaluator,
    navigator,
    serializeToXml: () =>
      serializeInstance(tree, {
        isRelevant: (node) => evaluator.isNodeRelevant(node),
      }),
  };
}
