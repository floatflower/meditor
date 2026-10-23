import { app, net, shell } from 'electron'
import { compareVersions, newerRelease, type ApiRelease } from '../shared/version'
import type { UpdateState } from '../shared/update'

/** Where "a new version" leads: the product page, whose download section lists the newest installers. */
const DOWNLOAD_PAGE = 'https://meditor.floatflower.me/#download'
const FIRST_CHECK_MS = 20 * 1000
const EVERY_MS = 6 * 60 * 60 * 1000

/**
 * Where the list of releases comes from: GitHub's, for the public repository. The API needs no token for that, and
 * allows 60 requests an hour from one address, far more than a check every few hours uses. The variables below
 * exist to try the feature without a real release: point the first at any URL that returns the same JSON, and the
 * second turns "open the page" into a log line.
 */
const API = process.env.MEDITOR_UPDATE_URL ?? 'https://api.github.com/repos/floatflower/meditor/releases?per_page=20'
const NO_OPEN = process.env.MEDITOR_UPDATE_NO_OPEN === '1'

export class UpdateController {
  private state: UpdateState
  private timer: ReturnType<typeof setInterval> | undefined
  private checking = false

  constructor(
    private readonly settings: () => { autoCheck: boolean; dismissedVersion: string | null },
    private readonly save: (patch: { autoCheck?: boolean; dismissedVersion?: string }) => Promise<void>,
    private readonly publish: (state: UpdateState) => void
  ) {
    this.state = {
      // A development build is not a release, so there is nothing for it to compare against.
      status: app.isPackaged || process.env.MEDITOR_UPDATE_URL ? 'idle' : 'unsupported',
      currentVersion: app.getVersion(),
      autoCheck: settings().autoCheck,
      notice: false
    }
  }

  get current(): UpdateState {
    return this.state
  }

  /** Check shortly after start-up, then every few hours, for as long as the setting is on. */
  start(): void {
    if (this.state.status === 'unsupported') return
    setTimeout(() => this.settings().autoCheck && void this.check(), FIRST_CHECK_MS)
    this.timer = setInterval(() => this.settings().autoCheck && void this.check(), EVERY_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async check(): Promise<void> {
    if (this.state.status === 'unsupported' || this.checking) return
    this.checking = true
    this.set({ status: 'checking', error: undefined })
    try {
      // Always ask: a cached answer would hide a new release for as long as the cache holds it.
      const res = await net.fetch(API, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MEditor' } })
      if (!res.ok) throw new Error(`GitHub answered ${res.status}`)
      const found = newerRelease((await res.json()) as ApiRelease[], this.state.currentVersion)
      if (!found) {
        this.set({ status: 'up-to-date', version: undefined, notice: false })
        return
      }
      const dismissed = this.settings().dismissedVersion
      this.set({
        status: 'available',
        version: found.version,
        // Closed once means closed until something newer than that comes along.
        notice: !dismissed || compareVersions(found.version, dismissed) > 0
      })
    } catch (err) {
      this.set({ status: 'error', error: String((err as Error)?.message ?? err).split('\n')[0].slice(0, 200), notice: false })
    } finally {
      this.checking = false
    }
  }

  /** Close the notice for good (for this version). */
  async dismiss(): Promise<void> {
    if (this.state.version) await this.save({ dismissedVersion: this.state.version })
    this.set({ notice: false })
  }

  /** Open the download page in the browser. Looking at it counts as seeing the notice, so it is dismissed too. */
  async open(): Promise<void> {
    if (!this.state.version) return
    if (NO_OPEN) console.log(`[update] would open ${DOWNLOAD_PAGE}`)
    else await shell.openExternal(DOWNLOAD_PAGE)
    await this.dismiss()
  }

  async setAuto(value: boolean): Promise<void> {
    await this.save({ autoCheck: value })
    this.set({ autoCheck: value })
  }

  private set(patch: Partial<UpdateState>): void {
    this.state = { ...this.state, ...patch }
    this.publish(this.state)
  }
}
