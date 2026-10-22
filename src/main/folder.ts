import { watch, type FSWatcher } from 'fs'
import { readdir, stat } from 'fs/promises'
import { basename, join } from 'path'

export interface TreeNode {
  name: string
  path: string
  dir: boolean
  /** Only on directories. */
  children?: TreeNode[]
}

export interface FolderScan {
  root: string
  name: string
  tree: TreeNode[]
  /** True when a limit was hit and some files are missing from the tree. */
  truncated: boolean
}

// Guards for pointing the app at something huge, such as a home directory.
const MAX_DEPTH = 20
const MAX_DIRECTORIES = 20000
const MAX_FILES = 5000

const MARKDOWN = /\.md$/i
const SKIPPED_DIRECTORIES = new Set(['node_modules'])

const compare = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

/** Directories before files, each in natural order (note2 before note10). */
const order = (a: TreeNode, b: TreeNode): number => (a.dir !== b.dir ? (a.dir ? -1 : 1) : compare(a.name, b.name))

/**
 * Every `.md` file under `root`, as a tree. Directories without any are left out, hidden entries
 * (a leading dot) and `node_modules` are skipped, and symbolic links to directories are not followed,
 * which keeps a link back to a parent from looping forever.
 */
export async function scanFolder(root: string): Promise<FolderScan> {
  const state = { directories: 0, files: 0, truncated: false }

  async function walk(dir: string, depth: number): Promise<TreeNode[]> {
    if (state.directories++ >= MAX_DIRECTORIES || depth > MAX_DEPTH) {
      state.truncated = true
      return []
    }
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    const nodes: TreeNode[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(entry.name)) continue
      const path = join(dir, entry.name)

      if (entry.isDirectory()) {
        const children = await walk(path, depth + 1)
        if (children.length) nodes.push({ name: entry.name, path, dir: true, children })
        continue
      }
      if (!MARKDOWN.test(entry.name)) continue
      // A link to a file is fine to show; only a link to a directory is a loop risk.
      const isFile = entry.isFile() || (entry.isSymbolicLink() && (await stat(path).catch(() => null))?.isFile())
      if (!isFile) continue
      if (state.files++ >= MAX_FILES) {
        state.truncated = true
        continue
      }
      nodes.push({ name: entry.name, path, dir: false })
    }
    return nodes.sort(order)
  }

  return { root, name: basename(root) || root, tree: await walk(root, 0), truncated: state.truncated }
}

let watcher: FSWatcher | null = null
let timer: NodeJS.Timeout | null = null

export function stopWatching(): void {
  watcher?.close()
  watcher = null
  if (timer) clearTimeout(timer)
  timer = null
}

/** Call `onChange` (debounced) when something under `root` is added, removed or renamed. */
export function watchFolder(root: string, onChange: () => void): void {
  stopWatching()
  try {
    watcher = watch(root, { recursive: true }, (_event, filename) => {
      const name = filename?.toString() ?? ''
      // Ignore churn inside folders the tree never shows.
      if (name.split(/[\\/]/).some((part) => part.startsWith('.') || SKIPPED_DIRECTORIES.has(part))) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(onChange, 400)
    })
    watcher.on('error', stopWatching)
  } catch {
    /* Watching is a convenience; the tree can still be refreshed by hand. */
  }
}
