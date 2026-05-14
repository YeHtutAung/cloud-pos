import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../services/api'

const VENUE_ID = import.meta.env.VITE_VENUE_ID || ''
const MIN_PIN  = 4
const MAX_PIN  = 6

export default function PinLogin() {
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [shaking, setShaking] = useState(false)
  const loadingRef = useRef(false)   // ref prevents stale-closure issues in effects
  const { setAuth } = useAuthStore()
  const navigate    = useNavigate()

  async function doLogin(pinValue) {
    if (loadingRef.current || pinValue.length < MIN_PIN) return
    loadingRef.current = true
    setLoading(true)
    setError('')
    try {
      const result = await api.post('/auth/pin-login', { pin: pinValue, venueId: VENUE_ID })
      setAuth(result.user, result.token, result.refreshToken)
      navigate(`/${result.user.role}`, { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid PIN')
      setPin('')
      setShaking(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  function handleDigit(d) {
    if (loadingRef.current) return
    setPin(p => p.length < MAX_PIN ? p + d : p)
  }

  function handleDelete() {
    if (loadingRef.current) return
    setPin(p => p.slice(0, -1))
  }

  // Auto-submit when PIN reaches max length
  useEffect(() => {
    if (pin.length === MAX_PIN) doLogin(pin)
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Physical keyboard / hardware PIN pad support
  useEffect(() => {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9')                      handleDigit(e.key)
      else if (e.key === 'Backspace')                         handleDelete()
      else if (e.key === 'Enter' && pin.length >= MIN_PIN)    doLogin(pin)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!VENUE_ID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-night-900 px-4">
        <div className="text-center space-y-1">
          <p className="text-amber-400 font-mono text-sm">VITE_VENUE_ID not set</p>
          <p className="text-slate-500 text-xs">Add your venue UUID to frontend/.env</p>
        </div>
      </div>
    )
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="min-h-screen flex items-center justify-center bg-night-900 px-4">
      <div className="w-full max-w-xs">

        <h1 className="text-3xl font-bold text-center text-white mb-1">Nightlife POS</h1>
        <p className="text-slate-400 text-center text-sm mb-8">Enter your PIN to continue</p>

        {/* PIN dot indicators */}
        <div
          className={`flex justify-center gap-4 mb-2 ${shaking ? 'animate-shake' : ''}`}
          onAnimationEnd={() => setShaking(false)}
        >
          {Array.from({ length: MAX_PIN }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? 'bg-indigo-500 border-indigo-500 scale-110'
                  : 'border-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Fixed-height error row so layout doesn't jump */}
        <div className="h-7 flex items-center justify-center mb-5">
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {keys.map((k, i) => {
            if (k === '') return <div key={i} />

            if (k === '⌫') return (
              <button
                key={i}
                type="button"
                onClick={handleDelete}
                disabled={loading || pin.length === 0}
                className="h-16 rounded-2xl bg-slate-700 text-white text-2xl font-medium
                           active:bg-slate-600 disabled:opacity-30 transition-colors
                           select-none touch-manipulation"
              >
                {k}
              </button>
            )

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDigit(k)}
                disabled={loading}
                className="h-16 rounded-2xl bg-night-800 text-white text-2xl font-semibold
                           active:bg-slate-700 disabled:opacity-30 transition-colors
                           border border-slate-700/50 select-none touch-manipulation"
              >
                {k}
              </button>
            )
          })}
        </div>

        {/* Login button — needed for PINs shorter than MAX_PIN */}
        <button
          type="button"
          onClick={() => doLogin(pin)}
          disabled={pin.length < MIN_PIN || loading}
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-semibold text-lg
                     disabled:opacity-30 hover:bg-indigo-500 active:bg-indigo-700 transition-colors
                     select-none touch-manipulation"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                <path  className="opacity-75" fill="currentColor"
                       d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Verifying…
            </span>
          ) : 'Login'}
        </button>

      </div>
    </div>
  )
}
