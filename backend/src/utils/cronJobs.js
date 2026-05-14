const cron   = require('node-cron')
const prisma = require('../config/prisma')
const logger = require('./logger')

function initCronJobs() {
  // Expire pending QR payments every minute
  cron.schedule('* * * * *', async () => {
    try {
      const result = await prisma.payment.updateMany({
        where: {
          statusCode: 'pending',
          qrExpiresAt: { lt: new Date() }
        },
        data: { statusCode: 'expired' }
      })
      if (result.count > 0) {
        logger.info(`Expired ${result.count} QR payment(s)`)
      }
    } catch (err) {
      logger.error('QR expiry cron failed', { error: err.message })
    }
  })

  logger.info('Cron jobs initialized')
}

module.exports = { initCronJobs }
