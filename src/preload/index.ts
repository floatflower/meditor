import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { MenuAction } from '../main/menu'
import type { AiPatch, AiState } from '../shared/ai'
import type { FolderScan } from '../main/folder'
import type { Lang, LanguageSetting } from '../shared/i18n'

const api = {
  pickImages: () => ipcRenderer.invoke('images:pick') as Promise<string[]>,
  imageMarkdown: (paths: string[], docPath: string | null) => ipcRenderer.invoke('images:markdown', paths, docPath) as Promise<string[]>,
  readImage: (src: string, docPath: string | null, knownMtime?: number) =>
    ipcRenderer.invoke('images:read', src, docPath, knownMtime) as Promise<{ mtime: number; mime?: string; bytes?: Uint8Array } | null>,
  /** The path of a file the user dropped (File objects no longer carry it themselves). */
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (path: string | null, content: string) => ipcRenderer.invoke('file:save', path, content),
  embedFonts: (text: string, kinds: ('sans' | 'serif')[]) => ipcRenderer.invoke('fonts:embed', text, kinds) as Promise<string>,
  exportHtml: (html: string) => ipcRenderer.invoke('export:html', html),
  exportPdf: (html: string) => ipcRenderer.invoke('export:pdf', html),
  listThemes: () => ipcRenderer.invoke('themes:list'),
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  userPaths: () => ipcRenderer.invoke('paths:user'),
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
  scanFolder: (root: string): Promise<FolderScan> => ipcRenderer.invoke('folder:scan', root),
  stopWatchingFolder: () => ipcRenderer.send('folder:unwatch'),
  readFile: (path: string): Promise<{ path: string; name: string; content: string }> =>
    ipcRenderer.invoke('file:read', path),
  getAppInfo: (): Promise<{ version: string; packaged: boolean; name: string; platform: string }> => ipcRenderer.invoke('app:info'),
  openDefaultAppsSettings: (): Promise<void> => ipcRenderer.invoke('app:open-default-apps-settings'),
  getAi: (): Promise<AiState> => ipcRenderer.invoke('ai:get'),
  setAi: (patch: AiPatch): Promise<AiState> => ipcRenderer.invoke('ai:set', patch),
  copyAiCommand: (): Promise<void> => ipcRenderer.invoke('ai:copy-command'),
  copyAiJson: (): Promise<void> => ipcRenderer.invoke('ai:copy-json'),
  regenerateAiToken: (): Promise<void> => ipcRenderer.invoke('ai:regenerate-token'),
  getLanguage: (): Promise<{ setting: LanguageSetting; resolved: Lang }> => ipcRenderer.invoke('language:get'),
  setLanguage: (setting: LanguageSetting): Promise<{ setting: LanguageSetting; resolved: Lang }> =>
    ipcRenderer.invoke('language:set', setting),
  openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
