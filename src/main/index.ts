import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron'
import { join, basename, resolve } from 'path'
import { buildMenu, type MenuAction, type MenuActions } from './menu'
import { McpController } from './mcp'
import { scanFolder, stopWatching, watchFolder } from './folder'
import { loadSettings, newToken, saveSettings, type Settings } from './settings'
import { isLanguageSetting, resolveLanguage, type Lang } from '../shared/i18n'
import type { AiPatch, AiState } from '../shared/ai'
import { setMainLanguage, t } from './i18n'
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import { embedFonts, type FontKind } from './fonts'
import { writeHtmlWithAssets } from './exportHtml'
import { registerImageIpc } from './images'
import { UpdateController } from './updater'

const userDir = (sub: string): string => join(app.getPath('userData'), sub)

const SEEDS: Record<string, Record<string, string>> = {
  plugins: {},
  themes: {}
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

let settings: Settings
let mcp: McpController
let updater: UpdateController

// The app used to be called "mdeditor" and then "MEditor", and Electron keys its data folder on the app
// name. Carry the settings and extensions over to the new folder once. Safe to delete when no old
// build is around.
async function migrateLegacyData(): Promise<void> {
  const current = app.getPath('userData')
  const exists = (path: string): Promise<boolean> => access(path).then(() => true, () => false)
  if (await exists(join(current, 'settings.json'))) return
  let legacy = ''
  for (const name of ['MEditor', 'mdeditor']) {
    const dir = join(app.getPath('appData'), name)
    if (dir !== current && (await exists(join(dir, 'settings.json')))) {
      legacy = dir
      break
    }
  }
  if (!legacy) return
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

/** The language the app is actually shown in, given the setting and the computer's own languages. */
function currentLanguage(): Lang {
  return resolveLanguage(settings.language, app.getPreferredSystemLanguages())
}

function rebuildMenu(): void {
  Menu.setApplicationMenu(buildMenu(menuActions))
}

// --- AI (MCP) settings, driven from the Settings dialog ----------------------------------------

function aiState(): AiState {
  const { enabled, allowWrite, directWrite } = settings.mcp
  return { enabled, allowWrite, directWrite, ...mcp.status }
}

async function setAi(patch: AiPatch): Promise<AiState> {
  const wasEnabled = settings.mcp.enabled
  if (typeof patch.enabled === 'boolean') {
    settings.mcp.enabled = patch.enabled
    if (!patch.enabled) settings.mcp.allowWrite = false // nothing can be written while the server is off
  }
  // Switching write on while the server is off would be a setting that silently does nothing.
  if (typeof patch.allowWrite === 'boolean' && settings.mcp.enabled) settings.mcp.allowWrite = patch.allowWrite
  if (typeof patch.directWrite === 'boolean') settings.mcp.directWrite = patch.directWrite
  await saveSettings(settings)

  // Only turning the server on or off touches the connection; the other switches take effect live.
  if (settings.mcp.enabled && !wasEnabled) await mcp.start()
  else if (!settings.mcp.enabled && wasEnabled) await mcp.stop()
  return aiState()
}

const menuActions: MenuActions = {
  openFolder: async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (!r.canceled && r.filePaths[0]) sendToRenderer({ type: 'open-workspace', root: r.filePaths[0] })
  }
}

function registerIpc(): void {
  // The packaged app's version is whatever the build stamped into it: for a release, the git tag.
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
    name: app.name,
    platform: process.platform
  }))
  // Only Windows has a settings page to send the user to; macOS and Linux get written steps.
  ipcMain.handle('app:open-default-apps-settings', () => {
    if (process.platform === 'win32') return shell.openExternal('ms-settings:defaultapps')
  })

  ipcMain.handle('ai:get', () => aiState())
  ipcMain.handle('ai:set', (_e, patch: AiPatch) => setAi(patch ?? {}))
  ipcMain.handle('ai:copy-command', () => {
    clipboard.writeText(`claude mcp add --transport http folio ${mcpUrl()} --header "Authorization: Bearer ${settings.mcp.token}"`)
  })
  ipcMain.handle('ai:copy-json', () => {
    const config = { mcpServers: { folio: { type: 'http', url: mcpUrl(), headers: { Authorization: `Bearer ${settings.mcp.token}` } } } }
    clipboard.writeText(JSON.stringify(config, null, 2))
  })
  // The window asks the user first; the token is read live, so connected clients are simply refused from now on.
  ipcMain.handle('ai:regenerate-token', async () => {
    settings.mcp.token = newToken()
    await saveSettings(settings)
  })

  ipcMain.handle('language:get', () => ({ setting: settings.language, resolved: currentLanguage() }))

  ipcMain.handle('language:set', async (_e, setting: unknown) => {
    if (isLanguageSetting(setting)) {
      settings.language = setting
      await saveSettings(settings)
      setMainLanguage(currentLanguage())
      rebuildMenu() // the native menu is ours to relabel
    }
    return { setting: settings.language, resolved: currentLanguage() }
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

  registerImageIpc()

  ipcMain.handle('update:get', () => updater.current)
  ipcMain.handle('update:check', () => updater.check())
  ipcMain.handle('update:set-auto', (_e, value: boolean) => updater.setAuto(value))
  ipcMain.handle('update:dismiss', () => updater.dismiss())
  ipcMain.handle('update:open', () => updater.open())

  ipcMain.handle('fonts:embed', (_e, text: string, kinds: FontKind[]) => embedFonts(text, kinds))

  ipcMain.handle('export:html', async (_e, html: string) => {
    const r = await dialog.showSaveDialog({
      defaultPath: 'document.html',
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })
    if (r.canceled || !r.filePath) return false
    await writeFile(r.filePath, html, 'utf-8')
    return true
  })

  // The same page, with its images and fonts moved out into a folder beside it.
  ipcMain.handle('export:html-bundle', async (_e, html: string) => {
    const r = await dialog.showSaveDialog({
      defaultPath: 'document.html',
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })
    if (r.canceled || !r.filePath) return false
    await writeHtmlWithAssets(html, r.filePath, userDir('themes'))
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
    // Through a file: a data: URL is capped at about 2MB, which embedded fonts and KaTeX can exceed.
    const page = join(app.getPath('temp'), `folio-export-${process.pid}-${Date.now()}.html`)
    try {
      await writeFile(page, html, 'utf-8')
      await win.loadFile(page)
      const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true })
      await writeFile(r.filePath, pdf)
    } finally {
      win.destroy()
      await rm(page, { force: true })
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
    dialog.showErrorBox(t('dialog.openError'), `${path}\n${err instanceof Error ? err.message : String(err)}`)
  }
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

  // Dropping a file anywhere but a drop zone would otherwise open it in place of the app.
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:') && url !== win.webContents.getURL()) e.preventDefault()
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

  // Dark mode is not ready yet: stay light whatever the OS says.
  nativeTheme.themeSource = 'light'

  app.whenReady().then(async () => {
    await migrateLegacyData()
    app.setAboutPanelOptions({ applicationName: app.name, applicationVersion: app.getVersion() })
    settings = await loadSettings()
    setMainLanguage(currentLanguage())
    await saveSettings(settings) // persists a freshly generated token so copied client configs stay valid
    mcp = new McpController(() => settings.mcp, callRenderer)
    updater = new UpdateController(
      () => settings.updates,
      async (patch) => {
        Object.assign(settings.updates, patch)
        await saveSettings(settings)
      },
      (state) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('update:state', state))
    )
    registerIpc()
    if (settings.mcp.enabled) await mcp.start()
    rebuildMenu()
    updater.start()
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
  updater?.stop()
  stopWatching()
  void mcp?.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
