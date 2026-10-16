/** UI language: chosen once at startup; switching reloads the page. */
export const LANGS = ["de", "en"] as const;
export type Lang = (typeof LANGS)[number];
export type Localized = Record<Lang, string>;

const STORAGE_KEY = "woodshed.lang";

function detect(): Lang {
  if (typeof window === "undefined") return "de"; // tests and build scripts
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "de" || saved === "en") return saved;
  } catch {
    /* storage unavailable: fall back to the browser language */
  }
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

export const lang: Lang = detect();

export function setLang(next: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage blocked: the switch can't be remembered, the reload keeps the browser language */
  }
  location.reload();
}

export const loc = (s: Localized): string => s[lang];
