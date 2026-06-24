/**
 * itextParser — parses the <itext> block inside <model> into ItextTranslations.
 *
 * Structure expected:
 *   <itext>
 *     <translation lang="en" [default="true()"]>
 *       <text id="some.id">
 *         <value [form="long"]>...</value>
 *         <value form="short">...</value>
 *       </text>
 *     </translation>
 *   </itext>
 *
 * Returns null when no <itext> element is present (form has no i18n).
 */

import type { ItextTranslations, ItextTranslation, ItextValue, ItextLanguage, ItextId } from '../model/def/Itext.ts';
import { childElementsByLocalName, firstByLocalName, textContent } from './domHelpers.ts';

/**
 * Parse the <itext> child of a <model> element.
 *
 * @param modelEl - The <model> DOM element. May be null.
 * @returns Parsed ItextTranslations, or null when no <itext> present.
 */
export function parseItext(modelEl: Element | null): ItextTranslations | null {
  if (modelEl === null) return null;

  const itextEl = firstByLocalName(modelEl, 'itext');
  if (itextEl === null) return null;

  const languages: ItextLanguage[] = [];
  let explicitDefaultLanguage: ItextLanguage | null = null;
  const byLanguage = new Map<ItextLanguage, ItextTranslation>();

  const translationEls = childElementsByLocalName(itextEl, 'translation');
  for (const transEl of translationEls) {
    const lang = transEl.getAttribute('lang');
    if (lang === null || lang === '') continue; // skip malformed translations

    languages.push(lang);

    // default="true()" or default="true" or just default="" marks the explicit default
    const defaultAttr = transEl.getAttribute('default');
    if (defaultAttr !== null && defaultAttr !== 'false()' && defaultAttr !== 'false') {
      explicitDefaultLanguage = lang;
    }

    const translation = new Map<ItextId, readonly ItextValue[]>();
    const textEls = childElementsByLocalName(transEl, 'text');

    for (const textEl of textEls) {
      const id = textEl.getAttribute('id');
      if (id === null || id === '') continue;

      const valueEls = childElementsByLocalName(textEl, 'value');
      const values: ItextValue[] = [];

      if (valueEls.length === 0) {
        // No <value> children — treat the text content of <text> itself as default value
        const text = textContent(textEl);
        if (text !== null) {
          values.push({ form: null, text });
        }
      } else {
        for (const valueEl of valueEls) {
          const form = valueEl.getAttribute('form') ?? null; // null = default/long form
          const text = textContent(valueEl) ?? '';
          values.push({ form, text });
        }
      }

      if (values.length > 0) {
        translation.set(id, Object.freeze(values));
      }
    }

    byLanguage.set(lang, translation);
  }

  if (languages.length === 0) return null;

  return Object.freeze({
    languages: Object.freeze(languages),
    explicitDefaultLanguage,
    byLanguage,
  });
}
