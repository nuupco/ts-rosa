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
