import { useState, useEffect, useMemo } from 'react'
import { api }           from '../../services/api'
import { connectSocket } from '../../services/socket'
import { useAuthStore }  from '../../store/authStore'

const fmt     = n  => `${Math.round(n).toLocaleString()} MMK`
const fmtTime = dt => new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

// ── Status helpers ───────────────────────────────────────────

const ORDER_BADGE = {
  pending:   'bg-slate-600   text-slate-200',
  confirmed: 'bg-blue-600    text-blue-100',
  ready:     'bg-amber-500   text-amber-950 font-bold',
  paid:      'bg-emerald-600 text-emerald-100',
  void:      'bg-red-800     text-red-200'
}
const TABLE_BORDER = {
  available: 'border-slate-700',
  occupied:  'border-amber-500',
  reserved:  'border-blue-500'
}
const TABLE_DOT = {
  available: 'bg-slate-500',
  occupied:  'bg-amber-500',
  reserved:  'bg-blue-500'
}

function StatusBadge({ status }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${ORDER_BADGE[status] ?? 'bg-slate-700 text-slate-300'}`}>
      {status}
    </span>
  )
}

// ── Sub-components ───────────────────────────────────────────

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-night-800 rounded-2xl px-4 py-3 border border-slate-700">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`font-bold text-lg ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  )
}

