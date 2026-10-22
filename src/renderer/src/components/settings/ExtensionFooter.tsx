import { FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  openLabel: string
  reloadLabel: string
  onOpen: () => void
  onReload: () => void
}

/** "Open the folder" and "Reload", shared by the Appearance and Plugins tabs. */
export default function ExtensionFooter({ openLabel, reloadLabel, onOpen, onReload }: Props): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button variant="outline" size="sm" className="cursor-pointer" onClick={onOpen}>
        <FolderOpen /> {openLabel}
      </Button>
      <Button variant="outline" size="sm" className="cursor-pointer" onClick={onReload}>
        <RefreshCw /> {reloadLabel}
      </Button>
    </div>
  )
}
