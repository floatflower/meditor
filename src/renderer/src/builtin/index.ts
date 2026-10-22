import type { MdPlugin } from '@/lib/markdown'
import { chartPlugin } from './chart'
import { mathPlugin } from './math'
import { mermaidPlugin } from './mermaid'
import { todoPlugin } from './todo'

/** Plugins that ship with the app. Enabled by default; the user can switch them off in 插件. */
export const builtinPlugins: { id: string; plugin: MdPlugin }[] = [
  { id: 'builtin:mermaid', plugin: mermaidPlugin },
  { id: 'builtin:math', plugin: mathPlugin },
  { id: 'builtin:chart', plugin: chartPlugin },
  { id: 'builtin:todo', plugin: todoPlugin }
]
