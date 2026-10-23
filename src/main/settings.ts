import { app } from 'electron'
import { randomBytes } from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { isLanguageSetting, type LanguageSetting } from '../shared/i18n'

export interface McpSettings {
  /** The server only listens while this is on. Off by default. */
  enabled: boolean
  /** Without this the AI can read the document but not change it. */
  allowWrite: boolean
  /** Skip the diff review: the AI's edits are applied straight away. Only matters while `allowWrite` is on. */
  directWrite: boolean
  /** Bearer token clients must send. Stable across restarts so client configs keep working. */
  token: string
  port: number
}

export interface UpdateSettings {
  /** Look for a newer version shortly after start-up and every few hours. */
  autoCheck: boolean
  /** The newest version the user has closed the notice for; it only comes back for something newer. */
  dismissedVersion: string | null
}

export interface Settings {
  mcp: McpSettings
  updates: UpdateSettings
  /** `system` follows the computer's language; anything it does not support falls back to English. */
  language: LanguageSetting
}

export const newToken = (): string => randomBytes(24).toString('hex')

const file = (): string => join(app.getPath('userData'), 'settings.json')

export async function loadSettings(): Promise<Settings> {
  let saved: Partial<Settings> = {}
  try {
    saved = JSON.parse(await readFile(file(), 'utf-8'))
  } catch {
    /* first run, or an unreadable file: fall back to the defaults */
  }
  const mcp = { enabled: false, allowWrite: false, directWrite: false, token: '', port: 39217, ...saved.mcp }
  if (!mcp.token) mcp.token = newToken()
  const updates = { autoCheck: true, dismissedVersion: null, ...saved.updates }
  return { mcp, updates, language: isLanguageSetting(saved.language) ? saved.language : 'system' }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeFile(file(), JSON.stringify(settings, null, 2), { encoding: 'utf-8', mode: 0o600 })
}
