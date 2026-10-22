import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron'
import { join, basename, resolve } from 'path'
import { buildMenu, type MenuAction, type MenuActions, type MenuState } from './menu'
import { McpController } from './mcp'
import { scanFolder, stopWatching, watchFolder } from './folder'
import { loadSettings, newToken, saveSettings, type Settings } from './settings'
import { access, cp, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'

const userDir = (sub: string): string => join(app.getPath('userData'), sub)

const EXAMPLE_THEME = `/* 自訂 theme：樣式請寫在 .markdown-body 底下。 */
.markdown-body {
  font-family: Georgia, 'Noto Serif TC', serif;
  color: #3b2f2f;
  background: #fbf6ee;

  /* mermaid 圖表配色（用 hex / rgb() / hsl()）。可用變數：
     primary, primary-text, primary-border, secondary, tertiary, line, text,
     background, font, node-border, cluster-background, note-background,
     note-text, note-border, edge-label-background；深色主題另設 --mermaid-dark: true */
  --mermaid-primary: #f1e8d8;
  --mermaid-primary-text: #3b2f2f;
  --mermaid-primary-border: #c9a66b;
  --mermaid-line: #9a3412;
  --mermaid-text: #3b2f2f;
  --mermaid-font: Georgia, serif;

  /* 資料圖表配色：--chart-1 ~ --chart-8 為各組資料的顏色，另有
     --chart-text（文字）、--chart-grid（格線）、--chart-font（字型）。沒設就沿用主題文字色。 */
  --chart-1: #9a3412;
  --chart-2: #c9a66b;
  --chart-3: #6b7f3a;
  --chart-4: #7c4a2d;
}
.markdown-body h1, .markdown-body h2 { border-bottom: 2px solid #c9a66b; }
.markdown-body a { color: #9a3412; }
.markdown-body pre { background: #f1e8d8; }
`

const SEEDS: Record<string, Record<string, string>> = {
  plugins: {},
  themes: { 'Sepia.css': EXAMPLE_THEME }
}

// The first time a folder is created, drop in an example so users have something to copy.
async function ensureDir(sub: 'plugins' | 'themes'): Promise<string> {
  const dir = userDir(sub)
  const existed = await access(dir).then(() => true, () => false)
  await mkdir(dir, { recursive: true })
  if (!existed) {
    for (const [name, content] of Object.entries(SEEDS[sub])) await writeFile(join(dir, name), content, 'utf-8')
  }
  return dir
}

async function listFiles(dir: string, ext: string): Promise<string[]> {
  return (await readdir(dir)).filter((f) => f.endsWith(ext))
}

let menuState: MenuState = { themes: [], currentTheme: '', plugins: [] }
let settings: Settings
let mcp: McpController

// The app used to be called "mdeditor", and Electron keys its data folder on the app name. Carry the
// settings and extensions over to the new folder once. Safe to delete when no old build is around.
async function migrateLegacyData(): Promise<void> {
  const legacy = join(app.getPath('appData'), 'mdeditor')
  const current = app.getPath('userData')
  const exists = (path: string): Promise<boolean> => access(path).then(() => true, () => false)
  if (legacy === current || (await exists(join(current, 'settings.json'))) || !(await exists(join(legacy, 'settings.json')))) {
    return
  }
  for (const name of ['settings.json', 'themes', 'plugins', 'Local Storage']) {
    await cp(join(legacy, name), join(current, name), { recursive: true, force: false }).catch(() => {})
  }
}

// --- AI (MCP) ---------------------------------------------------------------------------------

let nextRequestId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

/** Ask the editor window to run `method`; the answer comes back over `mcp:response`. */
function callRenderer(method: string, args?: unknown): Promise<unknown> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return Promise.reject(new Error('編輯器視窗尚未開啟'))
  return new Promise((resolve, reject) => {
    const id = nextRequestId++
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('編輯器沒有在時限內回應'))
    }, 15000)
    pending.set(id, {
      resolve: (v) => (clearTimeout(timer), resolve(v)),
      reject: (e) => (clearTimeout(timer), reject(e))
    })
    win.webContents.send('mcp:request', { id, method, args })
  })
}

const mcpUrl = (): string => `http://127.0.0.1:${settings.mcp.port}/mcp`

function sendToRenderer(action: MenuAction): void {
  BrowserWindow.getAllWindows()[0]?.webContents.send('menu:action', action)
}

function notify(text: string): void {
  sendToRenderer({ type: 'notice', text })
}

function rebuildMenu(): void {
  const { enabled, allowWrite } = settings.mcp
  Menu.setApplicationMenu(
    buildMenu(menuState, { enabled, allowWrite, ...mcp.status }, menuActions)
  )
}

