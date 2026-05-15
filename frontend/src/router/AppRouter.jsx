import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

// Entry
import PinLogin from '../components/shared/PinLogin'

// Staff App
import StaffLayout from '../apps/staff/StaffLayout'
import OrderEntry from '../apps/staff/OrderEntry'

// Supervisor App
import SupervisorLayout from '../apps/supervisor/SupervisorLayout'
import LiveDashboard from '../apps/supervisor/LiveDashboard'
import ShiftManager from '../apps/supervisor/ShiftManager'

// Kitchen App
import KitchenLayout  from '../apps/kitchen/KitchenLayout'
import KitchenDisplay from '../apps/kitchen/KitchenDisplay'

// Owner App
import OwnerLayout from '../apps/owner/OwnerLayout'
import VenueSetup from '../apps/owner/VenueSetup'
import MenuImport from '../apps/owner/MenuImport'
import StaffManager from '../apps/owner/StaffManager'
import Reports from '../apps/owner/Reports'

function RequireRole({ roles, children }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />
  return children
}

export default function AppRouter() {
  const { user } = useAuthStore()

  return (
    <Routes>
      {/* Entry — redirect to role app if already authenticated */}
      <Route path="/login" element={
        user ? <Navigate to={`/${user.role}`} replace /> : <PinLogin />
      } />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ─── Staff App ─── */}
      <Route path="/staff" element={
        <RequireRole roles={['staff']}>
          <StaffLayout />
        </RequireRole>
      }>
        <Route index element={<OrderEntry />} />
      </Route>

      {/* ─── Kitchen App ─── */}
      <Route path="/kitchen" element={
        <RequireRole roles={['kitchen']}>
          <KitchenLayout />
        </RequireRole>
      }>
        <Route index element={<KitchenDisplay />} />
      </Route>

      {/* ─── Supervisor App ─── */}
      <Route path="/supervisor" element={
        <RequireRole roles={['supervisor']}>
          <SupervisorLayout />
        </RequireRole>
      }>
        <Route index element={<LiveDashboard />} />
        <Route path="shifts" element={<ShiftManager />} />
      </Route>

      {/* ─── Owner App ─── */}
      <Route path="/owner" element={
        <RequireRole roles={['owner']}>
          <OwnerLayout />
        </RequireRole>
      }>
        <Route index element={<Reports />} />
        <Route path="venue" element={<VenueSetup />} />
        <Route path="menu" element={<MenuImport />} />
        <Route path="staff" element={<StaffManager />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
