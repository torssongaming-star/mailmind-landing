import { sv } from "./dictionaries/sv";
import { en } from "./dictionaries/en";
import { Locale, TranslationPath } from "./types";

const dictionaries: Record<Locale, any> = { sv, en };

export function getI18n(locale: Locale = "sv") {
  const dict = dictionaries[locale] || dictionaries.sv;

  const t = (path: TranslationPath, variables?: Record<string, string>): string => {
    const keys = (path as string).split(".");
    let value = dict;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return path; // Fallback to key
      }
    }

    if (typeof value !== "string") {
      return path;
    }

    if (variables) {
      return Object.entries(variables).reduce(
        (acc, [key, val]) => acc.replace(new RegExp(`{{${key}}}`, "g"), val),
        value
      );
    }

    return value;
  };

  const getRaw = (path: string): any => {
    const keys = path.split(".");
    let value = dict;
    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  };

  return { t, getRaw, locale };
}
