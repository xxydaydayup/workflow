import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { WorkflowLayout } from '@/app/layout/WorkflowLayout'
import { DesignerPage } from '@/features/designer/DesignerPage'
import { MonitoringPage } from '@/features/monitoring/MonitoringPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<WorkflowLayout />}>
          <Route index element={<Navigate to="/designer" replace />} />
          <Route path="designer" element={<DesignerPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="*" element={<Navigate to="/designer" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
