const crypto = require('crypto')
const logger = require('../utils/logger')

/**
 * Verifies the HMAC-SHA256 signature on incoming MMQR webhook requests.
 * Expects header: X-MMQR-Signature: sha256=<hex>
 * Signs the raw request body with MMQR_WEBHOOK_SECRET.
 *
 * Requires req.rawBody to be set — index.js captures it via express.json verify callback.
 * Signature algorithm will be confirmed against real MyanmarPay docs in Step 11.
 */
function verifyMmqrWebhook(req, res, next) {
  const secret = process.env.MMQR_WEBHOOK_SECRET

  if (!secret) {
    logger.warn('MMQR_WEBHOOK_SECRET not configured — skipping signature verification')
    return next()
  }

  const signature = req.headers['x-mmqr-signature']
  if (!signature) {
    return res.status(401).json({ error: 'Missing X-MMQR-Signature header' })
  }

  if (!req.rawBody) {
    logger.error('rawBody not available for MMQR webhook — check express.json verify callback')
    return res.status(500).json({ error: 'Signature verification unavailable' })
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex')

  // timingSafeEqual throws if lengths differ — catch it
  try {
    const sigBuf  = Buffer.from(signature)
    const expBuf  = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      logger.warn('MMQR webhook: invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }
  } catch {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  next()
}

module.exports = verifyMmqrWebhook
