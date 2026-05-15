import { useState, useEffect } from 'react'
import { api }           from '../../services/api'
import { connectSocket } from '../../services/socket'
import { useAuthStore }  from '../../store/authStore'

const fmtTime = dt => new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

function elapsed(dt) {
  const mins = Math.floor((Date.now() - new Date(dt)) / 60000)
  if (mins < 1)  return 'Just now'
  if (mins === 1) return '1 min ago'
  return `${mins} mins ago`
}

function OrderCard({ order, onReady }) {
  const [marking, setMarking] = useState(false)
  const [elapsed_, setElapsed] = useState(() => elapsed(order.createdAt))

  useEffect(() => {
    const t = setInterval(() => setElapsed(elapsed(order.createdAt)), 30000)
    return () => clearInterval(t)
  }, [order.createdAt])

  const mins = Math.floor((Date.now() - new Date(order.createdAt)) / 60000)
  const urgency = mins >= 15 ? 'border-red-500 bg-red-900/10'
                : mins >= 8  ? 'border-amber-400 bg-amber-900/10'
                : 'border-indigo-500 bg-night-800'

  async function handleReady() {
    setMarking(true)
    try { await onReady(order.id) } finally { setMarking(false) }
  }

  return (
    <div className={`rounded-2xl border-2 p-4 flex flex-col gap-3 transition-colors ${urgency}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white font-bold text-lg font-mono">{order.orderNumber}</p>
          <p className="text-slate-300 text-sm">{order.table?.label}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-slate-400 text-xs">{fmtTime(order.createdAt)}</p>
          <p className={`text-xs font-medium mt-0.5 ${mins >= 15 ? 'text-red-400' : mins >= 8 ? 'text-amber-400' : 'text-slate-400'}`}>
            {elapsed_}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-slate-700/50 flex-1">
        {order.items?.map(item => (
          <div key={item.id} className="flex items-center gap-3 py-2">
            <span className="text-white font-bold text-xl w-7 shrink-0">{item.quantity}×</span>
            <span className="text-white text-sm font-medium">{item.name}</span>
          </div>
        ))}
      </div>

      {order.notes && (
        <p className="text-amber-300 text-xs bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-800/40">
          📝 {order.notes}
        </p>
      )}

      {/* Ready button */}
      <button
        onClick={handleReady}
        disabled={marking}
        className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-base
                   hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 transition-colors
                   touch-manipulation select-none"
      >
        {marking ? 'Marking…' : '✓ Ready'}
      </button>
    </div>
  )
}

export default function KitchenDisplay() {
  const { user } = useAuthStore()
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/orders?statusCode=confirmed')
        setOrders(res.data ?? [])
      } catch { /* stays empty */ }
      finally  { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    const socket = connectSocket(user.venueId)

    function addOrder(order) {
      if (order.statusCode === 'confirmed') {
        setOrders(prev => prev.some(o => o.id === order.id) ? prev : [order, ...prev])
      }
    }
    function removeOrder({ id }) {
      setOrders(prev => prev.filter(o => o.id !== id))
    }
    function onReady(order) {
      setOrders(prev => prev.filter(o => o.id !== order.id))
    }

    socket.on('order:confirmed', addOrder)
    socket.on('order:ready',     onReady)
    socket.on('order:voided',    removeOrder)
    socket.on('order:paid',      removeOrder)

    return () => {
      socket.off('order:confirmed', addOrder)
      socket.off('order:ready',     onReady)
      socket.off('order:voided',    removeOrder)
      socket.off('order:paid',      removeOrder)
    }
  }, [user.venueId])

  async function markReady(orderId) {
    await api.patch(`/orders/${orderId}/ready`)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-slate-400">Loading orders…</div>
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <span className="text-6xl">✅</span>
        <p className="text-slate-200 font-semibold text-lg">All caught up!</p>
        <p className="text-slate-400 text-sm">No orders in the kitchen right now.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-lg">
          Kitchen Queue
          <span className="ml-2 text-indigo-400 text-base font-normal">({orders.length})</span>
        </h2>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> &lt;8 min</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 8–15 min</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 15+ min</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...orders]
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map(order => (
            <OrderCard key={order.id} order={order} onReady={markReady} />
          ))
        }
      </div>
    </div>
  )
}
