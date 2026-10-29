import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ValuationTestShell from './onlineValuation/ValuationTestShell.jsx'
import PublicValuation, { CustomerValuationLink } from './onlineValuation/PublicValuation.jsx'

const path = window.location.pathname.replace(/\/$/, '')
const rootElement = import.meta.env.MODE === 'valuation-test' ? <ValuationTestShell /> : path === '/naceneni-vozu/odkaz' ? <CustomerValuationLink /> : path === '/naceneni-vozu' ? <PublicValuation /> : <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {rootElement}
  </StrictMode>,
)
