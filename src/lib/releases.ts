export const REPO = { owner: 'floatflower', name: 'sheaf' }
export const REPO_URL = `https://github.com/${REPO.owner}/${REPO.name}`
export const RELEASES_URL = `${REPO_URL}/releases`

export type Platform = 'mac' | 'win' | 'linux'

export interface Download {
  platform: Platform
  /** What it is, e.g. "Apple Silicon", "Intel", "AppImage", ".deb", "Installer". */
  kind: 'arm64' | 'x64' | 'appimage' | 'deb' | 'installer'
  name: string
  url: string
  size: number
}

export interface Release {
  version: string
  date: string
  url: string
  prerelease: boolean
  downloads: Download[]
}

interface ApiAsset {
  name: string
  size: number
  browser_download_url: string
}
interface ApiRelease {
  tag_name: string
  html_url: string
  published_at: string
  prerelease: boolean
  draft: boolean
  assets: ApiAsset[]
}

/** The files CI uploads: Sheaf-<version>-<os>-<arch>.<ext>. Anything else (update metadata, blockmaps) is skipped. */
export function classify(asset: ApiAsset): Download | null {
  const { name } = asset
  let platform: Platform
  let kind: Download['kind']
  if (/\.dmg$/i.test(name)) {
    platform = 'mac'
    kind = /arm64/i.test(name) ? 'arm64' : 'x64'
  } else if (/\.exe$/i.test(name)) {
    platform = 'win'
    kind = 'installer'
  } else if (/\.AppImage$/i.test(name)) {
    platform = 'linux'
    kind = 'appimage'
  } else if (/\.deb$/i.test(name)) {
    platform = 'linux'
    kind = 'deb'
  } else {
    return null
  }
  return { platform, kind, name, url: asset.browser_download_url, size: asset.size }
}

export function parseRelease(r: ApiRelease): Release {
  return {
    version: r.tag_name.replace(/^v/, ''),
    date: r.published_at,
    url: r.html_url,
    prerelease: r.prerelease,
    downloads: r.assets.map(classify).filter((d): d is Download => d !== null)
  }
}

const API = `https://api.github.com/repos/${REPO.owner}/${REPO.name}/releases`
const CACHE_KEY = 'sheaf.release'
const CACHE_MS = 10 * 60 * 1000

async function get<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  return res.ok ? ((await res.json()) as T) : null
}

/**
 * The newest stable release, or the newest pre-release when there is no stable one yet. No token is needed for a
 * public repository, but anonymous requests are limited to 60 an hour per address, so the answer is kept for a while.
 */
export async function fetchRelease(): Promise<Release | null> {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null') as { at: number; release: Release } | null
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.release
  } catch {
    // no storage: just ask
  }
  try {
    let api = await get<ApiRelease>(`${API}/latest`)
    if (!api) api = ((await get<ApiRelease[]>(`${API}?per_page=10`)) ?? []).find((r) => !r.draft) ?? null
    if (!api) return null
    const release = parseRelease(api)
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release }))
    } catch {
      // not worth failing over
    }
    return release
  } catch {
    return null
  }
}

export interface Detected {
  platform: Platform | null
  arch: 'arm64' | 'x64' | null
}

/** Best effort: browsers do not say whether a Mac is Apple Silicon unless asked through userAgentData. */
export async function detectPlatform(): Promise<Detected> {
  const nav = navigator as Navigator & {
    userAgentData?: { platform: string; getHighEntropyValues: (hints: string[]) => Promise<{ architecture?: string }> }
  }
  const text = `${nav.userAgentData?.platform ?? ''} ${navigator.platform} ${navigator.userAgent}`
  if (/android|iphone|ipad|ipod/i.test(text)) return { platform: null, arch: null }
  const platform: Platform | null = /mac/i.test(text) ? 'mac' : /win/i.test(text) ? 'win' : /linux|x11|cros/i.test(text) ? 'linux' : null
  let arch: Detected['arch'] = null
  if (platform === 'mac') {
    try {
      const { architecture } = (await nav.userAgentData?.getHighEntropyValues(['architecture'])) ?? {}
      arch = architecture === 'x86' ? 'x64' : architecture === 'arm' ? 'arm64' : null
    } catch {
      // unknown
    }
  }
  return { platform, arch }
}

export const formatSize = (bytes: number): string => `${Math.round(bytes / 1024 / 1024)} MB`
