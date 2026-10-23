import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { Lang } from '@/lib/i18n'

interface Step {
  src: string
  view: React.ReactNode
}

function steps(lang: Lang): Step[] {
  const zh = lang === 'zh-TW'
  return [
    { src: '# Hello, MEditor', view: <h3 className="text-xl font-bold tracking-tight">Hello, MEditor</h3> },
    {
      src: zh ? '下筆 **飛快**，行內公式 $E = mc^2$。' : 'Write **fast**, with $E = mc^2$ inline.',
      view: (
        <p className="text-sm leading-relaxed">
          {zh ? '下筆 ' : 'Write '}
          <b>{zh ? '飛快' : 'fast'}</b>
          {zh ? '，行內公式 ' : ', with '}
          <i className="font-serif">E = mc²</i>
          {zh ? '。' : ' inline.'}
        </p>
      )
    },
    {
      src: zh ? '- [x] 寫下想法' : '- [x] Jot the idea down',
      view: <Todo done label={zh ? '寫下想法' : 'Jot the idea down'} />
    },
    {
      src: zh ? '- [ ] 交給 AI 審閱' : '- [ ] Ask an AI to review',
      view: <Todo label={zh ? '交給 AI 審閱' : 'Ask an AI to review'} />
    },
    {
      src: ':::chart{type=bar title="Words"}\n| Day | Words |\n| --- | --- |\n| Mon | 420 |\n| Tue | 860 |\n| Wed | 640 |\n:::',
      view: (
        <div className="flex h-16 items-end gap-2 rounded-md border bg-muted/40 px-3 pt-2 pb-1.5">
          {[48, 100, 74].map((h, i) => (
            <div key={i} className="bar flex-1 rounded-t bg-gradient-to-t from-sky-500 to-violet-500" style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      )
    },
    {
      src: zh ? ':::note\n這樣就好看了。\n:::' : ':::note\nThat reads well.\n:::',
      view: (
        <div className="rounded-md border-l-4 border-sky-500 bg-sky-500/10 px-3 py-2 text-sm">
          <div className="text-xs font-semibold text-sky-600 uppercase dark:text-sky-400">note</div>
          {zh ? '這樣就好看了。' : 'That reads well.'}
        </div>
      )
    }
  ]
}

function Todo({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`flex size-4 items-center justify-center rounded border ${done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/60'}`}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </div>
  )
}

/** A looping animation of typing Markdown on the left and the rendered page growing on the right. */
export default function Demo({ lang }: { lang: Lang }): React.JSX.Element {
  const script = steps(lang)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [line, setLine] = useState(reduced ? script.length : 0)
  const [chars, setChars] = useState(0)

  // The script is rebuilt when the language changes, so start over.
  useEffect(() => {
    setLine(reduced ? script.length : 0)
    setChars(0)
  }, [lang, reduced, script.length])

  useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout>
    if (line >= script.length) {
      timer = setTimeout(() => {
        setLine(0)
        setChars(0)
      }, 4200)
    } else if (chars < script[line].src.length) {
      timer = setTimeout(() => setChars(chars + 1), 32)
    } else {
      timer = setTimeout(() => {
        setLine(line + 1)
        setChars(0)
      }, 520)
    }
    return () => clearTimeout(timer)
  }, [line, chars, reduced, script])

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-primary/10">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
        <span className="size-3 rounded-full bg-red-400/80" />
        <span className="size-3 rounded-full bg-amber-400/80" />
        <span className="size-3 rounded-full bg-green-400/80" />
        <span className="ml-3 text-xs text-muted-foreground">notes.md</span>
      </div>
      <div className="grid min-h-[400px] md:grid-cols-2">
        <pre className="m-0 overflow-hidden border-b p-5 font-mono text-[13px] leading-6 whitespace-pre-wrap md:border-r md:border-b-0">
          {script.map((s, i) => {
            if (i > line) return null
            const text = i < line ? s.src : s.src.slice(0, chars)
            return (
              <div key={i} className="text-foreground/90">
                {text}
                {i === line && <span className="caret" />}
              </div>
            )
          })}
        </pre>
        <div className="flex flex-col gap-3 p-5">
          {script.map((s, i) => (i < line ? <div key={i} className="pop">{s.view}</div> : null))}
        </div>
      </div>
    </div>
  )
}
