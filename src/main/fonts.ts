import { app } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'
import subsetFont from 'subset-font'

interface Face {
  family: string
  weight: 400 | 700
  style: 'normal' | 'italic'
  file: string
}

const face = (family: string, prefix: string): Face[] => [
  { family, weight: 400, style: 'normal', file: `${prefix}-Regular` },
  { family, weight: 700, style: 'normal', file: `${prefix}-Bold` }
]

const latin = (family: string, prefix: string): Face[] => [
  ...face(family, prefix),
  { family, weight: 400, style: 'italic', file: `${prefix}-Italic` },
  { family, weight: 700, style: 'italic', file: `${prefix}-BoldItalic` }
]

export type FontKind = 'sans' | 'serif'

// The order a document's characters are handed out in: each character goes to the first font that has it.
// It mirrors the font-family stacks of the built-in themes, with Chinese ahead of Japanese and Korean
// because Han characters are shared and the first font draws them.
const stack = (kind: string, name: string): { key: string; faces: Face[] }[] => [
  { key: `Noto${kind}`, faces: latin(`Noto ${name}`, `Noto${kind}`) },
  ...['TC', 'SC', 'JP', 'KR'].map((r) => ({ key: `Noto${kind}${r}`, faces: face(`Noto ${name} ${r}`, `Noto${kind}${r}`) }))
]

const STACKS: Record<FontKind, { key: string; faces: Face[] }[]> = {
  sans: stack('Sans', 'Sans'),
  serif: stack('Serif', 'Serif')
}

// Packaged, the renderer's build already carries the font files, so they are read from there; in
// development they come from the source folder. Either way there is one copy.
const fontDir = (): string =>
  app.isPackaged ? join(app.getAppPath(), 'out', 'renderer', 'fonts') : join(app.getAppPath(), 'resources', 'fonts')
const coveragePath = (): string => join(app.getAppPath(), 'resources', 'fonts', 'coverage.json')

let coverage: Record<string, [number, number][]> | null = null
const covers = (ranges: [number, number][], code: number): boolean => {
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (code < ranges[mid][0]) hi = mid - 1
    else if (code > ranges[mid][1]) lo = mid + 1
    else return true
  }
  return false
}

/**
 * `@font-face` rules for the bundled Noto fonts, cut down to the characters in `text`, with the fonts as
 * data: URIs so the exported HTML (and the hidden window that prints the PDF) needs nothing else.
 */
export async function embedFonts(text: string, kinds: FontKind[]): Promise<string> {
  coverage ??= JSON.parse(await readFile(coveragePath(), 'utf-8'))
  const ranges = coverage!
  const chars = [...text].map((c) => c.codePointAt(0)!).filter((c) => c > 0x20)
  const rules: string[] = []

  for (const kind of kinds) {
    const left = new Set<number>(chars)
    for (const { key, faces } of STACKS[kind]) {
      const mine = [...left].filter((c) => covers(ranges[key], c))
      if (!mine.length) continue
      for (const c of mine) left.delete(c)
      const subsetText = String.fromCodePoint(...mine)
      for (const f of faces) {
        const source = await readFile(join(fontDir(), `${f.file}.woff2`))
        const data = await subsetFont(source, subsetText, { targetFormat: 'woff2' })
        rules.push(
          `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:${f.style};` +
            `src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2')}`
        )
      }
    }
  }
  return rules.join('\n')
}
