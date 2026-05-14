import { sv } from "./locales/sv";
import { en } from "./locales/en";
import { Locale, TranslationPath } from "./types";

const locales = { sv, en };

/**
 * Basic translation function that supports nested keys and variable replacement.
 * Fallback to Swedish if key is missing in the requested locale.
 */
export function getI18n(locale: Locale = "sv") {
  const translations = locales[locale] || sv;

  return {
    t: (path: TranslationPath, variables?: Record<string, string>): string => {
      const keys = path.split(".");
      let value: unknown = translations;
      let fallbackValue: unknown = sv;

      // Resolve path in current locale
      for (const key of keys) {
        value = (value as Record<string, unknown>)?.[key];
      }

      // Fallback to Swedish if missing
      if (value === undefined) {
        for (const key of keys) {
          fallbackValue = (fallbackValue as Record<string, unknown>)?.[key];
        }
        value = fallbackValue;
      }


      if (typeof value !== "string") {
        return path; // Return path if not found or not a string
      }

      // Replace variables {key}
      if (variables) {
        return Object.entries(variables).reduce(
          (acc, [key, val]) => acc.replace(new RegExp(`{${key}}`, "g"), val),
          value
        );
      }

      return value;
    },
    /**
     * Returns the raw value (array, object, etc) for a given path.
     */
    getRaw: (path: string): any => {
      const keys = path.split(".");
      let value: unknown = translations;

      for (const key of keys) {
        value = (value as Record<string, unknown>)?.[key];
      }

      if (value === undefined && locale !== "sv") {
        let fallbackValue: unknown = sv;
        for (const key of keys) {
          fallbackValue = (fallbackValue as Record<string, unknown>)?.[key];
        }
        value = fallbackValue;
      }

      return value;
    },
    locale,
  };
}

/**
 * Server-side helper to get translations based on a cookie or header.
 * In Next.js App Router, you'd typically call this in a Layout or Page.
 */
export function getTranslations(locale: Locale = "sv") {
  return getI18n(locale);
}

// Re-exports
export type { Locale, TranslationPath } from "./types";
