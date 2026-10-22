import { createInstance, type i18n as I18n, type Module, type Resource } from 'i18next'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'
import ja from './locales/ja.json'

/** Languages the app ships. English is the fallback for everything else. */
export const LANGUAGES = ['en', 'zh-TW', 'zh-CN', 'ja'] as const
export type Lang = (typeof LANGUAGES)[number]

/** What the user picks in Settings: a language, or "follow the computer". */
export type LanguageSetting = 'system' | Lang

export const FALLBACK_LANGUAGE: Lang = 'en'

/** Each language written in itself, so it can be found whatever the current language is. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  ja: '日本語'
}

export const resources: Resource = {
  en: { translation: en },
  'zh-TW': { translation: zhTW },
  'zh-CN': { translation: zhCN },
  ja: { translation: ja }
}

export const isLanguageSetting = (value: unknown): value is LanguageSetting =>
  value === 'system' || (LANGUAGES as readonly string[]).includes(value as string)

/** Map one BCP-47 tag (`zh-Hant-TW`, `ja_JP`, `en-GB`…) to a supported language, or null. */
export function matchLanguage(tag: string): Lang | null {
  const t = tag.toLowerCase().replace(/_/g, '-')
  if (t === 'zh' || t.startsWith('zh-')) {
    // Traditional script or a Traditional-writing region; bare `zh` and everything else is Simplified.
    return /(^|-)hant(-|$)|-(tw|hk|mo)(-|$)/.test(t) ? 'zh-TW' : 'zh-CN'
  }
  if (t === 'ja' || t.startsWith('ja-')) return 'ja'
  if (t === 'en' || t.startsWith('en-')) return 'en'
  return null
}

/** The first of the computer's preferred languages that we support, otherwise English. */
export function resolveSystemLanguage(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const match = matchLanguage(tag)
    if (match) return match
  }
  return FALLBACK_LANGUAGE
}

export const resolveLanguage = (setting: LanguageSetting, preferred: readonly string[]): Lang =>
  setting === 'system' ? resolveSystemLanguage(preferred) : setting

/** A ready-to-use instance. Resources are inline, so it is usable immediately. */
export function createI18n(lng: Lang, options: { modules?: Module[]; resources?: Resource } = {}): I18n {
  const instance = createInstance()
  for (const module of options.modules ?? []) instance.use(module)
  void instance.init({
    resources: options.resources ?? resources,
    lng,
    fallbackLng: FALLBACK_LANGUAGE,
    initAsync: false,
    interpolation: { escapeValue: false } // React escapes already; menus and dialogs show plain text
  })
  return instance
}
