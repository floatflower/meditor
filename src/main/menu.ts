import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'

export interface PluginMenuItem {
  /** File name, the stable id used to persist the enabled state. */
  file: string
  name: string
  /** Ships with the app. */
  builtin?: boolean
  enabled: boolean
  /** Set when an enabled plugin failed to load. */
  error?: string
}

export interface MenuState {
  themes: string[]
  currentTheme: string
  plugins: PluginMenuItem[]
}

export type MenuAction =
  | { type: 'new' | 'open' | 'save' | 'save-as' | 'export-html' | 'export-pdf' }
  | { type: 'theme'; name: string }
  | { type: 'plugin-toggle'; file: string; enabled: boolean }
  | { type: 'reload-extensions' }
  | { type: 'notice'; text: string }
  | { type: 'open-external'; path: string; name: string; content: string }
  | { type: 'open-folder'; kind: 'themes' | 'plugins' }

function send(action: MenuAction): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('menu:action', action)
}

export interface AiMenuState {
  enabled: boolean
  allowWrite: boolean
  running: boolean
  port: number
  error?: string
}

/** What these menu items do. They run in the main process, so the menu does not message the editor. */
export interface MenuActions {
  setAsDefault: () => void
  toggleEnabled: (enabled: boolean) => void
  toggleWrite: (allow: boolean) => void
  copyCommand: () => void
  copyJson: () => void
  regenerateToken: () => void
}

