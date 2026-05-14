import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function OwnerLayout() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  function logout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  const navClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-night-900 flex flex-col">
      <header className="bg-night-800 px-4 py-3 border-b border-slate-700">
        <div className="flex justify-between items-center mb-3">
          <div>
            <span className="text-white font-semibold">{user?.name}</span>
            <span className="ml-2 text-xs text-emerald-400 uppercase tracking-wide">Owner</span>
          </div>
          <button
            onClick={logout}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            Logout
          </button>
        </div>
        <nav className="flex gap-1 flex-wrap">
          <NavLink to="/owner" end className={navClass}>Reports</NavLink>
          <NavLink to="/owner/venue" className={navClass}>Venue</NavLink>
          <NavLink to="/owner/menu" className={navClass}>Menu</NavLink>
          <NavLink to="/owner/staff" className={navClass}>Staff</NavLink>
        </nav>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
