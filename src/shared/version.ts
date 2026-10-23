interface Parsed {
  core: number[]
  pre: string[]
}

function parse(version: string): Parsed | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(version.trim())
  return m ? { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split('.') : [] } : null
}

export const isValidVersion = (version: string): boolean => parse(version) !== null

/** True for 1.2.3-rc.1 and the like. */
export const isPrerelease = (version: string): boolean => (parse(version)?.pre.length ?? 0) > 0

/**
 * Semantic-version order: negative when `a` is older than `b`. A pre-release comes before its release
 * (0.0.2-rc5 < 0.0.2), and its dot-separated parts compare as numbers when both are numbers, as text otherwise.
 */
export function compareVersions(a: string, b: string): number {
  const x = parse(a)
  const y = parse(b)
  if (!x || !y) throw new Error(`not a version: ${!x ? a : b}`)
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] < y.core[i] ? -1 : 1
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i]
    const q = y.pre[i]
    if (p === undefined) return -1
    if (q === undefined) return 1
    if (p === q) continue
    const pn = /^\d+$/.test(p)
    const qn = /^\d+$/.test(q)
    if (pn && qn) return Number(p) < Number(q) ? -1 : 1
    if (pn !== qn) return pn ? -1 : 1 // numbers come before text
    return p < q ? -1 : 1
  }
  return 0
}

export interface ApiRelease {
  tag_name: string
  html_url: string
  draft: boolean
  prerelease: boolean
}

/**
 * The newest release that is newer than `current`, or null. Someone on a stable version is only told about stable
 * releases; someone trying a pre-release is told about pre-releases too, since those are what they follow.
 */
export function newerRelease(releases: ApiRelease[], current: string): { version: string; url: string } | null {
  const wantPre = isPrerelease(current)
  let best: { version: string; url: string } | null = null
  for (const r of releases) {
    const version = r.tag_name?.replace(/^v/, '')
    if (r.draft || !version || !isValidVersion(version)) continue
    if (r.prerelease && !wantPre) continue
    if (compareVersions(version, current) <= 0) continue
    if (!best || compareVersions(version, best.version) > 0) best = { version, url: r.html_url }
  }
  return best
}

