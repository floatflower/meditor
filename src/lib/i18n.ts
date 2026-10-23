export type Lang = 'zh-TW' | 'en'

export interface Strings {
  nav: { features: string; syntax: string; download: string; github: string }
  hero: {
    badge: string
    title: string
    slogan1: string
    slogan2: string
    demoTitle: string
    subtitle: string
    download: string
    downloadFor: (os: string) => string
    viewSource: string
    free: string
  }
  features: { title: string; subtitle: string; items: { icon: string; title: string; body: string }[] }
  showcase: { title: string; subtitle: string; editor: string; manuscript: string }
  download: {
    title: string
    subtitle: string
    loading: string
    version: (v: string) => string
    prerelease: string
    released: (date: string) => string
    notes: string
    noRelease: string
    all: string
    mac: string
    win: string
    linux: string
    arm64: string
    x64: string
    appimage: string
    deb: string
    installer: string
    install: { title: string; mac: string; win: string; linuxAppimage: string; linuxDeb: string }
    mobile: string
  }
  marquee: string[]
  footer: { license: string; issues: string }
}

const zh: Strings = {
  nav: { features: '功能', syntax: '語法說明', download: '下載', github: 'GitHub' },
  hero: {
    badge: '免費 · 開源',
    title: '好寫、好擴充的 Markdown 編輯器',
    slogan1: '專注寫字，',
    slogan2: '其餘皆可擴充。',
    demoTitle: '左邊寫，右邊即時長出來',
    subtitle: '即時預覽、圖表與公式、自訂主題與插件。還能讓 AI 幫你改文件，每一處修改都由你決定接受或拒絕。',
    download: '下載',
    downloadFor: (os) => `下載 ${os} 版`,
    viewSource: '查看原始碼',
    free: '支援 macOS、Windows、Linux'
  },
  features: {
    title: '寫文件需要的，都在這裡',
    subtitle: '從日常筆記到要交出去的報告。',
    items: [
      { icon: 'eye', title: '即時預覽', body: '編輯、雙欄、預覽三種檢視模式。工具列一鍵插入標題、清單、表格、程式碼區塊。' },
      { icon: 'chart', title: '圖表與公式', body: '直接在文件裡寫 Mermaid 流程圖、LaTeX 數學公式與 Chart.js 資料圖表，寫錯會當場標示。' },
      { icon: 'palette', title: '主題與插件', body: '用 CSS 自訂外觀，內建 Default 與襯線的 Manuscript。插件可以加上自己的語法與區塊。' },
      { icon: 'bot', title: 'AI 協作', body: '內建 MCP 伺服器，讓 Claude 這類 AI 讀寫目前的文件。修改以逐行差異顯示，你可以逐行接受或拒絕。' },
      { icon: 'export', title: 'PDF 與 HTML 匯出', body: 'HTML 可選單一檔案（內嵌）或附資源資料夾（打包），字體只嵌入文件用到的字，檔案很小。' },
      { icon: 'folder', title: '資料夾與分頁', body: '開啟資料夾後在側邊欄瀏覽所有 .md，多個分頁同時編輯，關閉時提醒未存檔。' },
      { icon: 'image', title: '圖片', body: '一次拖進多張圖片，或貼上連結。本機圖片在預覽與匯出裡都能正確顯示。' },
      { icon: 'type', title: '多語系與字體', body: '繁體中文、简体中文、English、日本語，跟隨系統語言。內建 Noto 字體，中日韓字形不會錯亂。' },
      { icon: 'scale', title: '免費開源', body: '以 MIT 授權釋出，沒有帳號、沒有雲端、沒有追蹤，你的文件只在你的電腦上。' }
    ]
  },
  showcase: { title: '看起來是這樣', subtitle: '同一份文件，換個主題就是另一種心情。', editor: 'Default 主題，雙欄檢視', manuscript: 'Manuscript 主題（襯線字體）' },
  download: {
    title: '下載 Folio',
    subtitle: '選你的平台，免費使用。',
    loading: '正在取得最新版本…',
    version: (v) => `版本 ${v}`,
    prerelease: '預覽版',
    released: (d) => `發佈於 ${d}`,
    notes: '發行說明',
    noRelease: '暫時抓不到最新版本資訊，請直接前往 GitHub Releases 下載。',
    all: '所有版本',
    mac: 'macOS',
    win: 'Windows',
    linux: 'Linux',
    arm64: 'Apple Silicon（M1 以後）',
    x64: 'Intel',
    appimage: 'AppImage',
    deb: '.deb（Debian、Ubuntu）',
    installer: '安裝程式（.exe）',
    install: {
      title: '安裝說明',
      mac: 'macOS：目前尚未經過 Apple 公證，第一次開啟會被擋下。請到「系統設定 → 隱私權與安全性」，找到 Folio 並按「仍要打開」。',
      win: 'Windows：SmartScreen 可能顯示「未知的發行者」，請選「其他資訊 → 仍要執行」。',
      linuxAppimage: 'Linux（AppImage）：下載後執行 chmod +x，再直接開啟。Ubuntu 22.04 以後需要先安裝 libfuse2。',
      linuxDeb: 'Linux（.deb）：用 sudo apt install ./檔名.deb 安裝，會自動處理相依套件與沙箱設定。'
    },
    mobile: '這是桌面應用程式，請用電腦開啟本頁下載。'
  },
  marquee: ['Mermaid', 'LaTeX', 'Chart.js', 'MCP', '自訂主題', '插件', 'PDF', 'HTML', '待辦清單', '提示框', 'Noto 字體', '開源'],
  footer: { license: 'MIT 授權', issues: '回報問題' }
}

