import { useState, useEffect } from 'react'
import { api } from '../../services/api'

const ROLE_COLORS = {
  owner:      'bg-amber-900/50 text-amber-300 border-amber-700/50',
  supervisor: 'bg-indigo-900/50 text-indigo-300 border-indigo-700/50',
  staff:      'bg-slate-700/50 text-slate-300 border-slate-600/50',
  bartender:  'bg-teal-900/50 text-teal-300 border-teal-700/50'
}
function roleBadge(name) {
  return ROLE_COLORS[name] ?? 'bg-slate-700/50 text-slate-300 border-slate-600/50'
}

// ── Add / Edit form ───────────────────────────────────────────

function StaffForm({ initial, roles, zones, onSave, onCancel }) {
  const isEdit = !!initial
  const [name,    setName]    = useState(initial?.name   ?? '')
  const [pin,     setPin]     = useState('')
  const [roleId,  setRoleId]  = useState(initial?.role?.id ?? '')
  const [zoneId,  setZoneId]  = useState(initial?.zone?.id ?? '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    if (!name.trim()) { setError('Name is required'); return }
    if (!isEdit && (pin.length < 4 || !/^\d+$/.test(pin))) { setError('PIN must be 4–6 digits'); return }
    if (!roleId) { setError('Role is required'); return }
    setSaving(true); setError('')
    try {
      const payload = { name: name.trim(), roleId, zoneId: zoneId || null }
      if (!isEdit || pin) payload.pin = pin
      await onSave(payload)
    } catch (err) {
      setError(err.message ?? 'Save failed')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit}
      className="bg-night-800 rounded-xl border border-indigo-700/50 p-4 space-y-3">
      <h3 className="text-white text-sm font-semibold">{isEdit ? 'Edit Staff' : 'Add Staff Member'}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-slate-400 text-xs block mb-1">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Staff name"
            className="w-full bg-night-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm
                       placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="text-slate-400 text-xs block mb-1">{isEdit ? 'New PIN (leave blank to keep)' : 'PIN * (4–6 digits)'}</label>
          <input type="password" inputMode="numeric" value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={isEdit ? '••••' : '4–6 digits'}
            className="w-full bg-night-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm
                       placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="text-slate-400 text-xs block mb-1">Role *</label>
          <select value={roleId} onChange={e => setRoleId(e.target.value)}
            className="w-full bg-night-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm
                       focus:outline-none focus:border-indigo-500">
            <option value="">Select role…</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-slate-400 text-xs block mb-1">Zone (optional)</label>
          <select value={zoneId} onChange={e => setZoneId(e.target.value)}
            className="w-full bg-night-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm
                       focus:outline-none focus:border-indigo-500">
            <option value="">All zones</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold
                     hover:bg-indigo-500 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Staff')}
        </button>
      </div>
    </form>
  )
}

// ── Staff row ─────────────────────────────────────────────────

function StaffRow({ member, roles, zones, onEdit, onToggle }) {
  const [toggling, setToggling] = useState(false)

  async function toggle() {
    setToggling(true)
    try { await onToggle(member.id, !member.isActive) }
    finally { setToggling(false) }
  }

  return (
    <div className={`flex items-center gap-3 py-3 border-b border-slate-700/50 last:border-0
                     ${!member.isActive ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white text-sm font-medium">{member.name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${roleBadge(member.role?.name)}`}>
            {member.role?.name ?? '—'}
          </span>
          {member.zone && (
            <span className="text-xs text-slate-500">{member.zone.name}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => onEdit(member)}
          className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded
                     hover:bg-slate-700/50 transition-colors">
          Edit
        </button>
        <button onClick={toggle} disabled={toggling}
          className={`text-xs px-2 py-1 rounded font-medium transition-colors
                      ${member.isActive
                        ? 'bg-slate-700 text-slate-400 hover:bg-red-900/40 hover:text-red-400'
                        : 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60'}`}>
          {toggling ? '…' : (member.isActive ? 'Deactivate' : 'Activate')}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function StaffManager() {
  const [staff,    setStaff]    = useState([])
  const [roles,    setRoles]    = useState([])
  const [zones,    setZones]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)

  useEffect(() => {
    async function load() {
      const [staffR, rolesR, zonesR] = await Promise.allSettled([
        api.get('/staff'),
        api.get('/auth/roles'),
        api.get('/zones')
      ])
      if (staffR.status === 'fulfilled') setStaff(staffR.value.data ?? [])
      if (rolesR.status === 'fulfilled') setRoles(rolesR.value.data ?? [])
      if (zonesR.status === 'fulfilled') setZones(zonesR.value.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleAdd(payload) {
    const res = await api.post('/staff', payload)
    setStaff(prev => [...prev, res.data])
    setShowForm(false)
  }

  async function handleEdit(payload) {
    const res = await api.put(`/staff/${editing.id}`, payload)
    setStaff(prev => prev.map(s => s.id === editing.id ? res.data : s))
    setEditing(null)
  }

  async function handleToggle(id, isActive) {
    const res = await api.patch(`/staff/${id}/status`, { isActive })
    setStaff(prev => prev.map(s => s.id === id ? res.data : s))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-slate-400">Loading…</div>
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Staff</h2>
        <button onClick={() => { setShowForm(true); setEditing(null) }}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-sm font-medium
                     hover:bg-indigo-500 transition-colors">
          + Add Staff
        </button>
      </div>

      {(showForm && !editing) && (
        <StaffForm
          roles={roles}
          zones={zones}
          onSave={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editing && (
        <StaffForm
          initial={editing}
          roles={roles}
          zones={zones}
          onSave={handleEdit}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="bg-night-800 rounded-xl border border-slate-700 px-4">
        {staff.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No staff members yet.</p>
        ) : (
          staff.map(member => (
            <StaffRow
              key={member.id}
              member={member}
              roles={roles}
              zones={zones}
              onEdit={m => { setEditing(m); setShowForm(false) }}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
    </div>
  )
}
