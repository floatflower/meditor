export interface ThemeProbe {
  /** Requested custom properties that the theme actually sets (trimmed, empty ones omitted). */
  vars: Record<string, string>
  /** Resolved text colour and font of `.markdown-body` under this theme. */
  color: string
  fontFamily: string
}

/**
 * Let the browser resolve a theme's CSS on a throwaway `.markdown-body`, so canvas/SVG renderers
 * can follow the theme even though their host element is detached (as during export).
 */
export function probeTheme(themeCss: string, names: string[]): ThemeProbe {
  const style = document.createElement('style')
  style.textContent = themeCss
  const host = document.createElement('div')
  host.className = 'markdown-body'
  host.style.display = 'none'
  document.head.append(style)
  document.body.append(host)

  const computed = getComputedStyle(host)
  const vars: Record<string, string> = {}
  for (const name of names) {
    const value = computed.getPropertyValue(name).trim()
    if (value) vars[name] = value
  }
  const probe = { vars, color: computed.color, fontFamily: computed.fontFamily }

  style.remove()
  host.remove()
  return probe
}
