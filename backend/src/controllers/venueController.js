const venueService = require('../services/venueService')

async function getById(req, res, next) {
  try {
    const venue = await venueService.getById(req.params.id, req.user.venueId)
    res.json({ data: venue })
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  try {
    const { name, typeId, operatingHours } = req.body
    const venue = await venueService.create({
      name,
      typeId,
      operatingHours,
      ownerId: req.user.userId
    })
    res.status(201).json({ data: venue })
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  try {
    const data = {}
    if (req.body.name !== undefined)           data.name           = req.body.name
    if (req.body.operatingHours !== undefined) data.operatingHours = req.body.operatingHours
    const venue = await venueService.update(req.params.id, req.user.venueId, data)
    res.json({ data: venue })
  } catch (err) { next(err) }
}

async function listTypes(req, res, next) {
  try {
    const types = await venueService.listTypes()
    res.json({ data: types })
  } catch (err) { next(err) }
}

async function listGateways(req, res, next) {
  try {
    const data = await venueService.listGateways(req.user.venueId)
    res.json({ data })
  } catch (err) { next(err) }
}

module.exports = { getById, create, update, listTypes, listGateways }
