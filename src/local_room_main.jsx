import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LocalRoomApp from './LocalRoomApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocalRoomApp />
  </StrictMode>,
)
