const zoneService = require('../services/zoneService')

async function list(req, res, next) {
  try {
    const zones = await zoneService.list(req.user.venueId)
    res.json({ data: zones })
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  try {
    const zone = await zoneService.create({
      name:    req.body.name,
      venueId: req.user.venueId
    })
    res.status(201).json({ data: zone })
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  try {
    const zone = await zoneService.update(
      req.params.id,
      req.user.venueId,
      { name: req.body.name }
    )
    res.json({ data: zone })
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    await zoneService.remove(req.params.id, req.user.venueId)
    res.json({ success: true })
  } catch (err) { next(err) }
}

module.exports = { list, create, update, remove }
