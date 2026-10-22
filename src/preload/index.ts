import { contextBridge, ipcRenderer } from 'electron'
import type { MenuAction, MenuState } from '../main/menu'

const api = {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (path: string | null, content: string) => ipcRenderer.invoke('file:save', path, content),
  exportHtml: (html: string) => ipcRenderer.invoke('export:html', html),
  exportPdf: (html: string) => ipcRenderer.invoke('export:pdf', html),
  listThemes: () => ipcRenderer.invoke('themes:list'),
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  userPaths: () => ipcRenderer.invoke('paths:user'),
  setMenuState: (state: MenuState) => ipcRenderer.send('menu:state', state),
  onMenuAction: (cb: (action: MenuAction) => void) => {
    const handler = (_e: unknown, action: MenuAction): void => cb(action)
    ipcRenderer.on('menu:action', handler)
    return () => {
      ipcRenderer.off('menu:action', handler)
    }
  },
  onMcpRequest: (cb: (request: { id: number; method: string; args: unknown }) => void) => {
    const handler = (_e: unknown, request: { id: number; method: string; args: unknown }): void => cb(request)
    ipcRenderer.on('mcp:request', handler)
    return () => {
      ipcRenderer.off('mcp:request', handler)
    }
  },
  mcpRespond: (id: number, payload: { result?: unknown; error?: string }) =>
    ipcRenderer.send('mcp:response', id, payload),
  /** Tell the main process the menu/request listeners are registered, so queued files can be delivered. */
  rendererReady: () => ipcRenderer.send('renderer:ready'),
  openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
