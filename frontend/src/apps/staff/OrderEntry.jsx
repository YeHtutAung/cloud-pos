import { useState, useEffect, useMemo } from 'react'
import { QRCodeSVG }     from 'qrcode.react'
import { api }           from '../../services/api'
import { connectSocket } from '../../services/socket'
import { useAuthStore }  from '../../store/authStore'
import { useTableStore } from '../../store/tableStore'

// ── Helpers ──────────────────────────────────────────────────

const fmt = n => `${Math.round(n).toLocaleString()} MMK`

function standardPrice(item) {
  const p = item.prices?.find(p => p.priceType === 'standard' && p.isActive)
  return p ? parseFloat(p.price) : null
}

// ── Countdown hook ───────────────────────────────────────────

function useCountdown(expiresAt) {
  const [secs, setSecs] = useState(() =>
    expiresAt ? Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000)) : 0
  )
  useEffect(() => {
    if (!expiresAt) return
    const t = setInterval(() =>
      setSecs(Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000))), 1000
    )
    return () => clearInterval(t)
  }, [expiresAt])
  if (secs <= 0) return 'Expired'
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

// ── Sub-components ───────────────────────────────────────────

const STATUS_BORDER = {
  available: 'border-emerald-500 hover:bg-emerald-500/10',
  occupied:  'border-amber-500  hover:bg-amber-500/10',
  reserved:  'border-blue-500   hover:bg-blue-500/10'
}
const STATUS_DOT = {
  available: 'bg-emerald-500',
  occupied:  'bg-amber-500',
  reserved:  'bg-blue-500'
}

