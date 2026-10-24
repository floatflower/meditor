// Plays the part of an AI client so the diff review can be tried without one:
//   1. start the app (npm run dev) and put a few lines in the open document
//   2. Edit → Settings… → AI tab: turn on "Enable MCP server" and "Allow AI to edit documents"
//   3. node scripts/demo-review.mjs
// The token is read from the app's own settings file; it is never printed.
//   --settings <file>   use another settings.json (for example a test profile)
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const arg = process.argv.indexOf('--settings')
const defaultPath = {
  darwin: join(homedir(), 'Library', 'Application Support', 'Sheaf', 'settings.json'),
  win32: join(process.env.APPDATA ?? '', 'Sheaf', 'settings.json')
}[process.platform] ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'Sheaf', 'settings.json')
const settingsPath = arg > -1 ? process.argv[arg + 1] : defaultPath

let mcp
try {
  mcp = JSON.parse(readFileSync(settingsPath, 'utf8')).mcp
} catch {
  console.error(`Could not read ${settingsPath}\nStart the app once first; it creates this file.`)
  process.exit(1)
}
if (!mcp?.enabled) {
  console.error('The MCP server is off. In the app: Edit → Settings… → AI → Enable MCP server.')
  process.exit(1)
}

const client = new Client({ name: 'demo-review', version: '1.0.0' })
try {
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcp.port}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${mcp.token}` } }
    })
  )
} catch (err) {
  console.error(`Could not connect to 127.0.0.1:${mcp.port}: ${err.message}\nIs the app running, with Settings → AI → Enable MCP server turned on?`)
  process.exit(1)
}

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args })
  const text = r.content?.[0]?.text ?? ''
  if (r.isError) throw new Error(text)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

try {
  const doc = await call('get_document')
  console.log(`Document: ${doc.name} (${doc.content.split('\n').length} lines)`)

  // Edit 1: touch the first non-empty line, if it is unique so the replacement is unambiguous.
  const first = doc.content.split('\n').find((l) => l.trim())
  if (first && doc.content.split(first).length === 2) {
    await call('replace_text', { find: first, replace: `${first} (edited by AI)` })
    console.log(`• changed a line:   "${first}"`)
  }
  // Edit 2: add a few lines at the end.
  await call('insert_text', { position: 'end', text: '\n\n## Added by the demo script\n- first new item\n- second new item' })
  console.log('• added 4 lines at the end')

  const after = await call('get_document')
  console.log(`\n${after.pendingReview} changes are waiting in the app: accept or reject them line by line,`)
  console.log('or use "Accept all" / "Reject all" in the bar above the editor.')
  console.log('Settings → AI → "Allow AI to write directly" skips the review.')
} catch (err) {
  console.error(`The app refused: ${err.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
