// Server-safe entry point for i18n
import { Locale } from "./types";
import { getI18n } from "./engine";

/**
 * getTranslations - Server Component helper.
 * Usage: const { t } = getTranslations(locale);
 */
export function getTranslations(locale: Locale = "sv") {
  return getI18n(locale);
}

export { getI18n };
export type { Locale, TranslationPath } from "./types";
