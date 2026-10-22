import { initReactI18next } from 'react-i18next'
import { createI18n, type Lang } from '../../shared/i18n'

/** The window's own instance (the main process has another, for the menu and dialogs). */
export const i18n = createI18n('en', { modules: [initReactI18next] })

export async function setLanguage(lang: Lang): Promise<void> {
  await i18n.changeLanguage(lang)
  document.documentElement.lang = lang // lets the browser pick the right CJK glyphs
}
