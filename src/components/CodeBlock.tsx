import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CodeBlock({ code, copy, copied }: { code: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false)
  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code)
      setDone(true)
      setTimeout(() => setDone(false), 1600)
    } catch {
      // clipboard not available: the text can still be selected by hand
    }
  }
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted/40">
      <button
        type="button"
        onClick={() => void onCopy()}
        className="absolute top-2 right-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background/80 px-2 py-1 text-xs text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
      >
        {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {done ? copied : copy}
      </button>
      <pre className="m-0 overflow-x-auto p-4 font-mono text-[13px] leading-6">
        <code>{code.replace(/\n$/, '')}</code>
      </pre>
    </div>
  )
}
