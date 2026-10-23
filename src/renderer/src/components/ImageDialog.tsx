import { useEffect, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ImageItem } from '@/lib/editorCommands'
import { isImagePath } from '../../../shared/images'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The open file, so images next to it can be written as relative paths. */
  docPath: string | null
  /** `skipped` is how many dropped files were not images. */
  onInsert: (items: ImageItem[], skipped: number) => void
}

export default function ImageDialog({ open, onOpenChange, docPath, onInsert }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setUrl('')
      setNote('')
      setDragging(false)
    }
  }, [open])

  async function insertFiles(paths: string[]): Promise<void> {
    const images = paths.filter(isImagePath)
    if (!images.length) {
      setNote(t('image.noImages'))
      return
    }
    const urls = await window.api.imageMarkdown(images, docPath)
    onInsert(urls.map((u) => ({ alt: '', url: u })), paths.length - images.length)
    onOpenChange(false)
  }

  async function choose(): Promise<void> {
    const paths = await window.api.pickImages()
    if (paths.length) await insertFiles(paths)
  }

  function drop(e: React.DragEvent): void {
    e.preventDefault()
    setDragging(false)
    const files = [...e.dataTransfer.files]
    if (files.length) {
      void insertFiles(files.map((f) => window.api.pathForFile(f)).filter(Boolean))
      return
    }
    // An image dragged out of a web page arrives as a link rather than a file.
    const link = e.dataTransfer
      .getData('text/uri-list')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^https?:\/\//i.test(l))
    if (link) {
      onInsert([{ alt: '', url: link }], 0)
      onOpenChange(false)
    }
  }

  function submitUrl(e: React.FormEvent): void {
    e.preventDefault()
    const value = url.trim()
    if (!value) return
    onInsert([{ alt: '', url: value }], 0)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('settings.close')} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('image.title')}</DialogTitle>
          <DialogDescription>{t('image.description')}</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => void choose()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
            dragging && 'border-primary bg-accent'
          )}
        >
          <ImagePlus className="size-8 text-muted-foreground" />
          <span className="text-sm font-medium">{dragging ? t('image.dropRelease') : t('image.dropTitle')}</span>
          <span className="text-xs text-muted-foreground">{t('image.dropHint')}</span>
        </button>
        {note && <p className="-mt-2 text-xs text-destructive">{note}</p>}

        <form onSubmit={submitUrl} className="grid gap-1.5">
          <label htmlFor="image-url" className="text-sm font-medium">
            {t('image.urlLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="image-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/image.png"
              spellCheck={false}
              className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" size="sm" disabled={!url.trim()}>
              {t('image.insert')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
