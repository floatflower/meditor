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
  plugins: MdPlugin[]
): Promise<string> {
  const body = document.createElement('div')
  body.innerHTML = await renderMarkdown(source, plugins)
  await runPostRender(body, plugins, { themeCss })

  const esc = title.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc}</title>
<style>${collectCss(themeCss, plugins, body.innerHTML)}</style>
</head>
<body class="markdown-body">
${body.innerHTML}
</body>
</html>`
}
