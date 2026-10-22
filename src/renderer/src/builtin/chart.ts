import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import { parse as parseYaml } from 'yaml'
import type { ChartConfiguration, ChartType } from 'chart.js'
import type { MdPlugin } from '@/lib/markdown'
import { probeTheme } from '@/lib/themeProbe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any

/*
 * Two ways to write a chart:
 *
 *   A. a container directive whose body is a Markdown table (first column = labels,
 *      every other column = one series). Without this plugin it still reads as a table.
 *
 *        :::chart{type=bar title="月營收"}
 *        | 月份 | 2024 | 2025 |
 *        | --- | --- | --- |
 *        | 1 月 | 10 | 12 |
 *        :::
 *
 *   B. a fenced ```chart block holding a Chart.js config as YAML (or JSON, which is valid YAML).
 */

const WIDTH = 640
const DEFAULT_HEIGHT = 360
const SCALE = 3 // PNG pixel ratio: sharp enough for print.

const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#9c755f', '#76b7b2', '#bab0ac']
const THEME_VARS = ['--chart-text', '--chart-grid', '--chart-font', ...PALETTE.map((_, i) => `--chart-${i + 1}`)]

interface ChartTheme {
  colors: string[]
  text: string
  grid: string
  font: string
}

function readChartTheme(themeCss: string): ChartTheme {
  const { vars, color, fontFamily } = probeTheme(themeCss, THEME_VARS)
  return {
    colors: PALETTE.map((fallback, i) => vars[`--chart-${i + 1}`] ?? fallback),
    text: vars['--chart-text'] ?? color,
    grid: vars['--chart-grid'] ?? 'rgba(128, 128, 128, 0.3)',
    font: vars['--chart-font'] ?? fontFamily
  }
}

/** Swap ```chart blocks for a placeholder so Shiki skips them; they are drawn later. */
function rehypeChartFence() {
  return (tree: AnyNode): void => {
    visit(tree, 'element', (node: AnyNode, index: number | undefined, parent: AnyNode) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return
      const code = node.children[0]
      const classes: string[] = code?.properties?.className ?? []
      if (code?.tagName === 'code' && classes.includes('language-chart')) {
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['chart-block', 'chart-spec'] },
          children: [{ type: 'text', value: toString(code) }]
        }
      }
    })
  }
}

const num = (s: string): number | null => {
  const n = Number(s.replace(/[,，\s%$]/g, ''))
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

const tint = (color: string, percent: number): string => `color-mix(in srgb, ${color} ${percent}%, transparent)`

type Attrs = Record<string, string>

function readTable(el: HTMLElement): { header: string[]; rows: string[][] } {
  const table = el.querySelector('table')
  if (!table) throw new Error('chart 區塊裡需要一張 Markdown 表格')
  const text = (c: Element): string => c.textContent?.trim() ?? ''
  const header = Array.from(table.querySelectorAll('thead th')).map(text)
  const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.children).map(text))
  if (header.length < 2 || rows.length === 0) throw new Error('表格至少需要兩欄（標籤＋一組資料）與一列資料')
  return { header, rows }
}

const KINDS = ['bar', 'line', 'area', 'pie', 'doughnut', 'radar', 'scatter']

function configFromTable(
  table: { header: string[]; rows: string[][] },
  attrs: Attrs,
  theme: ChartTheme
): ChartConfiguration {
  const requested = (attrs.type ?? 'bar').toLowerCase()
  if (!KINDS.includes(requested)) throw new Error(`不支援的圖表類型「${requested}」（可用：${KINDS.join('、')}）`)
  const area = requested === 'area'
  const type = (area ? 'line' : requested) as ChartType
  const round = type === 'pie' || type === 'doughnut'
  const color = (i: number): string => theme.colors[i % theme.colors.length]
  const series = table.header.slice(1)

  const datasets = series.map((label, i) => {
    const column = table.rows.map((r) => r[i + 1] ?? '')
    if (type === 'scatter') {
      const points = table.rows
        .map((r) => ({ x: num(r[0]), y: num(r[i + 1] ?? '') }))
        .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null)
      return { label, data: points, backgroundColor: color(i), borderColor: color(i) }
    }
    const data = column.map(num)
    if (round) {
      const colors = table.rows.map((_, j) => color(j))
      return { label, data, backgroundColor: colors, borderColor: theme.grid }
    }
    if (type === 'bar') return { label, data, backgroundColor: color(i) }
    const filled = area || type === 'radar'
    return {
      label,
      data,
      borderColor: color(i),
      backgroundColor: filled ? tint(color(i), 25) : color(i),
      fill: filled,
      tension: 0.25
    }
  })

  const stacked = attrs.stacked !== undefined && attrs.stacked !== 'false' && (type === 'bar' || type === 'line')
  const legend = attrs.legend !== 'false' && (series.length > 1 || round)
  return {
    type,
    data: { labels: type === 'scatter' ? undefined : table.rows.map((r) => r[0]), datasets },
    options: {
      plugins: {
        title: { display: !!attrs.title, text: attrs.title ?? '', font: { size: 16 } },
        legend: { display: legend, position: 'bottom' }
      },
      scales: stacked ? { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } : undefined
    }
  } as ChartConfiguration
}

