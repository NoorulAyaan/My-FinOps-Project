import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import RequireAuth from '@/auth/RequireAuth'
import ConnectCloud from '@/pages/ConnectCloud'
import Landing from '@/pages/Landing'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/signup" element={<Auth initialMode="signup" />} />
          <Route
            path="/connect"
            element={
              <RequireAuth>
                <ConnectCloud />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
