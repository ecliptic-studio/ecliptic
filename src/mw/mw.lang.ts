import type { TLang } from "@public/i18n/t"

export function resolveLang(headers: Headers) {
  const lang = headers.get('ecliptic-locale') ?? 'en'
  return lang as TLang
}