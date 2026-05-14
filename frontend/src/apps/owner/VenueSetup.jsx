import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'

// ── Sub-components ────────────────────────────────────────────

function TableItem({ table, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete(table.id) } finally { setDeleting(false); setConfirming(false) }
  }

  if (confirming) return (
    <div className="flex items-center justify-between py-2 px-3 bg-red-900/20 rounded-lg border border-red-800/40">
      <span className="text-red-300 text-sm">Delete "{table.label}"?</span>
      <div className="flex gap-2">
        <button onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600">
          Cancel
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="text-xs px-2 py-1 rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-50">
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-700/30 group">
      <span className="text-slate-300 text-sm">{table.label}</span>
      <button onClick={() => setConfirming(true)}
        className="text-slate-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
        Remove
      </button>
    </div>
  )
}

function AddTableForm({ zoneId, onAdd }) {
  const [label,   setLabel]   = useState('')
  const [adding,  setAdding]  = useState(false)
  const [error,   setError]   = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!label.trim() || adding) return
    setAdding(true); setError('')
    try {
      await onAdd(zoneId, label.trim())
      setLabel('')
    } catch (err) {
      setError(err.message)
    } finally { setAdding(false) }
  }

  return (
    <form onSubmit={submit} className="flex gap-2 mt-2">
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Table label, e.g. VIP-1"
        className="flex-1 bg-night-900 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm
                   placeholder-slate-500 focus:outline-none focus:border-indigo-500"
      />
      <button type="submit" disabled={!label.trim() || adding}
        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium
                   hover:bg-indigo-500 disabled:opacity-40 transition-colors">
        {adding ? '…' : '+ Add'}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </form>
  )
}

function ZoneAccordion({ zone, tables, onRenameZone, onDeleteZone, onAddTable, onDeleteTable }) {
  const [open,        setOpen]        = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [name,        setName]        = useState(zone.name)
  const [saving,      setSaving]      = useState(false)
  const [confirming,  setConfirming]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  async function saveRename() {
    if (!name.trim() || name === zone.name) { setEditing(false); return }
    setSaving(true)
    try { await onRenameZone(zone.id, name.trim()); setEditing(false) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try { await onDeleteZone(zone.id) }
    finally { setDeleting(false); setConfirming(false) }
  }

  return (
    <div className="bg-night-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Zone header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-2 text-left">
          <span className={`text-slate-500 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setName(zone.name); setEditing(false) } }}
              onBlur={saveRename}
              className="bg-transparent border-b border-indigo-500 text-white text-sm font-semibold
                         focus:outline-none w-40"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="text-white text-sm font-semibold">{zone.name}</span>
          )}
          <span className="text-slate-500 text-xs">{tables.length} table{tables.length !== 1 ? 's' : ''}</span>
        </button>

        <div className="flex gap-2 shrink-0">
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded hover:bg-slate-700/50 transition-colors">
              Rename
            </button>
          )}
          {saving && <span className="text-slate-500 text-xs">Saving…</span>}
          {confirming ? (
            <div className="flex gap-1">
              <button onClick={() => setConfirming(false)}
                className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="text-xs px-2 py-1 rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-50">
                {deleting ? '…' : 'Delete'}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)}
              className="text-slate-600 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-slate-700/50 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Zone body */}
      {open && (
        <div className="border-t border-slate-700/50 px-4 py-3 space-y-1">
          {tables.length === 0 && (
            <p className="text-slate-500 text-xs py-1">No tables yet.</p>
          )}
          {tables.map(t => (
            <TableItem key={t.id} table={t} onDelete={onDeleteTable} />
          ))}
          <AddTableForm zoneId={zone.id} onAdd={onAddTable} />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function VenueSetup() {
  const [zones,    setZones]    = useState([])
  const [tables,   setTables]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [newZone,  setNewZone]  = useState('')
  const [adding,   setAdding]   = useState(false)
  const [error,    setError]    = useState('')

  const load = useCallback(async () => {
    const [zonesR, tablesR] = await Promise.allSettled([
      api.get('/zones'),
      api.get('/tables')
    ])
    if (zonesR.status  === 'fulfilled') setZones(zonesR.value.data ?? [])
    if (tablesR.status === 'fulfilled') setTables(tablesR.value.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Actions ────────────────────────────────────────────────

  async function addZone(e) {
    e.preventDefault()
    if (!newZone.trim() || adding) return
    setAdding(true); setError('')
    try {
      await api.post('/zones', { name: newZone.trim() })
      setNewZone('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally { setAdding(false) }
  }

  async function renameZone(id, name) {
    await api.put(`/zones/${id}`, { name })
    setZones(prev => prev.map(z => z.id === id ? { ...z, name } : z))
  }

  async function deleteZone(id) {
    await api.delete(`/zones/${id}`)
    setZones(prev => prev.filter(z => z.id !== id))
    setTables(prev => prev.filter(t => t.zoneId !== id))
  }

  async function addTable(zoneId, label) {
    const res = await api.post('/tables', { label, zoneId })
    setTables(prev => [...prev, res.data])
  }

  async function deleteTable(id) {
    await api.delete(`/tables/${id}`)
    setTables(prev => prev.filter(t => t.id !== id))
  }

  // ── Group tables by zone ───────────────────────────────────

  const tablesByZone = zones.reduce((acc, z) => {
    acc[z.id] = tables.filter(t => t.zoneId === z.id)
    return acc
  }, {})

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-slate-400">Loading…</div>
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Zones & Tables</h2>
        <span className="text-slate-500 text-xs">{zones.length} zone{zones.length !== 1 ? 's' : ''}</span>
      </div>

      {zones.map(zone => (
        <ZoneAccordion
          key={zone.id}
          zone={zone}
          tables={tablesByZone[zone.id] ?? []}
          onRenameZone={renameZone}
          onDeleteZone={deleteZone}
          onAddTable={addTable}
          onDeleteTable={deleteTable}
        />
      ))}

      {zones.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-6">No zones yet. Add your first zone below.</p>
      )}

      {/* Add zone */}
      <form onSubmit={addZone}
        className="bg-night-800 rounded-xl border border-slate-700 p-4 flex gap-3">
        <input
          value={newZone}
          onChange={e => setNewZone(e.target.value)}
          placeholder="New zone name, e.g. VIP, Bar, Rooftop"
          className="flex-1 bg-night-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm
                     placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button type="submit" disabled={!newZone.trim() || adding}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold
                     hover:bg-indigo-500 disabled:opacity-40 transition-colors whitespace-nowrap">
          {adding ? 'Adding…' : '+ Add Zone'}
        </button>
      </form>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
