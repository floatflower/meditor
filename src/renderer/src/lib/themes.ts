import defaultCss from '../styles/theme-default.css?raw'

export interface Theme {
  name: string
  css: string
  builtin?: boolean
}

export const builtinThemes: Theme[] = [
  { name: 'Default', css: defaultCss, builtin: true }
]
