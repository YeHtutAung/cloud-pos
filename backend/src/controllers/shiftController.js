const shiftService = require('../services/shiftService')

async function list(req, res, next) {
  try {
    const data = await shiftService.listShifts(req.user.venueId, {
      statusCode: req.query.statusCode
    })
    res.json({ data })
  } catch (err) { next(err) }
}

async function getOpen(req, res, next) {
  try {
    const data = await shiftService.getOpenShift(req.user.venueId)
    res.json({ data })
  } catch (err) { next(err) }
}

async function getById(req, res, next) {
  try {
    const data = await shiftService.getShift(req.params.id, req.user.venueId)
    res.json({ data })
  } catch (err) { next(err) }
}

async function open(req, res, next) {
  try {
    const { label, floatAmount } = req.body
    const data = await shiftService.openShift({
      label,
      floatAmount,
      venueId:    req.user.venueId,
      openedById: req.user.userId
    })
    res.status(201).json({ data })
  } catch (err) { next(err) }
}

async function close(req, res, next) {
  try {
    const data = await shiftService.closeShift(
      req.params.id,
      req.user.venueId,
      req.user.userId
    )
    res.json({ data })
  } catch (err) { next(err) }
}

module.exports = { list, getOpen, getById, open, close }
