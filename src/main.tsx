import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { environmentConfigService } from './services/environmentConfigService'
import { themeService } from './services/themeService'

themeService.applyDarkMode(environmentConfigService.isDarkModeEnabled())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
