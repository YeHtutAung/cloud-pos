import { Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function KitchenLayout() {
  const { logout } = useAuthStore()
  return (
    <div className="min-h-screen bg-night-900 flex flex-col">
      <header className="bg-night-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍳</span>
          <span className="text-white font-bold text-lg">Kitchen Display</span>
        </div>
        <button
          onClick={logout}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          Exit
        </button>
      </header>
      <main className="flex-1 p-4 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