function TableCard({ table, order, onSelect }) {
  const canSelect = order != null
  const itemCount = order?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0

  return (
    <button
      onClick={() => canSelect && onSelect(order.id)}
      disabled={!canSelect}
      className={`flex flex-col items-start p-3 rounded-2xl border-2 bg-night-800 transition-colors text-left
        ${TABLE_BORDER[table.statusCode] ?? 'border-slate-700'}
        ${canSelect ? 'hover:bg-slate-800 cursor-pointer' : 'cursor-default opacity-70'}`}
    >
      <div className="flex items-center gap-1.5 w-full mb-1">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TABLE_DOT[table.statusCode] ?? 'bg-slate-500'}`} />
        <span className="text-white font-bold text-sm truncate">{table.label}</span>
      </div>

      {order ? (
        <>
          <span className="text-indigo-400 text-xs font-mono">{order.orderNumber}</span>
          <span className="text-slate-300 text-xs mt-0.5">
            {itemCount} item{itemCount !== 1 ? 's' : ''} · {fmt(parseFloat(order.totalAmount))}
          </span>
          <div className="mt-1.5">
            <StatusBadge status={order.statusCode} />
          </div>
        </>
      ) : (
        <span className="text-slate-500 text-xs capitalize mt-0.5">{table.statusCode}</span>
      )}
    </button>
  )
}

function OrderRow({ order, onSelect }) {
  return (
    <button
      onClick={() => onSelect(order.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800 rounded-xl transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-mono font-medium">{order.orderNumber}</span>
          <StatusBadge status={order.statusCode} />
        </div>
        <p className="text-slate-400 text-xs mt-0.5 truncate">
          {order.table?.label} · {order.staff?.name} · {fmtTime(order.createdAt)}
        </p>
      </div>
      <span className="text-white text-sm font-semibold shrink-0">
        {fmt(parseFloat(order.totalAmount))}
      </span>
    </button>
  )
}

function OrderModal({ order, onClose, onVoid }) {
  const [voidMode,   setVoidMode]   = useState(false)
  const [reason,     setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const canVoid = ['pending', 'confirmed'].includes(order.statusCode)

  async function handleVoid() {
    if (!reason.trim() || submitting) return
    setSubmitting(true); setError('')
    try {
      await onVoid(order.id, reason.trim())
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-night-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-700 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-700 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-lg">{order.orderNumber}</span>
                <StatusBadge status={order.statusCode} />
              </div>
              <p className="text-slate-400 text-sm mt-0.5">
                {order.table?.label} · {order.staff?.name} · {fmtTime(order.createdAt)}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition-colors ml-4">✕</button>
          </div>
        </div>

        {/* Items */}
        <div className="overflow-y-auto flex-1 px-5 py-3 divide-y divide-slate-700/50">
          {order.items?.map(item => (
            <div key={item.id} className="flex items-center py-2.5 gap-2 text-sm">
              <span className="flex-1 text-slate-200 truncate">{item.name}</span>
              <span className="text-slate-400">×{item.quantity}</span>
              <span className="text-white w-24 text-right font-medium">{fmt(parseFloat(item.subtotal))}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-700 shrink-0">
          <div className="flex justify-between text-white font-bold mb-4">
            <span>Total</span>
            <span>{fmt(parseFloat(order.totalAmount))}</span>
          </div>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          {canVoid && !voidMode && (
            <button
              onClick={() => setVoidMode(true)}
              className="w-full py-2.5 rounded-xl border border-red-700 text-red-400 text-sm font-semibold
                         hover:bg-red-900/30 transition-colors"
            >
              Void Order
            </button>
          )}

          {canVoid && voidMode && (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason for void (required)"
                rows={2}
                className="w-full bg-night-900 border border-slate-600 rounded-xl px-3 py-2 text-white
                           text-sm resize-none placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setVoidMode(false); setReason(''); setError('') }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium
                             hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVoid}
                  disabled={!reason.trim() || submitting}
                  className="flex-1 py-2.5 rounded-xl bg-red-700 text-white text-sm font-semibold
                             disabled:opacity-50 hover:bg-red-600 transition-colors"
                >
                  {submitting ? 'Voiding…' : 'Confirm Void'}
                </button>
              </div>
            </div>
          )}

          {order.statusCode === 'paid' && (
            <div className="text-center text-emerald-400 font-semibold text-sm py-1">Payment received ✓</div>
          )}
          {order.statusCode === 'void' && (
            <div className="text-center text-red-400 font-medium text-sm py-1">Order voided</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

export default function LiveDashboard() {
  const { user } = useAuthStore()

  const [shift,           setShift]           = useState(null)
  const [tables,          setTables]          = useState([])
  const [orders,          setOrders]          = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [mobileTab,       setMobileTab]       = useState('tables')
  const [loading,         setLoading]         = useState(true)

  // ── Load ──────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const [shiftR, tablesR] = await Promise.allSettled([
        api.get('/shifts/open'),
        api.get('/tables')
      ])
      const currentShift = shiftR.status === 'fulfilled' ? shiftR.value.data : null
      setShift(currentShift)
      setTables(tablesR.status === 'fulfilled' ? tablesR.value.data : [])

      if (currentShift) {
        try {
          const res = await api.get(`/orders?shiftId=${currentShift.id}`)
          setOrders(res.data ?? [])
        } catch { /* orders default to [] */ }
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Sockets ───────────────────────────────────────────────

  useEffect(() => {
    const socket = connectSocket(user.venueId)

    function upsertOrder(order) {
      setOrders(prev => {
        const idx = prev.findIndex(o => o.id === order.id)
        return idx >= 0
          ? prev.map(o => o.id === order.id ? order : o)
          : [order, ...prev]
      })
    }

    socket.on('order:created',   upsertOrder)
    socket.on('order:updated',   upsertOrder)
    socket.on('order:confirmed', upsertOrder)
    socket.on('order:ready',     upsertOrder)
    socket.on('order:voided',    upsertOrder)
    socket.on('order:paid',      ({ orderId }) =>
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, statusCode: 'paid' } : o))
    )
    socket.on('table:updated',   ({ id, statusCode }) =>
      setTables(prev => prev.map(t => t.id === id ? { ...t, statusCode } : t))
    )
    socket.on('shift:opened', s  => { setShift(s); setOrders([]) })
    socket.on('shift:closed', () => { setShift(null); setOrders([]) })

    return () => {
      socket.off('order:created')
      socket.off('order:updated')
      socket.off('order:confirmed')
      socket.off('order:ready')
      socket.off('order:voided')
      socket.off('order:paid')
      socket.off('table:updated')
      socket.off('shift:opened')
      socket.off('shift:closed')
    }
  }, [user.venueId])

  // ── Derived ───────────────────────────────────────────────

  // Active (non-terminal) order per table
  const tableOrderMap = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      if (['pending', 'confirmed', 'ready'].includes(o.statusCode)) map[o.tableId] = o
    })
    return map
  }, [orders])

  // Tables grouped by zone
  const tablesByZone = useMemo(() => {
    const map = {}
    tables.forEach(t => {
      const z = t.zone?.name ?? 'Other'
      if (!map[z]) map[z] = []
      map[z].push(t)
    })
    return Object.entries(map)
  }, [tables])

  const stats = useMemo(() => {
    const paid = orders.filter(o => o.statusCode === 'paid')
    return {
      total:   orders.length,
      pending: orders.filter(o => ['pending', 'confirmed', 'ready'].includes(o.statusCode)).length,
      revenue: paid.reduce((s, o) => s + parseFloat(o.totalAmount), 0)
    }
  }, [orders])

  const recentOrders = useMemo(() =>
    [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30)
  , [orders])

  const selectedOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) : null

  // ── Actions ───────────────────────────────────────────────

  async function voidOrder(orderId, reason) {
    await api.patch(`/orders/${orderId}/void`, { reason })
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-slate-400">Loading…</div>
  }

  if (!shift) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
        <p className="text-slate-200 font-semibold">No open shift</p>
        <p className="text-slate-400 text-sm">Go to Shifts to open one.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Shift"    value={shift.label} />
        <StatCard label="Orders"   value={stats.total} />
        <StatCard label="Pending"  value={stats.pending}
                  accent={stats.pending > 0 ? 'text-amber-400' : 'text-white'} />
        <StatCard label="Revenue"  value={fmt(stats.revenue)} accent="text-emerald-400" />
      </div>

      {/* Mobile tab switcher */}
      <div className="flex lg:hidden border-b border-slate-700">
        {['tables', 'orders'].map(tab => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2 text-sm font-medium capitalize transition-colors
              ${mobileTab === tab ? 'text-white border-b-2 border-indigo-500' : 'text-slate-400'}`}
          >
            {tab === 'tables' ? `Tables (${tables.length})` : `Orders (${recentOrders.length})`}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Table grid */}
        <div className={`flex-1 min-w-0 ${mobileTab !== 'tables' ? 'hidden lg:block' : ''}`}>
          {tablesByZone.length === 0 ? (
            <p className="text-slate-500 text-sm">No tables configured.</p>
          ) : (
            tablesByZone.map(([zone, zoneTables]) => (
              <div key={zone} className="mb-5">
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{zone}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {zoneTables.map(t => (
                    <TableCard
                      key={t.id}
                      table={t}
                      order={tableOrderMap[t.id] ?? null}
                      onSelect={setSelectedOrderId}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order feed */}
        <div className={`lg:w-80 xl:w-96 shrink-0 ${mobileTab !== 'orders' ? 'hidden lg:block' : ''}`}>
          <div className="bg-night-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="text-white font-semibold text-sm">Orders this shift</h3>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-1.5">
              {recentOrders.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No orders yet</p>
              ) : (
                recentOrders.map(o => (
                  <OrderRow key={o.id} order={o} onSelect={setSelectedOrderId} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrderId(null)}
          onVoid={voidOrder}
        />
      )}
    </div>
  )
}
