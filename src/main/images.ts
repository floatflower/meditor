import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, stat } from 'fs/promises'
import { dirname, extname, isAbsolute, join, relative, sep } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { IMAGE_EXTENSIONS } from '../shared/images'
import { t } from './i18n'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp'
}
const MAX_BYTES = 25 * 1024 * 1024
const MAX_PARENTS = 2

/** A path as it is written in Markdown: slashes, percent-encoded, and no bare parentheses. */
const encodePath = (path: string): string =>
  path
    .split('/')
    .map((part) => encodeURIComponent(part).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/')

/** How to refer to each file from the document: relative to it when it is saved, otherwise a file: URL. */
function markdownPaths(paths: string[], docPath: string | null): string[] {
  return paths.map((path) => {
    if (docPath) {
      const rel = relative(dirname(docPath), path)
      // A file far outside the document's folder reads better as a full URL than as ../../../..
      const up = rel.split(sep).filter((part) => part === '..').length
      if (rel && !isAbsolute(rel) && up <= MAX_PARENTS) {
        const posix = rel.split(sep).join('/')
        return encodePath(posix.startsWith('.') ? posix : `./${posix}`)
      }
    }
    return pathToFileURL(path).href
  })
}

/** The file an `<img src>` in the document points to, or null if it is not a local image. */
function resolveSrc(src: string, docPath: string | null): string | null {
  let path: string
  if (/^file:/i.test(src)) {
    try {
      path = fileURLToPath(src)
    } catch {
      return null
    }
  } else {
    let decoded = src.split(/[?#]/)[0]
    try {
      decoded = decodeURI(decoded)
    } catch {
      // keep it as written
    }
    if (isAbsolute(decoded)) path = decoded
    else if (docPath) path = join(dirname(docPath), decoded)
    else return null
  }
  return MIME[extname(path).toLowerCase()] ? path : null
}

export function registerImageIpc(): void {
  ipcMain.handle('images:pick', async (e) => {
    const parent = BrowserWindow.fromWebContents(e.sender)
    const options = {
      title: t('image.pickTitle'),
      properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[],
      filters: [{ name: t('image.filterName'), extensions: [...IMAGE_EXTENSIONS] }]
    }
    const r = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    return r.canceled ? [] : r.filePaths
  })

  ipcMain.handle('images:markdown', (_e, paths: string[], docPath: string | null) => markdownPaths(paths, docPath))

  // The renderer keeps what it has read, so it passes the modification time it knows and only gets the
  // bytes back when the file has changed since.
  ipcMain.handle('images:read', async (_e, src: string, docPath: string | null, knownMtime?: number) => {
    const path = resolveSrc(src, docPath)
    if (!path) return null
    try {
      const info = await stat(path)
      if (!info.isFile() || info.size > MAX_BYTES) return null
      if (info.mtimeMs === knownMtime) return { mtime: info.mtimeMs }
      return { mtime: info.mtimeMs, mime: MIME[extname(path).toLowerCase()], bytes: await readFile(path) }
    } catch {
      return null
    }
  })
}
