import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { t } from './i18n'

export type MenuAction =
  | { type: 'new' | 'open' | 'save' | 'save-as' | 'export-html' | 'export-pdf' }
  | { type: 'close-tab' }
  | { type: 'open-settings' }
  | { type: 'notice'; text: string }
  | { type: 'open-external'; path: string; name: string; content: string }
  | { type: 'open-workspace'; root: string }
  | { type: 'close-workspace' }
  | { type: 'workspace-changed' }

function send(action: MenuAction): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('menu:action', action)
}

/** What these menu items do. They run in the main process, so the menu does not message the editor. */
export interface MenuActions {
  openFolder: () => void
}

export function buildMenu(actions: MenuActions): Menu {
  const isMac = process.platform === 'darwin'

  const file: MenuItemConstructorOptions = {
    label: t('menu.file'),
    submenu: [
      { label: t('menu.newFile'), accelerator: 'CmdOrCtrl+N', click: () => send({ type: 'new' }) },
      { label: t('menu.open'), accelerator: 'CmdOrCtrl+O', click: () => send({ type: 'open' }) },
      { label: t('menu.openFolder'), accelerator: 'CmdOrCtrl+Shift+O', click: () => actions.openFolder() },
      { label: t('menu.closeFolder'), click: () => send({ type: 'close-workspace' }) },
      { label: t('menu.closeTab'), accelerator: 'CmdOrCtrl+W', click: () => send({ type: 'close-tab' }) },
      { type: 'separator' },
      { label: t('menu.save'), accelerator: 'CmdOrCtrl+S', click: () => send({ type: 'save' }) },
      { label: t('menu.saveAs'), accelerator: 'CmdOrCtrl+Shift+S', click: () => send({ type: 'save-as' }) },
      { type: 'separator' },
      {
        label: t('menu.export'),
        submenu: [
          { label: 'PDF', click: () => send({ type: 'export-pdf' }) },
          { label: 'HTML', click: () => send({ type: 'export-html' }) }
        ]
      },
      ...(isMac ? [] : ([{ type: 'separator' }, { role: 'quit' }] as MenuItemConstructorOptions[]))
    ]
  }

  // Electron's role menus carry hard-coded English labels (they do not follow the locale), so each
  // item gets an explicit label. The `role` still provides the behaviour and the shortcut.
  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: t('menu.about', { name: app.name }) },
      { type: 'separator' },
      { role: 'services', label: t('menu.services') },
      { type: 'separator' },
      { role: 'hide', label: t('menu.hide', { name: app.name }) },
      { role: 'hideOthers', label: t('menu.hideOthers') },
      { role: 'unhide', label: t('menu.showAll') },
      { type: 'separator' },
      { role: 'quit', label: t('menu.quit', { name: app.name }) }
    ]
  }

  const edit: MenuItemConstructorOptions = {
    label: t('menu.edit'),
    submenu: [
      { role: 'undo', label: t('menu.undo') },
      { role: 'redo', label: t('menu.redo') },
      { type: 'separator' },
      { role: 'cut', label: t('menu.cut') },
      { role: 'copy', label: t('menu.copy') },
      { role: 'paste', label: t('menu.paste') },
      { role: 'pasteAndMatchStyle', label: t('menu.pasteMatch') },
      { role: 'delete', label: t('menu.delete') },
      { role: 'selectAll', label: t('menu.selectAll') },
      { type: 'separator' },
      { label: t('menu.settings'), accelerator: 'CmdOrCtrl+,', click: () => send({ type: 'open-settings' }) }
    ]
  }

  const view: MenuItemConstructorOptions = {
    label: t('menu.view'),
    submenu: [
      // Reload and DevTools are for development only.
      ...(app.isPackaged
        ? []
        : ([
            { role: 'reload', label: t('menu.reloadPage') },
            { role: 'forceReload', label: t('menu.forceReload') },
            { role: 'toggleDevTools', label: t('menu.devTools') },
            { type: 'separator' }
          ] as MenuItemConstructorOptions[])),
      { role: 'resetZoom', label: t('menu.actualSize') },
      { role: 'zoomIn', label: t('menu.zoomIn') },
      { role: 'zoomOut', label: t('menu.zoomOut') },
      { type: 'separator' },
      { role: 'togglefullscreen', label: t('menu.fullScreen') }
    ]
  }

  const windowMenu: MenuItemConstructorOptions = {
    label: t('menu.window'),
    role: 'windowMenu',
    submenu: [
      { role: 'minimize', label: t('menu.minimize') },
      { role: 'zoom', label: t('menu.zoom') },
      ...(isMac
        ? ([{ type: 'separator' }, { role: 'front', label: t('menu.front') }] as MenuItemConstructorOptions[])
        : ([{ role: 'close', label: t('menu.closeWindow') }] as MenuItemConstructorOptions[]))
    ]
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : []),
    file,
    edit,
    view,
    windowMenu
  ]
  return Menu.buildFromTemplate(template)
}
