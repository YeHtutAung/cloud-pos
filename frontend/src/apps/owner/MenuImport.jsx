import { useState, useRef } from 'react'
import { api } from '../../services/api'

const CSV_TEMPLATE = `category,name,price,happy_hour_price,is_fast_sell
Beer,Tiger Beer,2500,,true
Spirits,Johnnie Walker Black,8000,6000,false
Cocktails,Mojito,5000,4000,false`

export default function MenuImport() {
  const fileRef             = useRef(null)
  const [file,     setFile]     = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading,setUploading]= useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')

  // ── File handling ─────────────────────────────────────────

  function pickFile(f) {
    if (!f) return
    if (!f.name.endsWith('.csv')) { setError('Please select a CSV file.'); return }
    setFile(f)
    setResult(null)
    setError('')
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files[0])
  }

  // ── Upload ────────────────────────────────────────────────

  async function upload() {
    if (!file || uploading) return
    setUploading(true); setError(''); setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/menu/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(res.data)
      setFile(null)
    } catch (err) {
      setError(err.message ?? 'Upload failed')
    } finally { setUploading(false) }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'menu_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Menu Import</h2>
        <button onClick={downloadTemplate}
          className="text-indigo-400 text-xs hover:text-indigo-300 transition-colors">
          Download template CSV
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
                    px-6 py-12 cursor-pointer transition-colors
                    ${dragging
                      ? 'border-indigo-500 bg-indigo-900/20'
                      : 'border-slate-600 bg-night-800 hover:border-slate-500'}`}
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => pickFile(e.target.files[0])} />
        <div className="text-4xl select-none">{file ? '📄' : '📂'}</div>
        {file ? (
          <div className="text-center">
            <p className="text-white text-sm font-medium">{file.name}</p>
            <p className="text-slate-400 text-xs mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-slate-300 text-sm font-medium">Drop your CSV here or click to browse</p>
            <p className="text-slate-500 text-xs mt-1">Max 2 MB · columns: category, name, price, happy_hour_price, is_fast_sell</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {file && (
        <button onClick={upload} disabled={uploading}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm
                     hover:bg-indigo-500 disabled:opacity-50 active:bg-indigo-700 transition-colors">
          {uploading ? 'Importing…' : 'Import Menu'}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="bg-night-800 rounded-xl border border-slate-700 divide-y divide-slate-700/50">
          <div className="grid grid-cols-4 text-center py-4">
            {[
              { label: 'Created',  value: result.created,  color: 'text-emerald-400' },
              { label: 'Updated',  value: result.updated,  color: 'text-blue-400' },
              { label: 'Skipped',  value: result.skipped,  color: 'text-slate-400' },
              { label: 'Errors',   value: result.errors?.length ?? 0, color: 'text-red-400' }
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {result.errors?.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Row Errors</p>
              {result.errors.map((e, i) => (
                <div key={i} className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
                  <span className="text-slate-400">Row {e.row}</span>
                  {e.field && <span className="text-slate-500"> · {e.field}</span>}
                  {' — '}{e.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSV format hint */}
      <div className="bg-night-800 rounded-xl border border-slate-700 px-4 py-4">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">CSV Format</p>
        <pre className="text-slate-400 text-xs leading-relaxed overflow-x-auto whitespace-pre">
{`category,name,price,happy_hour_price,is_fast_sell
Beer,Tiger Beer,2500,,true
Spirits,Johnnie Walker,8000,6000,false`}
        </pre>
        <p className="text-slate-500 text-xs mt-3">
          <strong className="text-slate-400">happy_hour_price</strong> and <strong className="text-slate-400">is_fast_sell</strong> are optional.
          Import is idempotent — re-uploading the same item updates it.
        </p>
      </div>
    </div>
  )
}
