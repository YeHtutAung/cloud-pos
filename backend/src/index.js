require('dotenv').config()
const express      = require('express')
const http         = require('http')
const cors         = require('cors')
const helmet       = require('helmet')
const morgan       = require('morgan')
const rateLimit    = require('express-rate-limit')

const { initSocket }   = require('./sockets')
const { initCronJobs } = require('./utils/cronJobs')
const logger           = require('./utils/logger')

// Routes
const authRoutes    = require('./routes/auth')
const venueRoutes   = require('./routes/venues')
const zoneRoutes    = require('./routes/zones')
const tableRoutes   = require('./routes/tables')
const menuRoutes    = require('./routes/menu')
const staffRoutes   = require('./routes/staff')
const shiftRoutes   = require('./routes/shifts')
const orderRoutes   = require('./routes/orders')
const paymentRoutes = require('./routes/payments')
const reportRoutes  = require('./routes/reports')

const app    = express()
const server = http.createServer(app)

// ── Middleware ───────────────────────────────────────────────
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(morgan('dev'))
app.use(express.json())
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }))

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',     authRoutes)
app.use('/api/venues',   venueRoutes)
app.use('/api/zones',    zoneRoutes)
app.use('/api/tables',   tableRoutes)
app.use('/api/menu',     menuRoutes)
app.use('/api/staff',    staffRoutes)
app.use('/api/shifts',   shiftRoutes)
app.use('/api/orders',   orderRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/reports',  reportRoutes)

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }))

// ── WebSocket ────────────────────────────────────────────────
initSocket(server)

// ── Cron Jobs ────────────────────────────────────────────────
initCronJobs()

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.stack)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  })
})

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
