import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installMockApi } from './mockApi'
import './styles.css'

if (import.meta.env.DEV && !('traceMatch' in window)) installMockApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