const en: Strings = {
  nav: { features: 'Features', syntax: 'Syntax guide', download: 'Download', github: 'GitHub' },
  hero: {
    badge: 'Free · Open source',
    title: 'A Markdown editor that is easy to write in, and to extend',
    slogan1: 'Write first.',
    slogan2: 'Extend the rest.',
    demoTitle: 'Write on the left, watch it grow on the right',
    subtitle:
      'Live preview, diagrams and math, custom themes and plugins. Let an AI help edit your documents while you accept or reject every change.',
    download: 'Download',
    downloadFor: (os) => `Download for ${os}`,
    viewSource: 'View source',
    free: 'For macOS, Windows and Linux'
  },
  features: {
    title: 'Everything a document needs',
    subtitle: 'From everyday notes to the report you hand in.',
    items: [
      { icon: 'eye', title: 'Live preview', body: 'Editor, split and preview modes. The toolbar inserts headings, lists, tables and code blocks in one click.' },
      { icon: 'chart', title: 'Diagrams and math', body: 'Write Mermaid diagrams, LaTeX formulas and Chart.js charts right in the document. Mistakes are flagged on the spot.' },
      { icon: 'palette', title: 'Themes and plugins', body: 'Restyle everything with CSS. Comes with Default and the serif Manuscript. Plugins add your own syntax and blocks.' },
      { icon: 'bot', title: 'AI collaboration', body: 'A built-in MCP server lets an AI such as Claude read and edit the open document. Changes show as a line-by-line diff you accept or reject.' },
      { icon: 'export', title: 'PDF and HTML export', body: 'HTML as one embedded file or as a bundle with a resources folder. Only the characters you use are embedded, so files stay small.' },
      { icon: 'folder', title: 'Folders and tabs', body: 'Open a folder to browse every .md in a sidebar, edit in several tabs, and get a warning before closing unsaved work.' },
      { icon: 'image', title: 'Images', body: 'Drop several images at once or paste a link. Local images show correctly in the preview and in exports.' },
      { icon: 'type', title: 'Languages and fonts', body: 'English, 繁體中文, 简体中文 and 日本語, following your system. Bundled Noto fonts keep Chinese, Japanese and Korean glyphs right.' },
      { icon: 'scale', title: 'Free and open', body: 'Released under the MIT License. No account, no cloud, no tracking: your documents stay on your computer.' }
    ]
  },
  showcase: { title: 'What it looks like', subtitle: 'The same document in another theme is a different mood.', editor: 'Default theme, split view', manuscript: 'Manuscript theme (serif)' },
  download: {
    title: 'Download Folio',
    subtitle: 'Pick your platform. It is free.',
    loading: 'Looking up the latest version…',
    version: (v) => `Version ${v}`,
    prerelease: 'Pre-release',
    released: (d) => `Released ${d}`,
    notes: 'Release notes',
    noRelease: 'The latest version could not be looked up. Please download from GitHub Releases.',
    all: 'All versions',
    mac: 'macOS',
    win: 'Windows',
    linux: 'Linux',
    arm64: 'Apple Silicon (M1 and later)',
    x64: 'Intel',
    appimage: 'AppImage',
    deb: '.deb (Debian, Ubuntu)',
    installer: 'Installer (.exe)',
    install: {
      title: 'Installing',
      mac: 'macOS: the app is not notarized by Apple yet, so the first launch is blocked. Open System Settings → Privacy & Security, find Folio and choose "Open Anyway".',
      win: 'Windows: SmartScreen may say "unknown publisher". Choose "More info → Run anyway".',
      linuxAppimage: 'Linux (AppImage): run chmod +x on the file, then open it. Ubuntu 22.04 and later need libfuse2 installed first.',
      linuxDeb: 'Linux (.deb): install with sudo apt install ./file.deb, which also takes care of dependencies and sandbox setup.'
    },
    mobile: 'This is a desktop app. Open this page on a computer to download it.'
  },
  marquee: ['Mermaid', 'LaTeX', 'Chart.js', 'MCP', 'Custom themes', 'Plugins', 'PDF', 'HTML', 'To-do lists', 'Callouts', 'Noto fonts', 'Open source'],
  footer: { license: 'MIT License', issues: 'Report an issue' }
}

export const STRINGS: Record<Lang, Strings> = { 'zh-TW': zh, en }

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('folio.site.lang')
    if (saved === 'zh-TW' || saved === 'en') return saved
  } catch {
    // no storage
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en'
}
