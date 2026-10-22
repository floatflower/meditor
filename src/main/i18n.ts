import { createI18n, type Lang } from '../shared/i18n'

/** Menus and dialogs live in the main process, so it has its own instance (the window has another). */
const instance = createI18n('en')

export const t = (key: string, options?: Record<string, unknown>): string => instance.t(key, options) as string

export const setMainLanguage = (lang: Lang): void => {
  void instance.changeLanguage(lang)
}
