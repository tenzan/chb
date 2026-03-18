import en from "./en.json";
import ru from "./ru.json";

export type Locale = "en" | "ru";

const translations: Record<Locale, Record<string, any>> = { en, ru };

export function getLocale(cookieValue?: string | null): Locale {
  return cookieValue === "ru" ? "ru" : "en";
}

export function t(
  locale: Locale,
  key: string,
  params?: Record<string, string>
): string {
  let value: any = translations[locale];
  for (const part of key.split(".")) {
    value = value?.[part];
  }

  // Fallback to English
  if (value === undefined && locale !== "en") {
    value = translations.en;
    for (const part of key.split(".")) {
      value = value?.[part];
    }
  }

  // Fallback to key
  if (typeof value !== "string") return key;

  if (params) {
    return value.replace(
      /\{(\w+)\}/g,
      (_: string, k: string) => params[k] ?? `{${k}}`
    );
  }
  return value;
}

export function getAllTranslations(locale: Locale): Record<string, any> {
  return translations[locale];
}
