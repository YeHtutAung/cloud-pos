const paymentService = require('../services/paymentService')

async function handleCallback(req, res, next) {
  try {
    const {
      orderId, amount, status,
      transactionId, billNo, endToEndId, transactionDateTime, institutionName,
      errorCode, errorDesc
    } = req.query
    await paymentService.handleCallback({
      orderId, amount, status,
      transactionId, billNo, endToEndId, transactionDateTime, institutionName,
      errorCode, errorDesc
    })
    res.json({ received: true })
  } catch (err) { next(err) }
}

async function getById(req, res, next) {
  try {
    const data = await paymentService.getPayment(req.params.id, req.user.venueId)
    res.json({ data })
  } catch (err) { next(err) }
}

async function refreshQr(req, res, next) {
  try {
    const data = await paymentService.refreshQr(req.params.id, req.user.venueId)
    res.json({ data })
  } catch (err) { next(err) }
}

module.exports = { handleCallback, getById, refreshQr }
