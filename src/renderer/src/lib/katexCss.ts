import css from 'katex/dist/katex.min.css?raw'

// Every font as a data: URI, so the CSS works in the live preview, in exported HTML and in PDF
// without any file next to it.
const fonts = import.meta.glob<string>('../../../../node_modules/katex/dist/fonts/*.woff2', {
  query: '?inline',
  import: 'default',
  eager: true
})
const dataUris = Object.fromEntries(Object.entries(fonts).map(([path, uri]) => [path.split('/').pop()!, uri]))

export const katexCss: string = css
  // woff2 is enough for Chromium; drop the woff/ttf fallbacks to keep the file small.
  .replace(/,url\([^)]*\) format\("(?:woff|truetype)"\)/g, '')
  .replace(/url\(fonts\/([^)]+\.woff2)\)/g, (match, name: string) =>
    dataUris[name] ? `url(${dataUris[name]})` : match
  )

/** Whether rendered HTML contains KaTeX output (and therefore needs `katexCss`). */
export const usesMath = (html: string): boolean => html.includes('class="katex')
