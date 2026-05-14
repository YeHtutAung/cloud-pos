const cron      = require('node-cron')
const prisma    = require('../config/prisma')
const logger    = require('./logger')
const { getIo } = require('../sockets')

function initCronJobs() {
  // Expire pending QR payments every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now     = new Date()
      const expired = await prisma.payment.findMany({
        where:   { statusCode: 'pending', qrExpiresAt: { lt: now } },
        select:  { id: true, orderId: true, order: { select: { venueId: true } } }
      })

      if (expired.length === 0) return

      await prisma.payment.updateMany({
        where: { id: { in: expired.map(p => p.id) } },
        data:  { statusCode: 'expired' }
      })

      // Notify each venue's connected clients
      const io      = getIo()
      const byVenue = {}
      for (const p of expired) {
        const vid = p.order.venueId
        if (!byVenue[vid]) byVenue[vid] = []
        byVenue[vid].push({ paymentId: p.id, orderId: p.orderId })
      }
      for (const [venueId, payments] of Object.entries(byVenue)) {
        io.to(`venue:${venueId}`).emit('payment:expired', { payments })
      }

      logger.info(`Expired ${expired.length} QR payment(s)`)
    } catch (err) {
      logger.error('QR expiry cron failed', { error: err.message })
    }
  })

  logger.info('Cron jobs initialized')
}

module.exports = { initCronJobs }
