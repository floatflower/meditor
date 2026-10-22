import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export type EditorCommand = (view: EditorView) => void

/** Toggle an inline marker (`**`, `*`, `~~`, `` ` ``) around the selection, or insert a placeholder. */
export const wrap =
  (before: string, after: string = before, placeholder = '文字'): EditorCommand =>
  (view) => {
    view.dispatch(
      view.state.changeByRange((range) => {
        const { doc } = view.state
        const wrappedInside =
          range.from - before.length >= 0 &&
          doc.sliceString(range.from - before.length, range.from) === before &&
          doc.sliceString(range.to, range.to + after.length) === after

        if (wrappedInside && !range.empty) {
          return {
            changes: [
              { from: range.from - before.length, to: range.from },
              { from: range.to, to: range.to + after.length }
            ],
            range: EditorSelection.range(range.from - before.length, range.to - before.length)
          }
        }
        const text = range.empty ? placeholder : doc.sliceString(range.from, range.to)
        const from = range.from + before.length
        return {
          changes: { from: range.from, to: range.to, insert: before + text + after },
          range: EditorSelection.range(from, from + text.length)
        }
      })
    )
  }

const HEADING = /^#{1,6}\s+/

export const heading =
  (level: number): EditorCommand =>
  (view) => {
    const { doc, selection } = view.state
    const changes = []
    const first = doc.lineAt(selection.main.from).number
    const last = doc.lineAt(selection.main.to).number
    for (let n = first; n <= last; n++) {
      const line = doc.line(n)
      const current = HEADING.exec(line.text)
      const same = current && current[0].trim().length === level
      const insert = same ? '' : '#'.repeat(level) + ' '
      changes.push({ from: line.from, to: line.from + (current?.[0].length ?? 0), insert })
    }
    view.dispatch({ changes })
  }

type ListKind = 'ul' | 'ol' | 'task' | 'quote'
const LIST_PREFIX = /^(\s*)(?:[-*+]\s\[[ xX]\]\s|[-*+]\s|\d+\.\s|>\s?)/

function kindOf(text: string): ListKind | null {
  const t = text.trimStart()
  if (/^[-*+]\s\[[ xX]\]\s/.test(t)) return 'task'
  if (/^[-*+]\s/.test(t)) return 'ul'
  if (/^\d+\.\s/.test(t)) return 'ol'
  if (t.startsWith('>')) return 'quote'
  return null
}

const prefixFor = (kind: ListKind, index: number): string =>
  kind === 'ul' ? '- ' : kind === 'ol' ? `${index + 1}. ` : kind === 'task' ? '- [ ] ' : '> '

/** Apply a list/quote prefix to every selected line; applying the same kind again removes it. */
export const toggleList =
  (kind: ListKind): EditorCommand =>
  (view) => {
    const { doc, selection } = view.state
    const first = doc.lineAt(selection.main.from).number
    const last = doc.lineAt(selection.main.to).number
    const lines = Array.from({ length: last - first + 1 }, (_, i) => doc.line(first + i)).filter(
      (l) => l.text.trim() !== '' || first === last
    )
    const active = lines.length > 0 && lines.every((l) => kindOf(l.text) === kind)

    const changes = lines.map((line, i) => {
      const m = LIST_PREFIX.exec(line.text)
      const indent = m?.[1].length ?? 0
      return {
        from: line.from + indent,
        to: line.from + (m?.[0].length ?? 0),
        insert: active ? '' : prefixFor(kind, i)
      }
    })
    view.dispatch({ changes })
  }

/** Insert a block (on its own paragraph) and select `[selFrom, selTo)` of the snippet. */
export const insertBlock =
  (snippet: string, selFrom = snippet.length, selTo = selFrom): EditorCommand =>
  (view) => {
    const { doc, selection } = view.state
    const line = doc.lineAt(selection.main.head)
    const blank = line.text.trim() === ''
    const from = blank ? line.from : line.to
    const lead = blank ? '' : '\n\n'
    view.dispatch({
      changes: { from, to: line.to, insert: lead + snippet },
      selection: { anchor: from + lead.length + selFrom, head: from + lead.length + selTo }
    })
  }

export const link: EditorCommand = (view) => {
  const { state } = view
  const r = state.selection.main
  const label = r.empty ? '連結文字' : state.sliceDoc(r.from, r.to)
  const insert = `[${label}](https://)`
  const urlFrom = r.from + label.length + 3
  view.dispatch({
    changes: { from: r.from, to: r.to, insert },
    selection: { anchor: urlFrom, head: urlFrom + 'https://'.length }
  })
}

export const image: EditorCommand = (view) => {
  const r = view.state.selection.main
  const alt = r.empty ? '圖片說明' : view.state.sliceDoc(r.from, r.to)
  const urlFrom = r.from + alt.length + 4
  view.dispatch({
    changes: { from: r.from, to: r.to, insert: `![${alt}](https://)` },
    selection: { anchor: urlFrom, head: urlFrom + 'https://'.length }
  })
}

export const codeBlock: EditorCommand = (view) => {
  const r = view.state.selection.main
  if (r.empty) return insertBlock('```\n\n```', 4)(view)
  const text = view.state.sliceDoc(r.from, r.to)
  view.dispatch({ changes: { from: r.from, to: r.to, insert: '```\n' + text + '\n```' } })
}

export const table = insertBlock(
  '| 欄位 1 | 欄位 2 | 欄位 3 |\n| --- | --- | --- |\n| 內容 | 內容 | 內容 |',
  2,
  6
)

export const horizontalRule = insertBlock('---\n', 5)

const MERMAID = '```mermaid\ngraph TD\n  A[開始] --> B[結束]\n```'
export const mermaidBlock = insertBlock(MERMAID, 11, MERMAID.length - 4)

export const inlineMath = wrap('$', '$', 'E = mc^2')

export const mathBlock = insertBlock('$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$', 3, 3 + '\\int_0^1 x^2\\,dx = \\frac{1}{3}'.length)

const CHART = ':::chart{type=bar title="標題"}\n| 項目 | 系列 A | 系列 B |\n| --- | --- | --- |\n| 一 | 10 | 14 |\n| 二 | 20 | 18 |\n| 三 | 15 | 25 |\n:::'
export const chartBlock = insertBlock(CHART, CHART.indexOf('標題'), CHART.indexOf('標題') + 2)
