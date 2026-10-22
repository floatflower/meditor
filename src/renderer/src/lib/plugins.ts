import type { MdPlugin } from './markdown'
import { builtinPlugins } from '@/builtin'

export interface PluginEntry {
  /** Stable id used to remember the enabled state: the file name, or `builtin:<name>`. */
  file: string
  /** Display name. */
  name: string
  builtin?: boolean
  enabled: boolean
  /** Only set for enabled plugins that loaded successfully. */
  plugin?: MdPlugin
  error?: string
}

/**
 * Read every plugin file and load the enabled ones (ES modules whose default export is an MdPlugin).
 * Disabled plugins are listed but never imported, so their code does not run.
 */
export async function loadPlugins(disabled: ReadonlySet<string>): Promise<PluginEntry[]> {
  const entries: PluginEntry[] = builtinPlugins.map(({ id, plugin }) => ({
    file: id,
    name: plugin.name,
    builtin: true,
    enabled: !disabled.has(id),
    plugin: disabled.has(id) ? undefined : plugin
  }))
  for (const { name: file, code } of await window.api.listPlugins()) {
    const name = file.replace(/\.js$/, '')
    if (disabled.has(file)) {
      entries.push({ file, name, enabled: false })
      continue
    }
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    try {
      const mod = await import(/* @vite-ignore */ url)
      const plugin = mod.default as MdPlugin | undefined
      if (!plugin || typeof plugin !== 'object') throw new Error('沒有 default export 的 plugin 物件')
      entries.push({ file, name, enabled: true, plugin: { ...plugin, name: plugin.name ?? file } })
    } catch (err) {
      entries.push({ file, name, enabled: true, error: err instanceof Error ? err.message : String(err) })
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  return entries
}
