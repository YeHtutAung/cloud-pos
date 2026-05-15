const cron           = require('node-cron')
const prisma         = require('../config/prisma')
const logger         = require('./logger')
const { getIo }      = require('../sockets')
const mmqr           = require('./mmqr')
const paymentService = require('../services/paymentService')

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

  // UAT polling — disabled in production when real callback is registered
  const pollMs = parseInt(process.env.MMQR_POLL_INTERVAL_MS || '0', 10)
  if (pollMs > 0) {
    setInterval(async () => {
      try {
        const pending = await prisma.payment.findMany({
          where:   { statusCode: 'pending', qrExpiresAt: { gt: new Date() } },
          include: { order: { select: { orderNumber: true } } }
        })
        if (pending.length === 0) return

        await Promise.allSettled(pending.map(async (payment) => {
          const orderNumber = payment.order.orderNumber
          const result      = await mmqr.enquireOrder(orderNumber)
          if (!result?.data) return

          const { paymentTxnStatus, posTransactionId, billNo, endToEndId,
                  transactionDateTime, institutionName, amount } = result.data

          if (paymentTxnStatus === 200) {
            logger.info(`Poll: payment confirmed for ${orderNumber}`)
            await paymentService.handleCallback({
              orderId:             orderNumber,
              amount,
              status:              '200',
              transactionId:       posTransactionId,
              billNo,
              endToEndId,
              transactionDateTime,
              institutionName
            })
          } else if (paymentTxnStatus === 500) {
            logger.info(`Poll: payment failed for ${orderNumber}`)
            await paymentService.handleCallback({
              orderId: orderNumber,
              amount,
              status:  '500',
              transactionId: posTransactionId,
              endToEndId,
              transactionDateTime,
              institutionName
            })
          }
          // 100 = still pending, 403 = not found yet — do nothing
        }))
      } catch (err) {
        logger.error('MMQR poll cron failed', { error: err.message })
      }
    }, pollMs)

    logger.info(`MMQR payment polling enabled every ${pollMs}ms`)
  }

  logger.info('Cron jobs initialized')
}

module.exports = { initCronJobs }
