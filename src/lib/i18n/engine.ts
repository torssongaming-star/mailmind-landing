import { sv } from "./locales/sv";
import { en } from "./locales/en";
import { Locale } from "./types";

type TranslationDictionary = Record<string, unknown>;

const dictionaries: Record<Locale, TranslationDictionary> = { sv, en };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getI18n(locale: Locale = "sv") {
  const dict = dictionaries[locale] || dictionaries.sv;

  const t = (path: string, variables?: Record<string, string>): string => {
    const keys = path.split(".");
    let value: unknown = dict;

    for (const key of keys) {
      if (isRecord(value) && key in value) {
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
        (acc, [key, val]) => acc.replace(new RegExp(`\\{+${key}\\}+`, "g"), () => String(val ?? "")),
        value
      );
    }

    return value;
  };

  const getRaw = (path: string): unknown => {
    const keys = path.split(".");
    let value: unknown = dict;
    for (const key of keys) {
      if (isRecord(value) && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  };

  return { t, getRaw, locale };
}
