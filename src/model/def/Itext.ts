/**
 * Itext types — ts-rosa-native itext / localizer model.
 *
 * Mirrors JavaRosa Localizer semantics without adapting the vendored
 * XFormsItextTranslations class (which is bound to XFormsXPathEvaluator and
 * creates circular imports).
 *
 * Slice 5a wires up `makeItextResolver`; the PREREQ slice only needs
 * `ItextResolver` as a type so `InstanceDocumentNode` can carry it.
 */

export type ItextLanguage = string;
export type ItextId = string;
/** form attribute on <value form="..."> (e.g. 'long','short','image','guidance'). */
export type ItextForm = string;

export interface ItextValue {
  readonly form: ItextForm | null; // null = default / long form
  readonly text: string;
}

/** Per-language map: itext id → its <value> entries (one per form). */
export type ItextTranslation = ReadonlyMap<ItextId, readonly ItextValue[]>;

export interface ItextTranslations {
  readonly languages: readonly ItextLanguage[];
  readonly explicitDefaultLanguage: ItextLanguage | null;
  /** language → (id → values) */
  readonly byLanguage: ReadonlyMap<ItextLanguage, ItextTranslation>;
}

/**
 * Runtime resolver with mutable active language. Mirrors JavaRosa Localizer.
 *
 * Implemented in Slice 5a by makeItextResolver(); the type lives here so the
 * PREREQ slice and InstanceDocumentNode can reference it without depending on
 * the full implementation.
 */
export interface ItextResolver {
  getLanguages(): readonly ItextLanguage[];
  getActiveLanguage(): ItextLanguage | null;
  /** null → reset to explicitDefaultLanguage ?? languages[0]. Returns the effective active language. */
  setActiveLanguage(lang: ItextLanguage | null): ItextLanguage | null;
  /** Resolve active-language value for id + optional form; returns null when id absent in all languages. */
  resolve(id: ItextId, form?: ItextForm): string | null;
}

/**
 * Create a runtime ItextResolver from parsed ItextTranslations.
 *
 * Localizer fallback semantics (mirrors JavaRosa Localizer):
 * 1. `resolve(id)` looks in the active language first.
 * 2. If the id is absent in the active language, falls back to the first
 *    language in `languages` order that contains the id.
 * 3. Returns null when the id is absent in ALL languages.
 * 4. `setActiveLanguage(null)` resets to `explicitDefaultLanguage ?? languages[0]`.
 * 5. `setActiveLanguage(unknown)` throws — JavaRosa REQ-5A-4.
 */
export function makeItextResolver(t: ItextTranslations): ItextResolver {
  // Mutable active language cursor
  let activeLanguage: ItextLanguage | null =
    t.explicitDefaultLanguage ?? t.languages[0] ?? null;

  function resolveValue(
    translation: ItextTranslation | undefined,
    id: ItextId,
    form?: ItextForm,
  ): string | null {
    if (translation === undefined) return null;
    const values = translation.get(id);
    if (values === undefined || values.length === 0) return null;

    // Requested form match
    if (form !== undefined) {
      const match = values.find((v) => v.form === form);
      if (match !== undefined) return match.text;
    }

    // Default/null form fallback
    const defaultMatch = values.find((v) => v.form === null);
    if (defaultMatch !== undefined) return defaultMatch.text;

    // First available value
    return values[0]?.text ?? null;
  }

  return {
    getLanguages(): readonly ItextLanguage[] {
      return t.languages;
    },

    getActiveLanguage(): ItextLanguage | null {
      return activeLanguage;
    },

    setActiveLanguage(lang: ItextLanguage | null): ItextLanguage | null {
      if (lang === null) {
        activeLanguage = t.explicitDefaultLanguage ?? t.languages[0] ?? null;
        return activeLanguage;
      }
      if (!t.languages.includes(lang)) {
        throw new Error(
          `Language "${lang}" is not available. Available languages: ${t.languages.join(', ')}`,
        );
      }
      activeLanguage = lang;
      return activeLanguage;
    },

    resolve(id: ItextId, form?: ItextForm): string | null {
      // 1. Try active language
      if (activeLanguage !== null) {
        const activeTrans = t.byLanguage.get(activeLanguage);
        const result = resolveValue(activeTrans, id, form);
        if (result !== null) return result;
      }

      // 2. Fallback: first language in declaration order that has the id
      for (const lang of t.languages) {
        if (lang === activeLanguage) continue; // already tried
        const trans = t.byLanguage.get(lang);
        const result = resolveValue(trans, id, form);
        if (result !== null) return result;
      }

      return null;
    },
  };
}
