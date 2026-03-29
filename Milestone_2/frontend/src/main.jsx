import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './MainLayout.jsx'
import BatchAuditPage from './pages/BatchAuditPage.jsx'
import SupervisorDashboard from './pages/SupervisorDashboard.jsx'
import LiveAuditPage from './pages/LiveAuditPage.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import CopilotPage from './pages/CopilotPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import { CopilotProvider } from './context/CopilotContext.jsx'
import './index.css'

function RequireAuth({ children }) {
  const auth = JSON.parse(window.localStorage.getItem('ai_auditor_auth') || 'null')
  return auth ? children : <Navigate to="/login" replace />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CopilotProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
            <Route index element={<SupervisorDashboard />} />
            <Route path="audit" element={<BatchAuditPage />} />
            <Route path="batch" element={<BatchAuditPage />} />
            <Route path="live" element={<LiveAuditPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="copilot" element={<CopilotPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CopilotProvider>
  </React.StrictMode>,
)
