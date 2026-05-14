import { Translations } from "./locales/sv";

export type Locale = "sv" | "en";

export type TranslationKey = keyof Translations;

// Helper to get nested keys (optional, but good for typed t() function)
export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationPath = NestedKeyOf<Translations>;
