import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RoomApp from './RoomApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RoomApp />
  </StrictMode>,
)
