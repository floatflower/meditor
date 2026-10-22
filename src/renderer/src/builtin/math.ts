import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { MdPlugin } from '@/lib/markdown'
import { katexCss, usesMath } from '@/lib/katexCss'

export const mathPlugin: MdPlugin = {
  name: 'LaTeX 數學公式',
  docs: `
### LaTeX 數學公式
行內公式用單個 $ 包住：$E = mc^2$。區塊公式用兩行 $$ 夾住：

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

使用 KaTeX 語法。要顯示字面的美元符號請寫 \\$（例如 \\$5），否則兩個 $ 之間會被當成公式。程式碼區塊與行內程式碼裡的 $ 不受影響。公式錯誤會顯示成紅字；用 get_render_errors 檢查。
`,
  remarkPlugins: [remarkMath],
  rehypePluginsBeforeHighlight: [[rehypeKatex, { strict: 'ignore' }]],
  // KaTeX's CSS (with fonts inlined) is large, so only ship it when the document has a formula.
  css: (html) => (usesMath(html) ? katexCss : '')
}
