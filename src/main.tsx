import '@fontsource/shantell-sans/500.css'
import '@fontsource/caveat/600.css'
import '@fontsource/patrick-hand/400.css'
import '@fontsource/kalam/400.css'
import '@fontsource-variable/inter/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { loadSaved, remeasureTexts, startAutosave } from './persist'
import { loadFonts } from './text'

loadSaved()
startAutosave()
void loadFonts().then(remeasureTexts)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
