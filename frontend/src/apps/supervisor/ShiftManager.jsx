import { useState, useEffect } from 'react'
import { api }           from '../../services/api'
import { connectSocket } from '../../services/socket'
import { useAuthStore }  from '../../store/authStore'

const fmt     = n  => `${Math.round(n).toLocaleString()} MMK`
const fmtDate = dt => new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtTime = dt => new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
const fmtDur  = (start, end) => {
  const ms  = new Date(end || Date.now()) - new Date(start)
  const h   = Math.floor(ms / 3_600_000)
  const m   = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── Sub-components ───────────────────────────────────────────

function ShiftRow({ shift }) {
  const orderCount = shift._count?.orders ?? 0
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-700/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{shift.label}</p>
        <p className="text-slate-400 text-xs mt-0.5">
          {fmtDate(shift.startedAt)} · {fmtTime(shift.startedAt)}
          {shift.endedAt && ` → ${fmtTime(shift.endedAt)}`}
          {' · '}{fmtDur(shift.startedAt, shift.endedAt)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-slate-300 text-sm">{orderCount} order{orderCount !== 1 ? 's' : ''}</p>
        <span className={`text-xs font-medium ${shift.statusCode === 'open' ? 'text-emerald-400' : 'text-slate-500'}`}>
          {shift.statusCode}
        </span>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

export default function ShiftManager() {
  const { user } = useAuthStore()

  const [shift,        setShift]        = useState(null)
  const [pastShifts,   setPastShifts]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [label,        setLabel]        = useState('')
  const [floatAmt,     setFloatAmt]     = useState('')
  const [opening,      setOpening]      = useState(false)
  const [closing,      setClosing]      = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [error,        setError]        = useState('')

  // ── Load ──────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const [openR, allR] = await Promise.allSettled([
        api.get('/shifts/open'),
        api.get('/shifts')
      ])
      const current = openR.status === 'fulfilled' ? openR.value.data : null
      setShift(current)
      if (allR.status === 'fulfilled') {
        setPastShifts((allR.value.data ?? []).filter(s => s.statusCode === 'closed'))
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Sockets ───────────────────────────────────────────────

  useEffect(() => {
    const socket = connectSocket(user.venueId)

    socket.on('shift:opened', s => {
      setShift(s)
      setError('')
    })
    socket.on('shift:closed', s => {
      setShift(null)
      setPastShifts(prev => [s, ...prev.filter(r => r.id !== s.id)])
    })

    return () => {
      socket.off('shift:opened')
      socket.off('shift:closed')
    }
  }, [user.venueId])

  // ── Actions ───────────────────────────────────────────────

  async function openShift() {
    if (!label.trim() || opening) return
    setOpening(true); setError('')
    try {
      const res = await api.post('/shifts', {
        label:       label.trim(),
        floatAmount: floatAmt ? parseFloat(floatAmt) : undefined
      })
      setShift(res.data)
      setLabel('')
      setFloatAmt('')
    } catch (err) {
      setError(err.message)
    } finally {
      setOpening(false)
    }
  }

  async function closeShift() {
    if (!shift || closing) return
    setClosing(true); setError('')
    try {
      const res = await api.patch(`/shifts/${shift.id}/close`)
      setPastShifts(prev => [res.data, ...prev.filter(r => r.id !== res.data.id)])
      setShift(null)
      setConfirmClose(false)
    } catch (err) {
      setError(err.message)
      setConfirmClose(false)
    } finally {
      setClosing(false)
    }
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-slate-400">Loading…</div>
  }

  return (
    <div className="max-w-xl space-y-5">

      {/* ── Current shift ─────────────────────────────────── */}
      {shift ? (
        <div className="bg-night-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <h2 className="text-white font-bold text-lg">{shift.label}</h2>
              </div>
              <p className="text-slate-400 text-sm">
                Opened {fmtDate(shift.startedAt)} at {fmtTime(shift.startedAt)}
                {' · '}running for {fmtDur(shift.startedAt, null)}
              </p>
              {shift.openedBy && (
                <p className="text-slate-500 text-xs mt-0.5">by {shift.openedBy.name}</p>
              )}
              {shift.floatAmount && (
                <p className="text-slate-400 text-xs mt-1">Float: {fmt(parseFloat(shift.floatAmount))}</p>
              )}
            </div>

            {!confirmClose ? (
              <button
                onClick={() => setConfirmClose(true)}
                className="shrink-0 px-4 py-2 rounded-xl border border-slate-600 text-slate-300
                           hover:border-red-600 hover:text-red-400 text-sm font-medium transition-colors"
              >
                Close Shift
              </button>
            ) : (
              <div className="shrink-0 flex flex-col items-end gap-2">
                <p className="text-amber-400 text-xs text-right max-w-[160px]">
                  Close shift? All pending orders must be resolved first.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmClose(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={closeShift}
                    disabled={closing}
                    className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-sm font-semibold
                               disabled:opacity-50 hover:bg-red-600 transition-colors"
                  >
                    {closing ? 'Closing…' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>
      ) : (
        /* ── Open shift form ──────────────────────────────── */
        <div className="bg-night-800 rounded-2xl border border-slate-700 p-5">
          <h2 className="text-white font-bold mb-4">Open a New Shift</h2>
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs block mb-1">Shift label *</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && openShift()}
                placeholder="e.g. Happy Hour, Main Night, Late Night"
                className="w-full bg-night-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm
                           placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Opening float (MMK, optional)</label>
              <input
                type="number"
                value={floatAmt}
                onChange={e => setFloatAmt(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full bg-night-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm
                           placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={openShift}
              disabled={!label.trim() || opening}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm
                         disabled:opacity-50 hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
            >
              {opening ? 'Opening…' : 'Open Shift'}
            </button>
          </div>
        </div>
      )}

      {/* ── Past shifts ───────────────────────────────────── */}
      {pastShifts.length > 0 && (
        <div className="bg-night-800 rounded-2xl border border-slate-700 px-5 py-4">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Recent Shifts
          </h3>
          <div>
            {pastShifts.slice(0, 10).map(s => (
              <ShiftRow key={s.id} shift={s} />
            ))}
          </div>
        </div>
      )}

      {pastShifts.length === 0 && !shift && !loading && (
        <p className="text-slate-500 text-sm text-center py-4">No previous shifts found.</p>
      )}
    </div>
  )
}
