const tableService = require('../services/tableService')

async function list(req, res, next) {
  try {
    const tables = await tableService.list(req.user.venueId, req.query.zoneId)
    res.json({ data: tables })
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  try {
    const table = await tableService.create({
      label:   req.body.label,
      zoneId:  req.body.zoneId,
      venueId: req.user.venueId
    })
    res.status(201).json({ data: table })
  } catch (err) { next(err) }
}

async function updateStatus(req, res, next) {
  try {
    const table = await tableService.updateStatus(
      req.params.id,
      req.user.venueId,
      req.body.statusCode
    )
    res.json({ data: table })
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    await tableService.remove(req.params.id, req.user.venueId)
    res.json({ success: true })
  } catch (err) { next(err) }
}

module.exports = { list, create, updateStatus, remove }
