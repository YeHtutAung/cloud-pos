import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function StaffLayout() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  function logout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-night-900 flex flex-col">
      <header className="bg-night-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
        <div>
          <span className="text-white font-semibold">{user?.name}</span>
          <span className="ml-2 text-xs text-indigo-400 uppercase tracking-wide">Staff</span>
        </div>
        <button
          onClick={logout}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          Logout
        </button>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
