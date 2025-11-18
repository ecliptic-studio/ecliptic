export type TLang = "en" | "de" | "fr" | "es" | "it" | "pt" | "ru" | "zh" | "ja" | "ko" | "ar" | "hi" | "bn" | "id" | "ms" | "th" | "vi" | "tr" | "nl" | "pl" | "uk" | "cs" | "hu" | "ro" | "sv" | "da" | "fi" | "no" | "el" | "he" | "fa";

export const defaultErrorMap: Partial<Record<TLang, string>> & { en: string } = {
  en: "Unknown error",
  de: "Unbekannter Fehler",
};

// Simple function to replace {param} with values
export function replaceParams(text: string, params: Record<string, any>): string {
  return text.replace(/{(\w+)}/g, (_, key) => {
    return params[key]?.toString() ?? `{${key}}`;
  });
}

/**
 * Map of translations contains all translations in every language.
 * Only needs subset of languages + english fallback.
 * e.g. map = {
 *   en: "Not found {id}",
 *   de: "Nicht gefunden {id}",
 * }
 */
export function t(lang: TLang, langMap: Partial<Record<TLang, string>> & { en: string } = defaultErrorMap, params: Record<string, any> = {}) {
  // Split key by dots (e.g., "home.faq.list")
  const result = langMap[lang] ?? langMap.en;

  if (typeof result === "string") {
    return replaceParams(result, params);
  }

  throw new Error(`No translation found`);
}
