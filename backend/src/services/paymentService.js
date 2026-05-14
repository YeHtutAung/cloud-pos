const prisma    = require('../config/prisma')
const logger    = require('../utils/logger')
const { getIo } = require('../sockets')
const mmqr      = require('../utils/mmqr')

// ── Callback handler (GET query params from APlus) ───────────

/**
 * Processes an APlus MMQR callback.
 * ABank fires GET requests with query params — no HMAC signature.
 *
 * Success params: orderId, amount, status(200), transactionId, billNo,
 *                 endToEndId, transactionDateTime, institutionName
 * Failure params: orderId, amount, status(500), errorCode, errorDesc,
 *                 transactionId, endToEndId, transactionDateTime, institutionName
 *
 * orderId here = our orderNumber (e.g. ORD-0001), sent to ABank at QR creation time.
 */
async function handleCallback({
  orderId,             // = order.orderNumber
  amount,
  status,
  transactionId,
  billNo,
  endToEndId,
  transactionDateTime,
  institutionName,
  errorCode,
  errorDesc
}) {
  // orderId in callback = orderNumber we sent to ABank
  const order = await prisma.order.findFirst({
    where:  { orderNumber: orderId },
    select: { id: true, orderNumber: true, totalAmount: true, tableId: true, venueId: true }
  })

  if (!order) {
    logger.warn(`MMQR callback: order not found for orderNumber=${orderId}`)
    return { received: true }
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, statusCode: { in: ['pending', 'expired'] } }
  })

  if (!payment) {
    logger.warn(`MMQR callback: no actionable payment for order ${orderId} (may be duplicate)`)
    return { received: true }
  }

  const { venueId, tableId, orderNumber } = order
  const isSuccess = String(status) === '200'

  if (isSuccess) {
    const paidAt = transactionDateTime ? new Date(transactionDateTime) : new Date()

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          statusCode: 'paid',
          gatewayRef: transactionId,
          paidAt,
          metadata: { transactionId, billNo, endToEndId, transactionDateTime, institutionName, amount }
        }
      })

      await tx.order.update({ where: { id: order.id }, data: { statusCode: 'paid' } })

      const otherActive = await tx.order.count({
        where: { tableId, statusCode: { notIn: ['void', 'paid'] }, id: { not: order.id } }
      })
      if (otherActive === 0) {
        await tx.table.update({ where: { id: tableId }, data: { statusCode: 'available' } })
      }

      const actor = await tx.user.findFirst({
        where:  { venueId, isActive: true, role: { name: 'owner' } },
        select: { id: true }
      })
      if (actor) {
        await tx.auditLog.create({
          data: {
            venueId,
            actorId:  actor.id,
            action:   'payment.confirmed',
            entity:   'payment',
            entityId: payment.id,
            before:   { statusCode: 'pending' },
            after:    { statusCode: 'paid', transactionId }
          }
        })
      }
    })

    const table = await prisma.table.findUnique({ where: { id: tableId }, select: { statusCode: true } })
    const io    = getIo()
    io.to(`venue:${venueId}`).emit('payment:confirmed', { orderId: order.id, paymentId: payment.id, transactionId })
    io.to(`venue:${venueId}`).emit('order:paid',        { orderId: order.id, orderNumber })
    if (table.statusCode === 'available') {
      io.to(`venue:${venueId}`).emit('table:updated', { id: tableId, statusCode: 'available' })
    }

    logger.info(`Payment confirmed: ${payment.id} order:${orderNumber} txn:${transactionId} venue:${venueId}`)

  } else {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        statusCode: 'failed',
        gatewayRef: transactionId ?? null,
        metadata:   { transactionId, errorCode, errorDesc, transactionDateTime, institutionName }
      }
    })

    getIo().to(`venue:${venueId}`).emit('payment:failed', { orderId: order.id, paymentId: payment.id })
    logger.info(`Payment failed: ${payment.id} order:${orderNumber} status:${status} venue:${venueId}`)
  }

  return { received: true }
}

// ── Getters ───────────────────────────────────────────────────

async function getPayment(paymentId, venueId) {
  const payment = await prisma.payment.findFirst({
    where:   { id: paymentId, order: { venueId } },
    include: { order: { select: { id: true, orderNumber: true, totalAmount: true } } }
  })
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 })
  return payment
}

// ── QR refresh ────────────────────────────────────────────────

async function refreshQr(paymentId, venueId) {
  const payment = await prisma.payment.findFirst({
    where:   { id: paymentId, order: { venueId } },
    include: { order: { select: { id: true, orderNumber: true, totalAmount: true } } }
  })
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 })
  if (!['pending', 'expired'].includes(payment.statusCode)) {
    throw Object.assign(
      new Error(`Cannot refresh QR for a ${payment.statusCode} payment`),
      { status: 409 }
    )
  }

  const { qrCode, qrExpiresAt } = await mmqr.generateQr({
    orderNumber: payment.order.orderNumber,
    amount:      parseFloat(payment.order.totalAmount),
    currency:    'MMK'
  })

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data:  { qrCode, qrExpiresAt, statusCode: 'pending' }
  })

  getIo().to(`venue:${venueId}`).emit('payment:pending', {
    orderId:    payment.order.id,
    paymentId,
    qrCode,
    qrExpiresAt
  })
  logger.info(`QR refreshed: ${paymentId} venue:${venueId}`)
  return updated
}

module.exports = { handleCallback, getPayment, refreshQr }
