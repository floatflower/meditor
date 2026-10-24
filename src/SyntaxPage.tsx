import { Fragment, useEffect, useState } from 'react'
import CodeBlock from '@/components/CodeBlock'
import { SiteFooter, SiteHeader, useLang } from '@/components/Chrome'
import type { Lang } from '@/lib/i18n'
import zh from '@/lib/syntax.zh-TW.json'
import en from '@/lib/syntax.en.json'
import callout from '@/examples/callout.md?raw'
import caption from '@/examples/caption.md?raw'
import chartConfig from '@/examples/chart-config.md?raw'
import chartTable from '@/examples/chart-table.md?raw'
import math from '@/examples/math.md?raw'
import mermaid from '@/examples/mermaid.md?raw'
import pagebreak from '@/examples/pagebreak.md?raw'
import todo from '@/examples/todo.md?raw'

// The same files the screenshots in public/examples were rendered from, so the code shown is the code that was drawn.
const EXAMPLES: Record<string, string> = {
  callout,
  caption,
  'chart-config': chartConfig,
  'chart-table': chartTable,
  math,
  mermaid,
  pagebreak,
  todo
}

type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'example'; example: string; alt: string | null; result: boolean }
  | { t: 'pagebreak' }

interface Doc {
  ui: Record<string, string>
  sections: { id: string; title: string; blocks: Block[] }[]
}

const DOCS: Record<Lang, Doc> = { 'zh-TW': zh as Doc, en: en as Doc }

/** `code` and **bold** are the only formatting the guide's text uses. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith('`') ? (
          <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
            {part.slice(1, -1)}
          </code>
        ) : part.startsWith('**') ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}

/** What `::pagebreak` does, drawn: two sheets of paper with the break between them. */
function PageBreakDemo({ ui }: { ui: Record<string, string> }) {
  const sheet = 'flex h-28 flex-col gap-2 rounded-md border bg-white p-3 shadow-sm'
  const line = 'h-2 rounded bg-neutral-200'
  return (
    <div className="rounded-lg border bg-muted/30 p-5">
      <div className="mx-auto grid max-w-md gap-3">
        <div className={sheet}>
          <span className="text-[10px] font-medium text-neutral-400">{ui.pageOne}</span>
          <div className={`${line} w-11/12`} />
          <div className={`${line} w-3/4`} />
          <div className={`${line} w-5/6`} />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 border-t-2 border-dashed border-primary/50" />
          <span className="text-center">
            <code className="font-mono text-foreground">{ui.pageBreakLabel}</code>
            <span className="block">{ui.onPaper}</span>
          </span>
          <span className="h-px flex-1 border-t-2 border-dashed border-primary/50" />
        </div>
        <div className={sheet}>
          <span className="text-[10px] font-medium text-neutral-400">{ui.pageTwo}</span>
          <div className={`${line} w-5/6`} />
          <div className={`${line} w-2/3`} />
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">{ui.onScreen}</p>
    </div>
  )
}

function Blocks({ blocks, ui }: { blocks: Block[]; ui: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p':
            return (
              <p key={i} className="leading-relaxed text-muted-foreground">
                <Inline text={b.text} />
              </p>
            )
          case 'h':
            return (
              <h3 key={i} className="mt-2 text-lg font-semibold tracking-tight">
                {b.text}
              </h3>
            )
          case 'ul':
            return (
              <ul key={i} className="flex list-disc flex-col gap-2 pl-5 leading-relaxed text-muted-foreground marker:text-muted-foreground/50">
                {b.items.map((item) => (
                  <li key={item}>
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            )
          case 'table':
            return (
              <div key={i} className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {b.head.map((h) => (
                        <th key={h} className="px-4 py-2.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row) => (
                      <tr key={row[0]} className="border-t align-top">
                        {row.map((cell, j) => (
                          <td key={j} className={j === 0 ? 'px-4 py-2.5 whitespace-nowrap' : 'px-4 py-2.5 text-muted-foreground'}>
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'example':
            return (
              <div key={i} className="flex flex-col gap-3">
                <CodeBlock code={EXAMPLES[b.example]} copy={ui.copy} copied={ui.copied} />
                {b.result && (
                  <figure className="m-0">
                    <figcaption className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{ui.result}</figcaption>
                    <img
                      src={`../examples/${b.example}.png`}
                      alt={b.alt ?? ''}
                      loading="lazy"
                      className="w-full rounded-lg border bg-white shadow-sm"
                    />
                  </figure>
                )}
              </div>
            )
          case 'pagebreak':
            return <PageBreakDemo key={i} ui={ui} />
        }
      })}
    </div>
  )
}

/** The section whose heading was last scrolled past, for highlighting in the contents list. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [ids])
  return active
}

export default function Syntax(): React.JSX.Element {
  const [lang, setLang] = useLang()
  const doc = DOCS[lang]
  const ids = doc.sections.map((s) => s.id)
  const active = useActiveSection(ids)

  useEffect(() => {
    document.title = `${doc.ui.title} — Sheaf`
  }, [doc])

  return (
    <div className="min-h-screen overflow-x-hidden">
      <SiteHeader lang={lang} onLang={setLang} root="../" current="syntax" />
      <main className="mx-auto max-w-6xl px-5 py-12 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 text-sm">
            <p className="mb-3 font-medium">{doc.ui.toc}</p>
            <ul className="flex flex-col border-l">
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={`-ml-px block border-l py-1.5 pl-4 transition-colors ${
                      active === s.id ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{doc.ui.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{doc.ui.subtitle}</p>

          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="mt-16 scroll-mt-20">
              <h2 className="mb-5 border-b pb-3 text-2xl font-bold tracking-tight">{s.title}</h2>
              <Blocks blocks={s.blocks} ui={doc.ui} />
            </section>
          ))}
        </div>
      </main>
      <SiteFooter lang={lang} root="../" />
    </div>
  )
}
