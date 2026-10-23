import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/fonts.css'
import App from './App'
import { setLanguage } from './i18n'

async function start(): Promise<void> {
  // The language is known before the first paint, so nothing flashes in the wrong one.
  const { resolved } = await window.api.getLanguage()
  await setLanguage(resolved)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void start()
