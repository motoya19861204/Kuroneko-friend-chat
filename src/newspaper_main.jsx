import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import NewspaperApp from './NewspaperApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NewspaperApp />
  </StrictMode>,
)
