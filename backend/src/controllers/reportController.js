const reportService = require('../services/reportService')

async function list(req, res, next) {
  try {
    const reports = await reportService.list(req.user.venueId)
    res.json({ data: reports })
  } catch (err) { next(err) }
}

async function getById(req, res, next) {
  try {
    const report = await reportService.getById(req.params.id, req.user.venueId)
    res.json({ data: report })
  } catch (err) { next(err) }
}

async function generate(req, res, next) {
  try {
    const { reportTypeCode, shiftId } = req.body
    const report = await reportService.generate({
      venueId: req.user.venueId,
      reportTypeCode,
      shiftId
    })
    res.status(201).json({ data: report })
  } catch (err) { next(err) }
}

async function send(req, res, next) {
  try {
    const report = await reportService.send(req.params.id, req.user.venueId)
    res.json({ data: report })
  } catch (err) { next(err) }
}

module.exports = { list, getById, generate, send }
