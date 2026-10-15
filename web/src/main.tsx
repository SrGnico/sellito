import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/sellito-theme.css'
import './styles/sellito-motion.css'
import './index.css'
import App from './App.tsx'
import './lib/install'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
