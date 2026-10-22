import { useEffect, useRef, useState } from 'react'
import { renderMarkdown, runPostRender, type MdPlugin } from '@/lib/markdown'
import { collectCss } from '@/lib/export'

interface Props {
  source: string
  themeCss: string
  plugins: MdPlugin[]
  /** Called once a render has fully finished (including diagrams and charts), with any error. */
  onRendered?: (source: string, error: string | null) => void
}

export default function Preview({ source, themeCss, plugins, onRendered }: Props): React.JSX.Element {
  const article = useRef<HTMLElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [rendered, setRendered] = useState('')
  const onRenderedRef = useRef(onRendered)
  onRenderedRef.current = onRendered

  useEffect(() => {
    let stale = false
    const timer = setTimeout(async () => {
      try {
        const html = await renderMarkdown(source, plugins)
        if (stale || !article.current) return
        article.current.innerHTML = html
        setRendered(html)
        setError(null)
        await runPostRender(article.current, plugins, { themeCss })
        if (!stale) onRenderedRef.current?.(source, null)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (!stale) {
          setError(message)
          onRenderedRef.current?.(source, message)
        }
      }
    }, 150)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [source, plugins, themeCss])

  return (
    <div className="relative h-full overflow-auto">
      <style>{collectCss(themeCss, plugins, rendered)}</style>
      {error && (
        <div className="sticky top-0 z-10 bg-destructive px-3 py-1 text-xs text-white">{error}</div>
      )}
      <article ref={article} className="markdown-body min-h-full" />
    </div>
  )
}
