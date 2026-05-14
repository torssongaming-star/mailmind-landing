"use client";

import React, { createContext, useContext, ReactNode, useMemo } from "react";
import { Locale, TranslationPath } from "./types";
import { getI18n } from "./index";

type I18nContextType = {
  t: (path: TranslationPath, variables?: Record<string, string>) => string;
  locale: Locale;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({
  children,
  locale = "sv",
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const i18n = useMemo(() => getI18n(locale), [locale]);

  return (
    <I18nContext.Provider value={i18n}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback to default Swedish if used outside provider (though not recommended)
    return getI18n("sv");
  }
  return context;
}
