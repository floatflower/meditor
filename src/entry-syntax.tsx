import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SyntaxPage from './SyntaxPage'

// Follow the system's light or dark setting.
const dark = window.matchMedia('(prefers-color-scheme: dark)')
const apply = (): void => {
  document.documentElement.classList.toggle('dark', dark.matches)
}
apply()
dark.addEventListener('change', apply)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SyntaxPage />
  </StrictMode>
)
