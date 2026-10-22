import { visit } from 'unist-util-visit'
import type { MdPlugin } from '@/lib/markdown'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any

const checkbox = (checked: boolean): AnyNode => ({
  type: 'todoCheckbox',
  data: {
    hName: 'input',
    hProperties: { type: 'checkbox', disabled: true, checked, className: ['todo-box'] }
  }
})

/** `[x]` / `[ ]` at the start of a line (followed by a space or the end of the line), where a line starts at a paragraph, a table cell or after a line break. */
const MARK = /(^|\n)\[( |x|X)\](?:[ \t]+|(?=\n|$))/g

function split(text: string, atStart: boolean): AnyNode[] | null {
  const out: AnyNode[] = []
  let last = 0
  let hit = false
  for (const m of text.matchAll(MARK)) {
    if (m[1] === '' && !atStart) continue
    hit = true
    const before = text.slice(last, m.index)
    if (before) out.push({ type: 'text', value: before })
    if (m[1]) out.push({ type: 'break' }) // each todo line stands on its own line, as a newline alone would collapse into a space
    out.push(checkbox(m[2] !== ' '))
    last = m.index + m[0].length
  }
  if (!hit) return null
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

/** Turns `[x] done` / `[ ] todo` lines in paragraphs and table cells into checkboxes (list items are already handled by GFM). */
function remarkTodo() {
  return (tree: AnyNode) => {
    visit(tree, ['paragraph', 'tableCell'], (node: AnyNode) => {
      const kids: AnyNode[] = []
      node.children.forEach((child: AnyNode, i: number) => {
        const replaced = child.type === 'text' ? split(child.value, i === 0) : null
        if (replaced) kids.push(...replaced)
        else kids.push(child)
      })
      node.children = kids
    })
  }
}

export const todoPlugin: MdPlugin = {
  name: '待辦清單',
  docs: `
### 待辦清單
一行開頭寫 [ ] 是未完成、[x] 是已完成（方括號後要空一格，或是整格只有它），可以單獨成行，也可以放在表格儲存格裡：

[x] 買牛奶
[ ] 寫報告

| 事項 | 完成 |
| --- | --- |
| 打掃 | [x] |

放在清單裡就用標準寫法，可以巢狀：

- [x] 出門前
  - [x] 關燈
  - [ ] 帶鑰匙

預覽與匯出的勾選框是唯讀的，要改狀態請修改原文。
`,
  remarkPlugins: [remarkTodo],
  css: `
.markdown-body .todo-box { margin: 0 0.4em 0 0; vertical-align: middle; }
`
}
