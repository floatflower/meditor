import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import type { MdPlugin } from '@/lib/markdown'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any

/** Swap ```mermaid blocks for a placeholder so Shiki skips them; they are drawn later. */
function rehypeMermaid() {
  return (tree: AnyNode): void => {
    visit(tree, 'element', (node: AnyNode, index: number | undefined, parent: AnyNode) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return
      const code = node.children[0]
      const classes: string[] = code?.properties?.className ?? []
      if (code?.tagName === 'code' && classes.includes('language-mermaid')) {
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['mermaid-block'] },
          children: [{ type: 'text', value: toString(code) }]
        }
      }
    })
  }
}

let mermaidId = 0

/** `--mermaid-<key>` custom properties a theme may set → mermaid `themeVariables`. */
const MERMAID_VARS: Record<string, string> = {
  primary: 'primaryColor',
  'primary-text': 'primaryTextColor',
  'primary-border': 'primaryBorderColor',
  secondary: 'secondaryColor',
  'secondary-text': 'secondaryTextColor',
  'secondary-border': 'secondaryBorderColor',
  tertiary: 'tertiaryColor',
  'tertiary-text': 'tertiaryTextColor',
  'tertiary-border': 'tertiaryBorderColor',
  line: 'lineColor',
  text: 'textColor',
  background: 'background',
  font: 'fontFamily',
  'node-border': 'nodeBorder',
  'cluster-background': 'clusterBkg',
  'cluster-border': 'clusterBorder',
  'note-background': 'noteBkgColor',
  'note-text': 'noteTextColor',
  'note-border': 'noteBorderColor',
  'edge-label-background': 'edgeLabelBackground'
}

/** Resolve the theme's mermaid variables by letting the browser compute them on a throwaway element. */
function readMermaidTheme(themeCss: string): { theme: 'base' | 'default'; themeVariables: Record<string, string | boolean> } {
  const style = document.createElement('style')
  style.textContent = themeCss
  const host = document.createElement('div')
  host.className = 'markdown-body'
  host.style.display = 'none'
  document.head.append(style)
  document.body.append(host)

  const computed = getComputedStyle(host)
  const themeVariables: Record<string, string | boolean> = {}
  for (const [key, name] of Object.entries(MERMAID_VARS)) {
    const value = computed.getPropertyValue(`--mermaid-${key}`).trim()
    if (value) themeVariables[name] = value
  }
  if (computed.getPropertyValue('--mermaid-dark').trim() === 'true') themeVariables.darkMode = true

  style.remove()
  host.remove()
  // Only mermaid's `base` theme honours themeVariables; without any, keep the stock look.
  return { theme: Object.keys(themeVariables).length ? 'base' : 'default', themeVariables }
}

/** Replace every `.mermaid-block` under `root` with its SVG, styled by the theme's `--mermaid-*` variables. */
async function renderMermaid(root: HTMLElement, themeCss: string): Promise<void> {
  // Loaded on demand: mermaid is large and most documents have no diagram.
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', ...readMermaidTheme(themeCss) })
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block'))) {
    const id = `mmd-${mermaidId++}`
    try {
      const { svg } = await mermaid.render(id, el.textContent ?? '')
      el.innerHTML = svg
    } catch (err) {
      document.getElementById(`d${id}`)?.remove()
      el.dataset.source = (el.textContent ?? '').slice(0, 500)
      el.classList.add('mermaid-error')
      el.textContent = err instanceof Error ? err.message : String(err)
    }
  }
}

export const mermaidPlugin: MdPlugin = {
  name: 'Mermaid 圖表',
  docs: `
### Mermaid 圖表
用語言標記為 mermaid 的程式碼區塊寫圖表，支援流程圖、時序圖、甘特圖等 mermaid 的所有圖種：

\`\`\`mermaid
graph LR
  A[開始] --> B[結束]
\`\`\`

語法錯誤時預覽會顯示紅色錯誤訊息；寫完用 get_render_errors 檢查。
`,
  rehypePluginsBeforeHighlight: [rehypeMermaid],
  postRender: async (root, { themeCss }) => {
    if (root.querySelector('.mermaid-block')) await renderMermaid(root, themeCss)
  }
}