async function applyMcpSettings(): Promise<void> {
  await saveSettings(settings)
  if (settings.mcp.enabled) await mcp.start()
  else await mcp.stop()
  rebuildMenu()
}

const menuActions: MenuActions = {
  setAsDefault: () => void showDefaultAppGuide(),
  openFolder: async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (!r.canceled && r.filePaths[0]) sendToRenderer({ type: 'open-workspace', root: r.filePaths[0] })
  },
  toggleEnabled: (enabled) => {
    settings.mcp.enabled = enabled
    if (!enabled) settings.mcp.allowWrite = false
    void applyMcpSettings()
  },
  toggleWrite: (allow) => {
    settings.mcp.allowWrite = allow
    void applyMcpSettings()
  },
  copyCommand: () => {
    clipboard.writeText(
      `claude mcp add --transport http meditor ${mcpUrl()} --header "Authorization: Bearer ${settings.mcp.token}"`
    )
    notify('已複製 Claude Code 連線指令（含 token，請勿公開分享）')
  },
  copyJson: () => {
    clipboard.writeText(
      JSON.stringify(
        {
          mcpServers: {
            meditor: { type: 'http', url: mcpUrl(), headers: { Authorization: `Bearer ${settings.mcp.token}` } }
          }
        },
        null,
        2
      )
    )
    notify('已複製 MCP 連線設定（含 token，請勿公開分享）')
  },
  regenerateToken: async () => {
    const r = await dialog.showMessageBox({
      type: 'warning',
      message: '重新產生連線 token？',
      detail: '目前已連線或已設定好的 AI 客戶端會失效，需要用新的指令重新設定。',
      buttons: ['重新產生', '取消'],
      defaultId: 1,
      cancelId: 1
    })
    if (r.response !== 0) return
    settings.mcp.token = newToken()
    await applyMcpSettings()
    notify('已重新產生 token')
  }
}

function registerIpc(): void {
  ipcMain.on('menu:state', (_e, state: MenuState) => {
    menuState = state
    rebuildMenu()
  })

  ipcMain.handle('folder:scan', async (_e, root: string) => {
    watchFolder(root, () => sendToRenderer({ type: 'workspace-changed' }))
    return scanFolder(root)
  })
  ipcMain.on('folder:unwatch', () => stopWatching())

  ipcMain.handle('file:read', async (_e, path: string) => ({
    path,
    name: basename(path),
    content: await readFile(path, 'utf-8')
  }))

  ipcMain.on('renderer:ready', () => {
    rendererReady = true
    void flushOpen()
  })

  ipcMain.on('mcp:response', (_e, id: number, payload: { result?: unknown; error?: string }) => {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    if (payload.error !== undefined) entry.reject(new Error(payload.error))
    else entry.resolve(payload.result)
  })

  ipcMain.handle('file:open', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    })
    if (r.canceled) return null
    const path = r.filePaths[0]
    return { path, name: basename(path), content: await readFile(path, 'utf-8') }
  })

  ipcMain.handle('file:save', async (_e, path: string | null, content: string) => {
    let target = path
    if (!target) {
      const r = await dialog.showSaveDialog({
        defaultPath: 'untitled.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      })
      if (r.canceled || !r.filePath) return null
      target = r.filePath
    }
    await writeFile(target, content, 'utf-8')
    return { path: target, name: basename(target) }
  })

  ipcMain.handle('export:html', async (_e, html: string) => {
    const r = await dialog.showSaveDialog({
      defaultPath: 'document.html',
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })
    if (r.canceled || !r.filePath) return false
    await writeFile(r.filePath, html, 'utf-8')
    return true
  })

  // Render the exported HTML in a hidden window so printToPDF sees only the document.
  ipcMain.handle('export:pdf', async (_e, html: string) => {
    const r = await dialog.showSaveDialog({
      defaultPath: 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (r.canceled || !r.filePath) return false
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true })
      await writeFile(r.filePath, pdf)
    } finally {
      win.destroy()
    }
    return true
  })

  ipcMain.handle('themes:list', async () => {
    const dir = await ensureDir('themes')
    const names = await listFiles(dir, '.css')
    return Promise.all(
      names.map(async (n) => ({ name: n.replace(/\.css$/, ''), css: await readFile(join(dir, n), 'utf-8') }))
    )
  })

  ipcMain.handle('plugins:list', async () => {
    const dir = await ensureDir('plugins')
    const names = await listFiles(dir, '.js')
    return Promise.all(names.map(async (n) => ({ name: n, code: await readFile(join(dir, n), 'utf-8') })))
  })

  ipcMain.handle('paths:user', () => ({ themes: userDir('themes'), plugins: userDir('plugins') }))

  ipcMain.handle('shell:open-path', async (_e, path: string) => {
    await shell.openPath(path)
  })
}

