/**
 * APlus (Ayeyarwady Farmer Development Bank) MMQR integration.
 * API guide: Acquiring-Payment-Gateway_MMQR_API Guide_V1.1
 *
 * Auth: secretKey + eccode request headers
 * Create QR:  POST {base}/v1/order/create
 * Enquiry:    GET  {base}/v1/order/posEnquiry/{orderId}
 * Callback:   GET to our registered URL with query params (no HMAC signature)
 */

const crypto = require('crypto')
const logger = require('./logger')

const QR_TTL_MS = 10 * 60 * 1000 // 10 minutes

function fmtDate(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function credentials() {
  return {
    baseUrl:    process.env.MMQR_API_URL,
    secretKey:  process.env.MMQR_SECRET_KEY ?? process.env.MMQR_API_KEY,
    eccode:     process.env.MMQR_ECCODE,
    merchantId: process.env.MMQR_MERCHANT_ID
  }
}

/**
 * Call APlus /v1/order/create and return the EMV QR string.
 * Falls back to a non-scannable stub when credentials are absent (dev/UAT without keys).
 *
 * @param {object} params
 * @param {string} params.orderNumber  Our order number, ≤20 chars (used as ABank orderId)
 * @param {number} params.amount
 * @param {string} [params.currency='MMK']
 * @param {string} [params.description]
 */
async function generateQr({ orderNumber, amount, currency = 'MMK', description }) {
  const { baseUrl, secretKey, eccode, merchantId } = credentials()

  if (!baseUrl || !secretKey || !eccode || !merchantId) {
    logger.warn('MMQR credentials not fully configured — using stub QR (not scannable)')
    return {
      qrCode:      `MMQR-STUB|${orderNumber}|${amount.toFixed(2)}|${currency}|${Date.now()}`,
      qrExpiresAt: new Date(Date.now() + QR_TTL_MS)
    }
  }

  const body = {
    requestNo:   crypto.randomUUID(),
    orderId:     orderNumber,          // ABank's orderId = our orderNumber (≤20 chars)
    merchantId,
    currency,
    rewardPoint: 0,
    description: description ?? `NightPOS ${orderNumber}`,
    createdDate: fmtDate(new Date()),
    amount:      parseFloat(amount.toFixed(2))
  }

  const res = await fetch(`${baseUrl}/v1/order/create`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', secretKey, eccode },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(10_000)
  })

  const json = await res.json()

  if (!res.ok || json.respondCode !== 200 || !json.data?.qr) {
    const msg = json.respondMessage ?? json.errorMessage ?? `HTTP ${res.status}`
    logger.error('MMQR create order failed', { orderNumber, error: msg })
    throw Object.assign(new Error(`MMQR payment unavailable: ${msg}`), { status: 502 })
  }

  logger.info(`MMQR QR generated for order ${orderNumber}`)
  return {
    qrCode:      json.data.qr,
    qrExpiresAt: new Date(Date.now() + QR_TTL_MS)
  }
}

/**
 * Query ABank for current order status (useful for reconciliation / manual checks).
 * Returns null if credentials are absent or the request fails.
 */
async function enquireOrder(orderNumber) {
  const { baseUrl, secretKey, eccode } = credentials()
  if (!baseUrl || !secretKey || !eccode) return null

  try {
    const res = await fetch(`${baseUrl}/v1/order/posEnquiry/${orderNumber}`, {
      headers: { secretKey, eccode },
      signal:  AbortSignal.timeout(10_000)
    })
    if (!res.ok) return null
    return res.json()
  } catch (err) {
    logger.warn(`MMQR enquiry failed for ${orderNumber}`, { error: err.message })
    return null
  }
}

module.exports = { generateQr, enquireOrder, QR_TTL_MS }
