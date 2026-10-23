declare module 'subset-font' {
  /** Keeps only the glyphs for `text` and returns the font in `targetFormat`. */
  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: { targetFormat?: 'sfnt' | 'woff' | 'woff2' }
  ): Promise<Buffer>
}
