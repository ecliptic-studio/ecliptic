import { type TLang } from "./t";

export function getLangFx(): TLang {
  // Try get from cookie
  const cookieLang = document.cookie
    .split('; ')
    .find(row => row.startsWith('ecliptic-locale='))
    ?.split('=')[1];
    
  if (cookieLang === 'en' || cookieLang === 'de') {
    return cookieLang;
  }

  // Get system language
  const systemLang = navigator.language.split('-')[0];
  const lang = systemLang === 'de' ? 'de' : 'en';
  
  // Save in cookie
  document.cookie = `ecliptic-locale=${lang}; path=/; max-age=31536000`; // 1 year
  
  return lang;
}

export function setLangFx(newLang: TLang): TLang {
  // Save in cookie
  document.cookie = `ecliptic-locale=${newLang}; path=/; max-age=31536000`; // 1 year
  return newLang;
}