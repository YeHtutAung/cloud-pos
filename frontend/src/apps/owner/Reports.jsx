import { useState, useEffect } from 'react'
import { api } from '../../services/api'

const fmt     = n  => `${Math.round(parseFloat(n)).toLocaleString()} MMK`
const fmtDate = dt => new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const fmtTime = dt => new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

// ── Breakdown tables ──────────────────────────────────────────

function BreakdownTable({ title, rows, columns }) {
  if (!rows || Object.keys(rows).length === 0) return null
  return (
    <div>
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{title}</p>
      <div className="rounded-xl overflow-hidden border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60">
              <th className="text-left text-slate-400 text-xs px-3 py-2 font-medium">Name</th>
              {columns.map(c => (
                <th key={c.key} className="text-right text-slate-400 text-xs px-3 py-2 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(rows).map(([name, data]) => (
              <tr key={name} className="border-t border-slate-700/50">
                <td className="text-white px-3 py-2">{name}</td>
                {columns.map(c => (
                  <td key={c.key} className="text-right text-slate-300 px-3 py-2">
                    {c.format ? c.format(data[c.key]) : data[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Report detail ─────────────────────────────────────────────

function ReportDetail({ report: initialReport, onClose, onUpdate }) {
  const [report,   setReport]   = useState(initialReport)
  const [sending,  setSending]  = useState(false)
  const [sendErr,  setSendErr]  = useState('')

  const bd = report.breakdown ?? {}

  async function handleSend() {
    setSending(true); setSendErr('')
    try {
      const res = await api.post(`/reports/${report.id}/send`)
      const updated = res.data
      setReport(updated)
      onUpdate?.(updated)
    } catch (err) {
      setSendErr(err.message ?? 'Send failed')
    } finally { setSending(false) }
  }

  return (
    <div className="bg-night-800 rounded-2xl border border-slate-700 p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-white font-bold">
            {report.shift?.label ?? report.reportType?.label}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">{fmtDate(report.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {report.sentChannels?.telegram && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-900/50 text-sky-400 border border-sky-700/50">
              Sent
            </span>
          )}
          <button onClick={handleSend} disabled={sending}
            className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 text-white font-medium
                       hover:bg-sky-500 disabled:opacity-50 transition-colors">
            {sending ? 'Sending…' : report.sentChannels?.telegram ? 'Resend' : 'Send to Telegram'}
          </button>
          <button onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-sm px-2 py-1 rounded hover:bg-slate-700/50">
            Close
          </button>
        </div>
      </div>
      {sendErr && <p className="text-red-400 text-xs">{sendErr}</p>}

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { label: 'Revenue',  value: fmt(report.totalRevenue),    color: 'text-emerald-400' },
          { label: 'Orders',   value: report.totalOrders,          color: 'text-white' },
          { label: 'Paid',     value: report.paidOrders,           color: 'text-blue-400' },
          { label: 'Void',     value: report.voidOrders,           color: 'text-red-400' }
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-night-900 rounded-xl py-3">
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Breakdown tables */}
      <BreakdownTable
        title="By Zone"
        rows={bd.zones}
        columns={[
          { key: 'orders',  label: 'Orders' },
          { key: 'revenue', label: 'Revenue', format: fmt }
        ]}
      />
      <BreakdownTable
        title="By Staff"
        rows={bd.staff}
        columns={[
          { key: 'orders',  label: 'Orders' },
          { key: 'revenue', label: 'Revenue', format: fmt }
        ]}
      />
      <BreakdownTable
        title="By Category"
        rows={bd.categories}
        columns={[
          { key: 'qty',     label: 'Qty' },
          { key: 'revenue', label: 'Revenue', format: fmt }
        ]}
      />
    </div>
  )
}

// ── Report card ───────────────────────────────────────────────

function ReportCard({ report, onSelect }) {
  return (
    <button onClick={() => onSelect(report)}
      className="w-full flex items-center gap-4 p-4 bg-night-800 rounded-xl border border-slate-700
                 hover:border-slate-500 text-left transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">
            {report.shift?.label ?? report.reportType?.label}
          </p>
          {report.sentChannels?.telegram && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-sky-900/50 text-sky-400 border border-sky-700/50">
              Sent
            </span>
          )}
        </div>
        <p className="text-slate-400 text-xs mt-0.5">
          {fmtDate(report.createdAt)}
          {report.shift?.startedAt && ` · ${fmtTime(report.shift.startedAt)}`}
          {report.shift?.endedAt   && ` → ${fmtTime(report.shift.endedAt)}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-emerald-400 text-sm font-semibold">{fmt(report.totalRevenue)}</p>
        <p className="text-slate-500 text-xs">{report.totalOrders} orders</p>
      </div>
    </button>
  )
}

// ── Generate modal ────────────────────────────────────────────

function GenerateModal({ shifts, onGenerate, onClose }) {
  const [shiftId,  setShiftId]  = useState('')
  const [typeCode, setTypeCode] = useState('shift')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await onGenerate({ reportTypeCode: typeCode, shiftId: shiftId || undefined })
    } catch (err) {
      setError(err.message ?? 'Generation failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <form onSubmit={submit}
        className="w-full max-w-sm bg-night-800 rounded-2xl border border-slate-700 p-5 space-y-4">
        <h3 className="text-white font-bold">Generate Report</h3>

        <div className="space-y-3">
          <div>
            <label className="text-slate-400 text-xs block mb-1">Report Type</label>
            <select value={typeCode} onChange={e => setTypeCode(e.target.value)}
              className="w-full bg-night-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm
                         focus:outline-none focus:border-indigo-500">
              <option value="shift">Shift Report</option>
              <option value="nightly">Nightly Report</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 text-xs block mb-1">Shift (optional)</label>
            <select value={shiftId} onChange={e => setShiftId(e.target.value)}
              className="w-full bg-night-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm
                         focus:outline-none focus:border-indigo-500">
              <option value="">All shifts</option>
              {shifts.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label} · {fmtDate(s.startedAt)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold
                       hover:bg-indigo-500 disabled:opacity-50 transition-colors">
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function Reports() {
  const [reports,     setReports]     = useState([])
  const [shifts,      setShifts]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showGenerate,setShowGenerate] = useState(false)
  const [selected,    setSelected]    = useState(null)

  useEffect(() => {
    async function load() {
      const [reportsR, shiftsR] = await Promise.allSettled([
        api.get('/reports'),
        api.get('/shifts')
      ])
      if (reportsR.status === 'fulfilled') setReports(reportsR.value.data ?? [])
      if (shiftsR.status  === 'fulfilled') {
        setShifts((shiftsR.value.data ?? []).filter(s => s.statusCode === 'closed'))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleGenerate(payload) {
    const res = await api.post('/reports/generate', payload)
    setReports(prev => [res.data, ...prev])
    setShowGenerate(false)
    setSelected(res.data)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-slate-400">Loading…</div>
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Reports</h2>
        <button onClick={() => setShowGenerate(true)}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-sm font-medium
                     hover:bg-indigo-500 transition-colors">
          Generate Report
        </button>
      </div>

      {selected && (
        <ReportDetail
          report={selected}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setSelected(updated)
            setReports(prev => prev.map(r => r.id === updated.id ? updated : r))
          }}
        />
      )}

      {!selected && (
        <>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No reports yet.</p>
              <p className="text-slate-600 text-xs mt-1">Generate your first shift report above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map(r => (
                <ReportCard key={r.id} report={r} onSelect={setSelected} />
              ))}
            </div>
          )}
        </>
      )}

      {showGenerate && (
        <GenerateModal
          shifts={shifts}
          onGenerate={handleGenerate}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </div>
  )
}