/** A user-written Chart.js config: keep it as is, but colour datasets that have no colour of their own. */
function configFromSpec(text: string, theme: ChartTheme): { config: ChartConfiguration; width: number; height: number } {
  const spec = parseYaml(text)
  if (!spec || typeof spec !== 'object' || !spec.type || !spec.data) {
    throw new Error('chart 設定需要 type 與 data（Chart.js 的設定格式，YAML 或 JSON）')
  }
  const { width, height, ...config } = spec as Record<string, unknown> & { width?: number; height?: number }
  const round = config.type === 'pie' || config.type === 'doughnut'
  const datasets = ((config.data as { datasets?: Record<string, unknown>[] }).datasets ?? []) as Record<string, unknown>[]
  datasets.forEach((d, i) => {
    if (d.backgroundColor !== undefined || d.borderColor !== undefined) return
    const c = theme.colors[i % theme.colors.length]
    const n = Array.isArray(d.data) ? d.data.length : 0
    d.backgroundColor = round ? Array.from({ length: n }, (_, j) => theme.colors[j % theme.colors.length]) : c
    if (config.type === 'line' || config.type === 'radar') d.borderColor = c
  })
  return {
    config: config as unknown as ChartConfiguration,
    width: Number(width) || WIDTH,
    height: Number(height) || DEFAULT_HEIGHT
  }
}

const cache = new Map<string, string>()
let registered = false

async function draw(config: ChartConfiguration, width: number, height: number, theme: ChartTheme): Promise<string> {
  const key = JSON.stringify([config, width, height, theme])
  const hit = cache.get(key)
  if (hit) return hit

  // Loaded on demand: Chart.js is only needed by documents that contain a chart.
  const { Chart, registerables } = await import('chart.js')
  if (!registered) {
    Chart.register(...registerables)
    registered = true
  }
  Chart.defaults.color = theme.text
  Chart.defaults.borderColor = theme.grid
  Chart.defaults.font.family = theme.font

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const chart = new Chart(canvas, {
    ...config,
    // Static image output: no animation (it would be captured mid-flight) and a high pixel ratio.
    options: { ...config.options, animation: false, responsive: false, devicePixelRatio: SCALE }
  })
  const url = canvas.toDataURL('image/png')
  chart.destroy()

  if (cache.size > 40) cache.delete(cache.keys().next().value as string)
  cache.set(key, url)
  return url
}

async function renderCharts(root: HTMLElement, themeCss: string): Promise<void> {
  const theme = readChartTheme(themeCss)
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('.chart-block'))) {
    try {
      let config: ChartConfiguration
      let width = WIDTH
      let height = DEFAULT_HEIGHT
      let title = ''
      if (el.classList.contains('chart-spec')) {
        ;({ config, width, height } = configFromSpec(el.textContent ?? '', theme))
        title = String((config.options?.plugins?.title as { text?: string } | undefined)?.text ?? '')
      } else {
        const attrs: Attrs = JSON.parse(el.dataset.chart ?? '{}')
        config = configFromTable(readTable(el), attrs, theme)
        height = Number(attrs.height) || DEFAULT_HEIGHT
        title = attrs.title ?? ''
      }
      const img = document.createElement('img')
      img.src = await draw(config, width, height, theme)
      img.width = width
      img.height = height
      img.alt = title || '圖表'
      el.replaceChildren(img)
    } catch (err) {
      el.dataset.source = ((el.dataset.chart ? `${el.dataset.chart}\n` : '') + (el.textContent ?? ''))
        .replace(/\s*\n\s*/g, '\n')
        .trim()
        .slice(0, 500)
      el.classList.add('chart-error')
      el.textContent = err instanceof Error ? err.message : String(err)
    }
  }
}

export const chartPlugin: MdPlugin = {
  name: '圖表（Chart.js）',
  docs: `
### 資料圖表
**寫法 A（日常用）**：容器 directive，內容是一張 Markdown 表格；第一欄是標籤，其餘每欄是一組資料。

:::chart{type=bar title="月營收"}
| 月份 | 2024 | 2025 |
| --- | --- | --- |
| 1 月 | 10 | 12 |
| 2 月 | 20 | 18 |
:::

屬性：type（bar、line、area、pie、doughnut、radar、scatter，預設 bar）、title、stacked（堆疊，僅 bar/line）、height（像素）、legend=false（隱藏圖例）。scatter 的第一欄是 x 數值。

**寫法 B（進階）**：語言標記為 chart 的程式碼區塊，內容是 Chart.js 設定（YAML 或 JSON），需要 type 與 data，可加 width、height：

\`\`\`chart
type: line
data:
  labels: [Q1, Q2, Q3]
  datasets:
    - label: Sales
      data: [5, 9, 7]
options:
  plugins:
    title: { display: true, text: "季度銷售" }
\`\`\`

YAML 不能寫函式。沒指定顏色的資料組會自動套用主題配色。設定錯誤時會顯示紅字；用 get_render_errors 檢查。
`,
  directives: {
    chart: ({ attributes }) => ({
      tagName: 'div',
      properties: { className: ['chart-block'], dataChart: JSON.stringify(attributes) }
    })
  },
  rehypePluginsBeforeHighlight: [rehypeChartFence],
  css: `
    .markdown-body .chart-block { margin: 1.25rem 0; text-align: center; }
    .markdown-body .chart-block img { display: inline-block; max-width: 100%; height: auto; }
    .markdown-body .chart-error { color: #b91c1c; white-space: pre-wrap; text-align: left; font: 12px/1.5 monospace; }
  `,
  postRender: async (root, { themeCss }) => {
    if (root.querySelector('.chart-block')) await renderCharts(root, themeCss)
  }
}
