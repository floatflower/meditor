import type { MdPlugin } from './markdown'

const CORE = `# 這個編輯器支援的語法

## 基本
CommonMark 加 GFM：標題、粗體／斜體／刪除線、清單、待辦清單（- [ ] 事項）、表格、引用、連結、分隔線。
程式碼區塊請標記語言（例如 \`\`\`ts），會自動語法高亮。

## 圖片說明
單獨成一行的 ![說明文字](圖片網址) 會在圖片下方顯示「說明文字」當圖說；沒有說明文字的圖片或夾在句子中間的圖片則沒有圖說。

## 換頁符
單獨一行寫 ::pagebreak。網頁預覽看不到它，列印或匯出 PDF 時會強制換頁。

## 提示區塊
:::note
一般提示，內容可以含任何 Markdown。
:::

:::warning{title="小心"}
警告。title 屬性可以改標題，預設是 note 或 warning。
:::

## 自訂區塊（directive）
形式是 :::名稱{屬性=值} … :::，單行形式是 ::名稱。屬性值有空白時加引號。
**外層區塊的冒號數必須比裡面任何區塊多**，否則內層的結尾 ::: 會把外層一起關掉。名稱不認得時會當成普通區塊顯示。
以下是目前啟用的擴充功能：
`

const FOOTER = `
## 建議流程
1. 先呼叫 get_document 看目前內容。
2. 用 replace_text 或 insert_text 修改（每次呼叫都是編輯器裡一次可還原的操作）。
3. 修改後呼叫 get_render_errors，有錯誤就依訊息修正。
`

/** The syntax guide an AI assistant gets: the core syntax plus the docs of every enabled plugin. */
export function buildSyntaxGuide(plugins: MdPlugin[]): string {
  const sections = plugins.flatMap((p) => (p.docs ? [p.docs.trim()] : []))
  return [CORE.trim(), ...sections, FOOTER.trim()].join('\n\n')
}