// --- Files opened from outside (double-click in Finder/Explorer, "Open With", command line) ---

const MARKDOWN_EXT = /\.(md|markdown|mdown|txt)$/i

let pendingOpen: string | null = null
let rendererReady = false

/** Path arguments of a command line (flags are skipped). Dev runs have two leading args (electron, "."). */
function pathsFromArgv(argv: string[], cwd: string): string[] {
  return argv
    .slice(app.isPackaged ? 1 : 2)
    .filter((a) => !a.startsWith('-'))
    .map((a) => resolve(cwd, a))
}

/** Only the most recent request matters: the editor shows one document at a time. */
function queueOpen(path: string): void {
  pendingOpen = path
  void flushOpen()
}

async function flushOpen(): Promise<void> {
  if (!pendingOpen || !app.isReady()) return
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return createWindow() // delivered once the new window reports ready
  if (!rendererReady) return

  const path = pendingOpen
  pendingOpen = null
  if (win.isMinimized()) win.restore()
  win.focus()

  // A folder opens the sidebar; a document opens in the editor; anything else is not ours.
  const info = await stat(path).catch(() => null)
  if (info?.isDirectory()) return sendToRenderer({ type: 'open-workspace', root: path })
  if (!MARKDOWN_EXT.test(path)) return
  try {
    const content = await readFile(path, 'utf-8')
    sendToRenderer({ type: 'open-external', path, name: basename(path), content })
  } catch (err) {
    dialog.showErrorBox('無法開啟檔案', `${path}\n${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Operating systems do not let an app make itself the default for a file type; the user has to
 * choose it. All the app can do is be eligible (see `fileAssociations` in package.json) and say how.
 */
async function showDefaultAppGuide(): Promise<void> {
  const name = app.name
  const devNote = app.isPackaged ? '' : '\n\n（目前是開發模式，系統並不認得這個執行檔；請在打包後的 app 上設定。）'
  const mac = {
    message: '在 Finder 設定預設的 Markdown 程式',
    detail: `macOS 不允許 app 自行變更預設程式，請依下列步驟設定：\n\n1. 在 Finder 選取任一個 .md 檔案\n2. 按 ⌘I 開啟「取得資訊」\n3. 在「以此 App 打開」選擇「${name}」\n4. 按「全部更改…」並確認${devNote}`
  }
  const win = {
    message: '在 Windows 設定預設的 Markdown 程式',
    detail: `Windows 不允許 app 自行變更預設程式，請依下列步驟設定：\n\n1. 按下方按鈕開啟「預設應用程式」設定\n2. 搜尋 .md\n3. 選擇「${name}」${devNote}`
  }
  const other = {
    message: '設定預設的 Markdown 程式',
    detail: `請在檔案管理員對 .md 檔案按右鍵 → 內容 → 以其他應用程式開啟 → 選擇「${name}」並設為預設。${devNote}`
  }
  const text = process.platform === 'darwin' ? mac : process.platform === 'win32' ? win : other
  const buttons = process.platform === 'win32' ? ['開啟設定', '關閉'] : ['好']
  const r = await dialog.showMessageBox({ type: 'info', ...text, buttons, defaultId: 0 })
  if (process.platform === 'win32' && r.response === 0) void shell.openExternal('ms-settings:defaultapps')
}

const devIcon = join(app.getAppPath(), 'build', 'icon.png')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    // Packaged builds carry the icon in the app itself (electron-builder reads build/icon.png).
    ...(app.isPackaged ? {} : { icon: devIcon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false
    }
  })

  rendererReady = false
  win.on('closed', () => {
    rendererReady = false
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// One window is enough: opening another file while running should reuse it.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv, cwd) => {
    const [path] = pathsFromArgv(argv, cwd)
    if (path) queueOpen(path)
    else BrowserWindow.getAllWindows()[0]?.focus()
  })

  // macOS delivers files through this event, possibly before the app is ready.
  app.on('open-file', (event, path) => {
    event.preventDefault()
    queueOpen(path)
  })

  app.whenReady().then(async () => {
    await migrateLegacyData()
    app.setAboutPanelOptions({ applicationName: app.name, applicationVersion: app.getVersion() })
    settings = await loadSettings()
    await saveSettings(settings) // persists a freshly generated token so copied client configs stay valid
    mcp = new McpController(() => settings.mcp, callRenderer)
    registerIpc()
    if (settings.mcp.enabled) await mcp.start()
    rebuildMenu()
    if (!app.isPackaged) app.dock?.setIcon(devIcon) // macOS shows Electron's own icon in dev otherwise

    const [launchPath] = pathsFromArgv(process.argv, process.cwd())
    if (launchPath) pendingOpen = launchPath
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('before-quit', () => {
  stopWatching()
  void mcp?.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
