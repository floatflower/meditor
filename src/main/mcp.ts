import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import type { McpSettings } from './settings'
import { t } from './i18n'

/** Ask the editor window to do something; resolves with its answer or rejects with its error. */
export type CallRenderer = (method: string, args?: unknown) => Promise<unknown>

export interface McpStatus {
  running: boolean
  port: number
  error?: string
}

const MAX_BODY = 1024 * 1024

const text = (value: unknown): { content: { type: 'text'; text: string }[] } => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
})

const failure = (message: string): { isError: true; content: { type: 'text'; text: string }[] } => ({
  isError: true,
  content: [{ type: 'text', text: message }]
})

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** A fresh server per request (stateless mode): the editor is the only state there is. */
function buildServer(settings: () => McpSettings, call: CallRenderer): McpServer {
  const server = new McpServer({ name: 'meditor', version: '0.1.0' })

  // Run a renderer call and turn its failure into a tool error the model can read and react to.
  const run = async (method: string, args?: unknown): Promise<ReturnType<typeof text> | ReturnType<typeof failure>> => {
    try {
      return text(await call(method, args))
    } catch (err) {
      return failure(err instanceof Error ? err.message : String(err))
    }
  }
  const needsWrite = (): ReturnType<typeof failure> | null =>
    settings().allowWrite ? null : failure(t('mcp.writeDenied', { menu: `${t('menu.edit')} → ${t('settings.title')} → ${t('settings.tabs.ai')}`, item: t('settings.ai.allowWrite') }))

  server.registerTool(
    'get_syntax_guide',
    {
      title: '取得語法指南',
      description:
        '回傳這個編輯器支援的 Markdown 語法，包含自訂區塊（提示框、圖表、數學公式、mermaid、換頁符等）的正確寫法。寫入文件之前先呼叫一次。',
      annotations: { readOnlyHint: true }
    },
    () => run('get_syntax_guide')
  )

  server.registerTool(
    'get_document',
    {
      title: '讀取目前文件',
      description: '回傳使用者正在編輯的文件：檔名、路徑、是否有未儲存變更、完整內容，以及游標位置與選取的文字。',
      annotations: { readOnlyHint: true }
    },
    () => run('get_document')
  )

  server.registerTool(
    'get_render_errors',
    {
      title: '取得渲染錯誤',
      description:
        '等預覽渲染完成後，回傳目前文件裡渲染失敗的區塊（圖表設定錯誤、mermaid 語法錯誤、LaTeX 公式錯誤），含錯誤訊息與原始內容。修改文件後呼叫它來檢查結果。',
      annotations: { readOnlyHint: true }
    },
    () => run('get_render_errors')
  )

  server.registerTool(
    'replace_text',
    {
      title: '取代文字',
      description:
        '在文件中把 find 這段文字換成 replace。find 必須與文件內容逐字相同；預設要求只出現一次，出現多次會回傳錯誤與次數，請加長 find 讓它唯一，或設 replaceAll。整個動作在編輯器裡是一次可還原的操作。除非使用者開啟「直接寫入」，修改會以差異比較顯示，讓使用者逐行接受或拒絕，所以請讓每次修改專注、範圍小。',
      inputSchema: {
        find: z.string().min(1).describe('要被取代的原文，逐字相同'),
        replace: z.string().describe('取代後的文字，可為空字串（等於刪除）'),
        replaceAll: z.boolean().optional().describe('是否取代所有出現的位置，預設 false')
      },
      annotations: { destructiveHint: true, idempotentHint: false }
    },
    async (args) => needsWrite() ?? run('replace_text', { ...args, review: !settings().directWrite })
  )

  server.registerTool(
    'insert_text',
    {
      title: '插入文字',
      description:
        '在文件的游標處、開頭或結尾插入文字。整個動作在編輯器裡是一次可還原的操作。區塊（標題、表格、圖表等）前後請自行帶上空行。除非使用者開啟「直接寫入」，修改會以差異比較顯示，讓使用者逐行接受或拒絕。',
      inputSchema: {
        text: z.string().min(1).describe('要插入的文字'),
        position: z.enum(['cursor', 'start', 'end']).describe('插入位置')
      },
      annotations: { destructiveHint: false, idempotentHint: false }
    },
    async (args) => needsWrite() ?? run('insert_text', { ...args, review: !settings().directWrite })
  )

  return server
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('request too large'))
        req.destroy()
      } else {
        chunks.push(chunk)
      }
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')))
      } catch {
        reject(new Error('invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function reply(res: ServerResponse, status: number, message: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers })
  res.end(message)
}

export class McpController {
  private http: Server | null = null
  status: McpStatus = { running: false, port: 0 }

  constructor(
    private settings: () => McpSettings,
    private call: CallRenderer
  ) {}

  async start(): Promise<void> {
    await this.stop()
    const { port } = this.settings()
    const server = createServer((req, res) => void this.handle(req, res, port))
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        // Loopback only: nothing outside this machine can reach it.
        server.listen(port, '127.0.0.1', () => resolve())
      })
      this.http = server
      this.status = { running: true, port }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      this.status = {
        running: false,
        port,
        error: code === 'EADDRINUSE' ? `連接埠 ${port} 已被占用` : err instanceof Error ? err.message : String(err)
      }
    }
  }

  async stop(): Promise<void> {
    const server = this.http
    this.http = null
    this.status = { running: false, port: this.settings().port }
    if (server) {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }

  private async handle(req: IncomingMessage, res: ServerResponse, port: number): Promise<void> {
    try {
      if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') return reply(res, 404, 'Not found')

      // A web page can make the browser call 127.0.0.1 too. Browsers always send Origin and a
      // matching Host is required, so both cases are rejected before the token is even looked at.
      const host = req.headers.host ?? ''
      if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return reply(res, 403, 'Forbidden host')
      if (req.headers.origin) return reply(res, 403, 'Forbidden origin')

      const { token } = this.settings()
      if (!safeEqual(req.headers.authorization ?? '', `Bearer ${token}`)) {
        return reply(res, 401, 'Unauthorized', { 'WWW-Authenticate': 'Bearer' })
      }
      if (req.method !== 'POST') return reply(res, 405, 'Method not allowed', { Allow: 'POST' })

      const body = await readBody(req)
      const server = buildServer(this.settings, this.call)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req, res, body)
    } catch (err) {
      if (!res.headersSent) reply(res, 400, err instanceof Error ? err.message : 'Bad request')
      else res.end()
    }
  }
}
