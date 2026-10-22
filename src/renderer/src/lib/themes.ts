import defaultCss from '../styles/theme-default.css?raw'
import darkCss from '../styles/theme-dark.css?raw'

export interface Theme {
  name: string
  css: string
  builtin?: boolean
}

export const builtinThemes: Theme[] = [
  { name: 'Default', css: defaultCss, builtin: true },
  { name: 'Dark', css: darkCss, builtin: true }
]
