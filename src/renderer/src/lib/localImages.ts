interface Cached {
  mtime: number
  mime: string
  bytes: Uint8Array
  /** Created on first use in the preview and kept for as long as the file is unchanged. */
  blobUrl?: string
}

const cache = new Map<string, Cached>()

/** An `<img src>` that names a file on this computer rather than something on the web. */
const isLocal = (src: string): boolean => {
  if (!src || src.startsWith('//')) return false
  if (/^file:/i.test(src)) return true
  return !/^[a-z][a-z0-9+.-]+:/i.test(src) // a scheme is two or more characters; `C:\` is a drive
}

const toDataUri = (bytes: Uint8Array, mime: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(new Blob([bytes as BlobPart], { type: mime }))
  })

/**
 * Points every local image in rendered HTML at its data. The preview uses blob URLs (the HTML is rebuilt
 * on every keystroke, so it must stay small); an export uses data: URIs so the file stands on its own.
 * Relative paths are resolved against the folder of `docPath`.
 */
export async function inlineLocalImages(html: string, docPath: string | null, as: 'blob' | 'data'): Promise<string> {
  if (!html.includes('<img')) return html
  // A template's content is inert: nothing is fetched while it is parsed.
  const template = document.createElement('template')
  template.innerHTML = html
  const images = [...template.content.querySelectorAll('img')].filter((img) => isLocal(img.getAttribute('src') ?? ''))
  if (!images.length) return html

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src')!
      const key = `${docPath}\n${src}`
      const known = cache.get(key)
      const read = await window.api.readImage(src, docPath, known?.mtime)
      if (!read) return
      let entry = known
      if (read.bytes && read.mime) {
        if (known?.blobUrl) URL.revokeObjectURL(known.blobUrl)
        entry = { mtime: read.mtime, mime: read.mime, bytes: read.bytes }
        cache.set(key, entry)
      }
      if (!entry) return
      if (as === 'blob') {
        entry.blobUrl ??= URL.createObjectURL(new Blob([entry.bytes as BlobPart], { type: entry.mime }))
        img.setAttribute('src', entry.blobUrl)
      } else {
        img.setAttribute('src', await toDataUri(entry.bytes, entry.mime))
      }
    })
  )
  return template.innerHTML
}