function TableCard({ table, onSelect }) {
  return (
    <button
      onClick={() => onSelect(table)}
      className={`flex flex-col items-start p-4 rounded-2xl border-2 bg-night-800 transition-colors
        ${STATUS_BORDER[table.statusCode] ?? 'border-slate-600 hover:bg-slate-700'}`}
    >
      <div className="flex items-center gap-2 w-full">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[table.statusCode] ?? 'bg-slate-500'}`} />
        <span className="text-white font-semibold text-sm truncate">{table.label}</span>
      </div>
      <span className="text-xs text-slate-400 mt-1 capitalize">{table.statusCode}</span>
    </button>
  )
}

function ItemCard({ item, onTap }) {
  const price = standardPrice(item)
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-start p-3 rounded-2xl bg-night-800 border border-slate-700/50
                 active:bg-slate-700 transition-colors text-left touch-manipulation select-none"
    >
      <span className="text-white font-semibold text-sm leading-snug line-clamp-2 mb-1">{item.name}</span>
      <span className="text-indigo-400 text-sm font-medium">{price !== null ? fmt(price) : '—'}</span>
      {item.isFastSell && (
        <span className="mt-1 text-[10px] text-amber-400 font-medium uppercase tracking-wide">⚡ Fast</span>
      )}
    </button>
  )
}

function CartRow({ line, onIncrement, onDecrement }) {
  return (
    <div className="flex items-center gap-2 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{line.name}</p>
        <p className="text-slate-400 text-xs">{fmt(line.unitPrice)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onDecrement}
          className="w-7 h-7 rounded-lg bg-slate-700 text-white text-sm font-bold
                     active:bg-slate-600 transition-colors"
        >−</button>
        <span className="text-white text-sm font-semibold w-5 text-center">{line.quantity}</span>
        <button
          onClick={onIncrement}
          className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-sm font-bold
                     active:bg-indigo-500 transition-colors"
        >+</button>
      </div>
      <span className="text-white text-sm font-medium w-20 text-right shrink-0">
        {fmt(line.unitPrice * line.quantity)}
      </span>
    </div>
  )
}

function PaymentModal({ payment, onClose }) {
  const countdown = useCountdown(payment.qrExpiresAt)
  const expired   = countdown === 'Expired'

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-night-800 rounded-3xl p-6 w-full max-w-sm border border-slate-700">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-white font-bold text-lg">Scan to Pay</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition-colors">✕</button>
        </div>

        <div className="bg-white rounded-2xl p-5 mb-4 flex items-center justify-center">
          <QRCodeSVG
            value={payment.qrCode || ' '}
            size={220}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>

        <p className={`text-center text-sm font-medium mb-3 ${expired ? 'text-red-400' : 'text-emerald-400'}`}>
          {expired ? 'QR expired — close and tap Pay again' : `Expires in ${countdown}`}
        </p>
        <p className="text-center text-slate-400 text-sm">
          Amount: <span className="text-white font-bold">{fmt(parseFloat(payment.amount))}</span>
        </p>
        <p className="text-center text-slate-500 text-xs mt-2 animate-pulse">Waiting for payment…</p>
      </div>
    </div>
  )
}

function CartSidebar({ cart, cartTotal, activeOrder, gateways, placing,
                       onIncrement, onDecrement, onClear, onPlace, onAddToOrder, onPay, onSendToKitchen }) {
  const placed      = activeOrder != null
  const orderTotal  = placed ? parseFloat(activeOrder.totalAmount) : 0
  const isPaid      = activeOrder?.statusCode === 'paid'

  return (
    <div className="flex flex-col h-full bg-night-800 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2.5 border-b border-slate-700 shrink-0">
        <div className="flex justify-between items-center">
          <span className="text-white font-bold text-sm">
            {placed ? `Order ${activeOrder.orderNumber}` : 'New Order'}
          </span>
          {cart.length > 0 && (
            <button onClick={onClear}
              className="text-slate-400 hover:text-red-400 text-xs transition-colors">
              Clear
            </button>
          )}
        </div>
        {placed && (
          <p className="text-slate-400 text-xs mt-0.5 capitalize">{activeOrder.statusCode}</p>
        )}
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto px-4 min-h-0">
        {/* New cart items */}
        {cart.length > 0 ? (
          <div className="divide-y divide-slate-700/50">
            {cart.map(line => (
              <CartRow
                key={line.menuItemId}
                line={line}
                onIncrement={() => onIncrement(line)}
                onDecrement={() => onDecrement(line.menuItemId)}
              />
            ))}
          </div>
        ) : placed ? (
          /* Show placed order items read-only */
          <div className="divide-y divide-slate-700/50">
            {activeOrder.items?.map(item => (
              <div key={item.id} className="flex items-center py-2.5 text-sm gap-2">
                <span className="flex-1 text-slate-300 truncate">{item.name}</span>
                <span className="text-slate-400">×{item.quantity}</span>
                <span className="text-slate-300 w-20 text-right">{fmt(parseFloat(item.subtotal))}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm py-6 text-center">Tap items to add them</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pt-3 pb-4 border-t border-slate-700 shrink-0 space-y-2.5">
        {cart.length > 0 && (
          <>
            <div className="flex justify-between text-white font-bold text-sm">
              <span>{placed ? 'Adding' : 'Total'}</span>
              <span>{fmt(cartTotal)}</span>
            </div>
            <button
              onClick={placed ? onAddToOrder : onPlace}
              disabled={placing}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm
                         disabled:opacity-50 hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
            >
              {placing ? 'Placing…' : placed ? 'Add to Order' : 'Place Order'}
            </button>
          </>
        )}

        {placed && cart.length === 0 && (
          <>
            <div className="flex justify-between text-white font-bold text-sm">
              <span>Order Total</span>
              <span>{fmt(orderTotal)}</span>
            </div>
            {isPaid ? (
              <div className="py-2.5 text-center text-emerald-400 font-semibold text-sm">Payment received ✓</div>
            ) : activeOrder.statusCode === 'pending' ? (
              <button
                onClick={onSendToKitchen}
                disabled={placing}
                className="w-full py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm
                           disabled:opacity-50 hover:bg-orange-500 active:bg-orange-700 transition-colors"
              >
                {placing ? '…' : '🍳 Send to Kitchen'}
              </button>
            ) : activeOrder.statusCode === 'ready' ? (
              <>
                <div className="py-2 text-center text-amber-400 font-semibold text-sm">🔔 Order Ready!</div>
                <button
                  onClick={onPay}
                  disabled={placing || gateways.length === 0}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm
                             disabled:opacity-50 hover:bg-emerald-500 active:bg-emerald-700 transition-colors"
                >
                  {placing ? '…' : gateways.length === 0 ? 'No gateway configured' : 'Pay with MMQR'}
                </button>
              </>
            ) : (
              <button
                onClick={onPay}
                disabled={placing || gateways.length === 0}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm
                           disabled:opacity-50 hover:bg-emerald-500 active:bg-emerald-700 transition-colors"
              >
                {placing ? '…' : gateways.length === 0 ? 'No gateway configured' : 'Pay with MMQR'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

export default function OrderEntry() {
  const { user }        = useAuthStore()
  const { updateTable } = useTableStore()

  // Remote data
  const [shift,      setShift]      = useState(null)
  const [tables,     setTables]     = useState([])
  const [categories, setCategories] = useState([])
  const [menuItems,  setMenuItems]  = useState([])
  const [gateways,   setGateways]   = useState([])

  // UI state
  const [view,          setView]          = useState('tables')
  const [selectedTable, setSelectedTable] = useState(null)
  const [activeCat,     setActiveCat]     = useState('all')
  const [cart,          setCart]          = useState([])
  const [cartOpen,      setCartOpen]      = useState(false)
  const [activeOrder,   setActiveOrder]   = useState(null)
  const [paymentData,   setPaymentData]   = useState(null)
  const [placing,       setPlacing]       = useState(false)
  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(true)

  // ── Load ──────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        api.get('/shifts/open'),
        api.get('/tables'),
        api.get('/menu/categories'),
        api.get('/menu/items'),
        api.get('/venues/gateways')
      ])
      const [shiftR, tablesR, catsR, itemsR, gwR] = results
      setShift     (shiftR.status  === 'fulfilled' ? shiftR.value.data   : null)
      setTables    (tablesR.status === 'fulfilled' ? tablesR.value.data  : [])
      setCategories(catsR.status   === 'fulfilled' ? catsR.value.data    : [])
      setMenuItems (itemsR.status  === 'fulfilled' ? itemsR.value.data   : [])
      setGateways  (gwR.status     === 'fulfilled' ? gwR.value.data      : [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Sockets ───────────────────────────────────────────────

  useEffect(() => {
    const socket = connectSocket(user.venueId)

    function onTableUpdated({ id, statusCode }) {
      setTables(prev => prev.map(t => t.id === id ? { ...t, statusCode } : t))
      updateTable(id, { statusCode })
    }
    function onOrderUpdated(order) {
      if (order.id === activeOrder?.id) setActiveOrder(order)
    }
    function onOrderPaid({ orderId }) {
      if (orderId === activeOrder?.id) {
        setActiveOrder(o => o ? { ...o, statusCode: 'paid' } : o)
        setPaymentData(null)
      }
    }

    function onOrderStatusChange(order) {
      if (order.id === activeOrder?.id) setActiveOrder(order)
    }

    socket.on('table:updated',   onTableUpdated)
    socket.on('order:updated',   onOrderUpdated)
    socket.on('order:paid',      onOrderPaid)
    socket.on('order:confirmed', onOrderStatusChange)
    socket.on('order:ready',     onOrderStatusChange)
    return () => {
      socket.off('table:updated',   onTableUpdated)
      socket.off('order:updated',   onOrderUpdated)
      socket.off('order:paid',      onOrderPaid)
      socket.off('order:confirmed', onOrderStatusChange)
      socket.off('order:ready',     onOrderStatusChange)
    }
  }, [user.venueId, activeOrder?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cart helpers ──────────────────────────────────────────

  function addToCart(item) {
    const price = standardPrice(item)
    if (price === null) return
    setCart(prev => {
      const idx = prev.findIndex(c => c.menuItemId === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { menuItemId: item.id, name: item.name, unitPrice: price, quantity: 1 }]
    })
  }

  function incrementLine(line) {
    setCart(prev => prev.map(c =>
      c.menuItemId === line.menuItemId ? { ...c, quantity: c.quantity + 1 } : c
    ))
  }

  function decrementLine(menuItemId) {
    setCart(prev => {
      const idx = prev.findIndex(c => c.menuItemId === menuItemId)
      if (idx < 0) return prev
      const next = [...prev]
      if (next[idx].quantity > 1) {
        next[idx] = { ...next[idx], quantity: next[idx].quantity - 1 }
        return next
      }
      return next.filter((_, i) => i !== idx)
    })
  }

  const cartTotal     = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0)
  const cartItemCount = cart.reduce((s, c) => s + c.quantity, 0)

  const displayItems = useMemo(() => {
    if (activeCat === 'fast') return menuItems.filter(i => i.isFastSell)
    if (activeCat === 'all')  return menuItems
    return menuItems.filter(i => i.categoryId === activeCat)
  }, [menuItems, activeCat])

  // ── Actions ───────────────────────────────────────────────

  async function selectTable(table) {
    setSelectedTable(table)
    setCart([])
    setPaymentData(null)
    setError('')
    setView('menu')
    try {
      const res  = await api.get(`/orders?tableId=${table.id}&statusCode=pending`)
      const rows = res.data ?? []
      setActiveOrder(rows.length > 0 ? rows[0] : null)
    } catch {
      setActiveOrder(null)
    }
  }

  function backToTables() {
    setView('tables')
    setSelectedTable(null)
    setActiveOrder(null)
    setCart([])
    setPaymentData(null)
    setCartOpen(false)
    setError('')
  }

  async function placeOrder() {
    if (!selectedTable || !shift || cart.length === 0 || placing) return
    setPlacing(true); setError('')
    try {
      const res = await api.post('/orders', {
        tableId: selectedTable.id,
        shiftId: shift.id,
        items:   cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity }))
      })
      setActiveOrder(res.data)
      setCart([])
      setCartOpen(false)
      setTables(prev => prev.map(t =>
        t.id === selectedTable.id ? { ...t, statusCode: 'occupied' } : t
      ))
    } catch (err) {
      setError(err.message)
    } finally {
      setPlacing(false)
    }
  }

  async function addItemsToOrder() {
    if (!activeOrder || cart.length === 0 || placing) return
    setPlacing(true); setError('')
    try {
      const res = await api.post(`/orders/${activeOrder.id}/items`, {
        items: cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity }))
      })
      setActiveOrder(res.data)
      setCart([])
      setCartOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setPlacing(false)
    }
  }

  async function initiatePayment() {
    if (!activeOrder || gateways.length === 0 || placing) return
    setPlacing(true); setError('')
    try {
      const res = await api.post(`/orders/${activeOrder.id}/pay`, { gatewayId: gateways[0].id })
      setPaymentData(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setPlacing(false)
    }
  }

  async function sendToKitchen() {
    if (!activeOrder || placing) return
    setPlacing(true); setError('')
    try {
      const res = await api.patch(`/orders/${activeOrder.id}/confirm`)
      setActiveOrder(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setPlacing(false)
    }
  }

  // ── Guards ────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-slate-400">Loading…</div>
  }

  if (!shift) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-4">
        <p className="text-slate-200 font-semibold">No open shift</p>
        <p className="text-slate-400 text-sm">A supervisor must open a shift before orders can be taken.</p>
      </div>
    )
  }

  // ── Table picker ──────────────────────────────────────────

  if (view === 'tables') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Select a Table</h2>
          <span className="text-slate-400 text-sm">{shift.label}</span>
        </div>
        {tables.length === 0 ? (
          <p className="text-slate-400 text-sm">No tables configured. Ask a supervisor to add tables.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {tables.map(t => <TableCard key={t.id} table={t} onSelect={selectTable} />)}
          </div>
        )}
      </div>
    )
  }

  // ── Menu + cart ───────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Top bar */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <button
          onClick={backToTables}
          className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          ← Tables
        </button>
        <span className="text-white font-semibold">{selectedTable?.label}</span>
        {selectedTable?.statusCode === 'occupied' && (
          <span className="text-xs text-amber-400">occupied</span>
        )}
        <span className="ml-auto text-slate-500 text-xs shrink-0">{shift.label}</span>
      </div>

      {error && <p className="text-red-400 text-sm mb-2 shrink-0">{error}</p>}

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

        {/* Left: categories + item grid */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
            {[{ id: 'all', name: 'All' }, { id: 'fast', name: '⚡ Fast' }, ...categories].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors
                  ${activeCat === cat.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-night-800 text-slate-300 border border-slate-700 hover:text-white'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Item grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 mt-2
                          overflow-y-auto flex-1 content-start">
            {displayItems.map(item => (
              <ItemCard key={item.id} item={item} onTap={() => addToCart(item)} />
            ))}
            {displayItems.length === 0 && (
              <p className="col-span-full text-slate-500 text-sm py-4">No items in this category.</p>
            )}
          </div>
        </div>

        {/* Right: cart sidebar (desktop only) */}
        <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0">
          <CartSidebar
            cart={cart}
            cartTotal={cartTotal}
            activeOrder={activeOrder}
            gateways={gateways}
            placing={placing}
            onIncrement={incrementLine}
            onDecrement={decrementLine}
            onClear={() => setCart([])}
            onPlace={placeOrder}
            onAddToOrder={addItemsToOrder}
            onPay={initiatePayment}
            onSendToKitchen={sendToKitchen}
          />
        </div>
      </div>

      {/* Mobile: sticky cart bar */}
      <div className="lg:hidden mt-3 flex gap-2 shrink-0">
        <button
          onClick={() => setCartOpen(true)}
          className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-night-800 border border-slate-700"
        >
          <span className="text-white text-sm">
            {cartItemCount > 0
              ? `🛒 ${cartItemCount} item${cartItemCount > 1 ? 's' : ''}`
              : activeOrder ? `Order ${activeOrder.orderNumber}` : 'Cart empty'}
          </span>
          <span className="ml-auto text-indigo-400 font-semibold text-sm">{fmt(cartTotal)}</span>
        </button>

        {cart.length > 0 && (
          <button
            onClick={activeOrder ? addItemsToOrder : placeOrder}
            disabled={placing}
            className="px-4 py-3 rounded-2xl bg-indigo-600 text-white font-semibold text-sm
                       disabled:opacity-50 active:bg-indigo-700 transition-colors"
          >
            {placing ? '…' : activeOrder ? 'Add' : 'Order'}
          </button>
        )}

        {activeOrder && cart.length === 0 && activeOrder.statusCode !== 'paid' && (
          <button
            onClick={initiatePayment}
            disabled={placing || gateways.length === 0}
            className="px-4 py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm
                       disabled:opacity-50 active:bg-emerald-700 transition-colors"
          >
            Pay
          </button>
        )}
      </div>

      {/* Mobile cart drawer */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/60">
          <div className="bg-night-800 rounded-t-3xl p-4 max-h-[72vh] flex flex-col border-t border-slate-700">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h3 className="text-white font-bold">
                {activeOrder ? `Add to ${activeOrder.orderNumber}` : 'New Order'}
              </h3>
              <button onClick={() => setCartOpen(false)}
                      className="text-slate-400 hover:text-white text-2xl leading-none transition-colors">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-700/50">
              {cart.length === 0 ? (
                <p className="text-slate-400 text-sm py-4 text-center">No items added yet</p>
              ) : cart.map(line => (
                <CartRow
                  key={line.menuItemId}
                  line={line}
                  onIncrement={() => incrementLine(line)}
                  onDecrement={() => decrementLine(line.menuItemId)}
                />
              ))}
            </div>

            {cart.length > 0 && (
              <div className="pt-3 border-t border-slate-700 mt-2 shrink-0">
                <div className="flex justify-between text-white font-bold mb-3">
                  <span>Total</span>
                  <span>{fmt(cartTotal)}</span>
                </div>
                <button
                  onClick={activeOrder ? addItemsToOrder : placeOrder}
                  disabled={placing}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-semibold
                             disabled:opacity-50 active:bg-indigo-700 transition-colors"
                >
                  {placing ? 'Placing…' : activeOrder ? 'Add to Order' : 'Place Order'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR payment modal */}
      {paymentData && (
        <PaymentModal payment={paymentData} onClose={() => setPaymentData(null)} />
      )}

    </div>
  )
}
