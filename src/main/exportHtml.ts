import { createHash } from 'crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'

const IMAGE_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'image/bmp': '.bmp'
}
const FONT_EXT: Record<string, string> = {
  'font/woff2': '.woff2',
  'font/woff': '.woff',
  'font/ttf': '.ttf',
  'font/otf': '.otf',
  'application/font-woff2': '.woff2',
  'application/font-woff': '.woff'
}
const FONT_FILE = /\.(woff2?|ttf|otf)$/i

const hash = (data: Buffer): string => createHash('sha256').update(data).digest('hex').slice(0, 8)
const safeName = (name: string): string => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'file'
const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'font'
const encodeSegment = (s: string): string => encodeURIComponent(s).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

const DATA_URI = /^data:([^;,]+);base64,(.*)$/s

/**
 * Writes `html` to `htmlPath`, moving what the renderer embedded out into files beside it: images and fonts
 * become `<name>_files/images/…` and `<name>_files/fonts/…`, and the page links to them by relative path.
 * Links to the web are left alone. Nothing is created when there is nothing to move.
 *
 * `themesDir` is where a custom theme's relative `url(...)` is resolved from.
 */
export async function writeHtmlWithAssets(html: string, htmlPath: string, themesDir: string): Promise<void> {
  const folder = `${basename(htmlPath, extname(htmlPath))}_files`
  const root = join(dirname(htmlPath), folder)
  const urlFor = (kind: 'images' | 'fonts', file: string): string => `${encodeSegment(folder)}/${kind}/${encodeSegment(file)}`

  // What this export has put in each folder, so two different files never share a name.
  const taken = { images: new Map<string, string>(), fonts: new Map<string, string>() }
  const writes: { path: string; data?: Buffer; from?: string }[] = []

  function place(kind: 'images' | 'fonts', wanted: string, digest: string, write: { data?: Buffer; from?: string }): string {
    let file = wanted
    const owner = taken[kind].get(file)
    if (owner !== undefined && owner !== digest) {
      const ext = extname(wanted)
      file = `${wanted.slice(0, wanted.length - ext.length)}-${digest}${ext}`
    }
    if (!taken[kind].has(file)) {
      taken[kind].set(file, digest)
      writes.push({ path: join(root, kind, file), ...write })
    }
    return urlFor(kind, file)
  }

  // <img src="data:…">: the renderer adds data-name with the original file name when it knows it.
  html = html.replace(/<img\b[^>]*>/g, (tag) => {
    const src = tag.match(/\ssrc="(data:[^"]*)"/)
    const m = src && DATA_URI.exec(src[1])
    if (!m) return tag
    const data = Buffer.from(m[2], 'base64')
    const digest = hash(data)
    const named = tag.match(/\sdata-name="([^"]*)"/)?.[1]
    const wanted = named ? safeName(named) : `image-${digest}${IMAGE_EXT[m[1]] ?? ''}`
    const url = place('images', wanted, digest, { data })
    return tag.replace(/\sdata-name="[^"]*"/, '').replace(src[0], ` src="${url}"`)
  })

  // Inside <style> only, so a CSS sample in the text is never rewritten.
  const cache = new Map<string, string | null>()
  const styles: Promise<[string, string]>[] = []
  for (const block of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    styles.push(
      (async (): Promise<[string, string]> => {
        let css = block[1]

        // @font-face with the font embedded as data:
        css = css.replace(/@font-face\s*\{[^}]*\}/g, (face) =>
          face.replace(/url\((['"]?)(data:[^)'"]*)\1\)/, (whole, _q, uri: string) => {
            const m = DATA_URI.exec(uri)
            const ext = m && FONT_EXT[m[1]]
            if (!m || !ext) return whole
            const data = Buffer.from(m[2], 'base64')
            const digest = hash(data)
            const family = face.match(/font-family:\s*['"]?([^;'"}]+)/)?.[1] ?? 'font'
            const weight = face.match(/font-weight:\s*([\w]+)/)?.[1] ?? '400'
            const italic = /font-style:\s*italic/.test(face) ? 'i' : ''
            return `url(${place('fonts', `${slug(family)}-${weight}${italic}-${digest}${ext}`, digest, { data })})`
          })
        )

        // A custom theme's url(./bg.png), url(./font.woff2): copy the file next to the page.
        const relative = [...css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)]
          .map((m) => m[2])
          .filter((u) => !/^([a-z][a-z0-9+.-]+:|\/\/|#)/i.test(u))
        for (const u of new Set(relative)) {
          let result = cache.get(u)
          if (result === undefined) {
            result = null
            try {
              const path = join(themesDir, decodeURI(u.split(/[?#]/)[0]))
              if ((await stat(path)).isFile()) {
                const digest = hash(await readFile(path))
                result = place(FONT_FILE.test(path) ? 'fonts' : 'images', safeName(basename(path)), digest, { from: path })
              }
            } catch {
              // missing or unreadable: leave the link as it was
            }
            cache.set(u, result)
          }
          if (result) css = css.split(u).join(result)
        }
        return [block[0], `<style>${css}</style>`]
      })()
    )
  }
  for (const [original, replacement] of await Promise.all(styles)) html = html.replace(original, () => replacement)

  for (const w of writes) {
    await mkdir(dirname(w.path), { recursive: true })
    if (w.data) await writeFile(w.path, w.data)
    else await copyFile(w.from!, w.path)
  }
  await writeFile(htmlPath, html, 'utf-8')
}