export function buildMenu(state: MenuState, ai: AiMenuState, actions: MenuActions): Menu {
  const isMac = process.platform === 'darwin'

  const file: MenuItemConstructorOptions = {
    label: '檔案',
    submenu: [
      { label: '開新檔案', accelerator: 'CmdOrCtrl+N', click: () => send({ type: 'new' }) },
      { label: '開啟…', accelerator: 'CmdOrCtrl+O', click: () => send({ type: 'open' }) },
      { type: 'separator' },
      { label: '儲存', accelerator: 'CmdOrCtrl+S', click: () => send({ type: 'save' }) },
      { label: '另存新檔…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send({ type: 'save-as' }) },
      { type: 'separator' },
      {
        label: '匯出',
        submenu: [
          { label: 'PDF', click: () => send({ type: 'export-pdf' }) },
          { label: 'HTML', click: () => send({ type: 'export-html' }) }
        ]
      },
      { type: 'separator' },
      { label: '設為預設的 Markdown 程式…', click: () => actions.setAsDefault() },
      ...(isMac ? [] : ([{ type: 'separator' }, { role: 'quit' }] as MenuItemConstructorOptions[]))
    ]
  }

  const appearance: MenuItemConstructorOptions = {
    label: '外觀',
    submenu: [
      ...state.themes.map(
        (name): MenuItemConstructorOptions => ({
          label: name,
          type: 'radio',
          checked: name === state.currentTheme,
          click: () => send({ type: 'theme', name })
        })
      ),
      { type: 'separator' },
      { label: '開啟外觀資料夾', click: () => send({ type: 'open-folder', kind: 'themes' }) },
      { label: '重新載入', click: () => send({ type: 'reload-extensions' }) }
    ]
  }

  const pluginItem = (p: PluginMenuItem): MenuItemConstructorOptions => ({
    label: p.name + (p.enabled ? '' : '（已停用）'),
    submenu: [
      {
        label: '啟用',
        type: 'checkbox',
        checked: p.enabled,
        click: (menuItem) => send({ type: 'plugin-toggle', file: p.file, enabled: menuItem.checked })
      },
      ...(p.error
        ? ([{ type: 'separator' }, { label: `載入失敗：${p.error}`, enabled: false }] as MenuItemConstructorOptions[])
        : [])
    ]
  })
  const bundled = state.plugins.filter((p) => p.builtin)
  const custom = state.plugins.filter((p) => !p.builtin)

  // Two blocks: the plugins that ship with the app, then the user's own.
  const plugins: MenuItemConstructorOptions = {
    label: '插件',
    submenu: [
      ...bundled.map(pluginItem),
      { type: 'separator' },
      ...(custom.length
        ? custom.map(pluginItem)
        : ([{ label: '（尚未安裝自訂插件）', enabled: false }] as MenuItemConstructorOptions[])),
      { type: 'separator' },
      { label: '開啟插件資料夾', click: () => send({ type: 'open-folder', kind: 'plugins' }) },
      { label: '重新載入', click: () => send({ type: 'reload-extensions' }) }
    ]
  }

  const aiStatus = ai.error
    ? `無法啟動：${ai.error}`
    : ai.running
      ? `執行中：127.0.0.1:${ai.port}`
      : '未啟用'
  const aiMenu: MenuItemConstructorOptions = {
    label: 'AI',
    submenu: [
      { label: aiStatus, enabled: false },
      { type: 'separator' },
      {
        label: '啟用 MCP 伺服器',
        type: 'checkbox',
        checked: ai.enabled,
        click: (item) => actions.toggleEnabled(item.checked)
      },
      {
        label: '允許 AI 修改文件',
        type: 'checkbox',
        checked: ai.allowWrite,
        enabled: ai.enabled,
        click: (item) => actions.toggleWrite(item.checked)
      },
      { type: 'separator' },
      { label: '複製 Claude Code 連線指令', enabled: ai.running, click: actions.copyCommand },
      { label: '複製 MCP 連線設定（JSON）', enabled: ai.running, click: actions.copyJson },
      { type: 'separator' },
      { label: '重新產生連線 token…', click: actions.regenerateToken }
    ]
  }

  // Electron's role menus carry hard-coded English labels (they do not follow the locale), so each
  // item gets an explicit label. The `role` still provides the behaviour and the shortcut.
  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: `關於 ${app.name}` },
      { type: 'separator' },
      { role: 'services', label: '服務' },
      { type: 'separator' },
      { role: 'hide', label: `隱藏 ${app.name}` },
      { role: 'hideOthers', label: '隱藏其他' },
      { role: 'unhide', label: '全部顯示' },
      { type: 'separator' },
      { role: 'quit', label: `結束 ${app.name}` }
    ]
  }

  const edit: MenuItemConstructorOptions = {
    label: '編輯',
    submenu: [
      { role: 'undo', label: '還原' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪下' },
      { role: 'copy', label: '拷貝' },
      { role: 'paste', label: '貼上' },
      { role: 'pasteAndMatchStyle', label: '貼上並符合樣式' },
      { role: 'delete', label: '刪除' },
      { role: 'selectAll', label: '全選' }
    ]
  }

  const view: MenuItemConstructorOptions = {
    label: '檢視',
    submenu: [
      // Reload and DevTools are for development only.
      ...(app.isPackaged
        ? []
        : ([
            { role: 'reload', label: '重新載入頁面' },
            { role: 'forceReload', label: '強制重新載入' },
            { role: 'toggleDevTools', label: '開發者工具' },
            { type: 'separator' }
          ] as MenuItemConstructorOptions[])),
      { role: 'resetZoom', label: '實際大小' },
      { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '縮小' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: '切換全螢幕' }
    ]
  }

  const windowMenu: MenuItemConstructorOptions = {
    label: '視窗',
    role: 'windowMenu',
    submenu: [
      { role: 'minimize', label: '最小化' },
      { role: 'zoom', label: '縮放' },
      ...(isMac
        ? ([{ type: 'separator' }, { role: 'front', label: '全部移至最上層' }] as MenuItemConstructorOptions[])
        : ([{ role: 'close', label: '關閉視窗' }] as MenuItemConstructorOptions[]))
    ]
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : []),
    file,
    edit,
    appearance,
    plugins,
    aiMenu,
    view,
    windowMenu
  ]
  return Menu.buildFromTemplate(template)
}
