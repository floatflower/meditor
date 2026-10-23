import { inlineLocalImages } from './localImages'
import { pluginCss, renderMarkdown, runPostRender, type MdPlugin } from './markdown'
import previewCss from '../styles/preview.css?raw'

export function collectCss(themeCss: string, plugins: MdPlugin[], html: string): string {
  return [previewCss, pluginCss(plugins, html), themeCss].join('\n')
}

/** A self-contained HTML document: styles inlined, mermaid already turned into SVG. */
export async function buildExportHtml(
  source: string,
  title: string,
  themeCss: string,
  plugins: MdPlugin[],
  docPath: string | null
): Promise<string> {
  const body = document.createElement('div')
  body.innerHTML = await inlineLocalImages(await renderMarkdown(source, plugins), docPath, 'data')
  await runPostRender(body, plugins, { themeCss })

  // The bundled fonts live in the app, so a theme that uses them gets them cut down to this document's
  // characters and embedded; otherwise the file would fall back to whatever the reader has installed.
  const kinds = (['sans', 'serif'] as const).filter((k) => themeCss.includes(`Noto ${k === 'sans' ? 'Sans' : 'Serif'}`))
  const fonts = kinds.length ? await window.api.embedFonts(body.textContent ?? '', [...kinds]) : ''

  const esc = title.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc}</title>
<style>${fonts}
${collectCss(themeCss, plugins, body.innerHTML)}</style>
</head>
<body class="markdown-body">
${body.innerHTML}
</body>
</html>`
}
