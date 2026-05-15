const orderService = require('../services/orderService')

async function list(req, res, next) {
  try {
    const data = await orderService.listOrders(req.user.venueId, {
      shiftId:    req.query.shiftId,
      tableId:    req.query.tableId,
      statusCode: req.query.statusCode
    })
    res.json({ data })
  } catch (err) { next(err) }
}

async function getById(req, res, next) {
  try {
    const data = await orderService.getOrder(req.params.id, req.user.venueId)
    res.json({ data })
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  try {
    const { tableId, shiftId, items, notes } = req.body
    const data = await orderService.createOrder({
      tableId,
      shiftId,
      items,
      notes,
      staffId: req.user.userId,
      venueId: req.user.venueId
    })
    res.status(201).json({ data })
  } catch (err) { next(err) }
}

async function addItems(req, res, next) {
  try {
    const data = await orderService.addItems(
      req.params.id,
      req.user.venueId,
      req.body.items
    )
    res.json({ data })
  } catch (err) { next(err) }
}

async function removeItem(req, res, next) {
  try {
    const data = await orderService.removeItem(
      req.params.id,
      req.params.itemId,
      req.user.venueId
    )
    res.json({ data })
  } catch (err) { next(err) }
}

async function voidOrder(req, res, next) {
  try {
    const data = await orderService.voidOrder(
      req.params.id,
      req.user.venueId,
      req.user.userId,
      req.body.reason
    )
    res.json({ data })
  } catch (err) { next(err) }
}

async function initiatePayment(req, res, next) {
  try {
    const data = await orderService.initiatePayment(
      req.params.id,
      req.user.venueId,
      req.body.gatewayId
    )
    res.status(201).json({ data })
  } catch (err) { next(err) }
}

async function confirmOrder(req, res, next) {
  try {
    const data = await orderService.confirmOrder(req.params.id, req.user.venueId, req.user.userId)
    res.json({ data })
  } catch (err) { next(err) }
}

async function markReady(req, res, next) {
  try {
    const data = await orderService.markReady(req.params.id, req.user.venueId, req.user.userId)
    res.json({ data })
  } catch (err) { next(err) }
}

module.exports = { list, getById, create, addItems, removeItem, voidOrder, initiatePayment, confirmOrder, markReady }
