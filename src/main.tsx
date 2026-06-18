import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import FanDashboard from './FanDashboard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FanDashboard />
  </StrictMode>,
)
