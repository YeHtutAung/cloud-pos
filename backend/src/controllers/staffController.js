const staffService = require('../services/staffService')

async function list(req, res, next) {
  try {
    const staff = await staffService.list(req.user.venueId)
    res.json({ data: staff })
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  try {
    const { name, pin, roleId, zoneId } = req.body
    const staff = await staffService.create({ name, pin, roleId, zoneId, venueId: req.user.venueId })
    res.status(201).json({ data: staff })
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  try {
    const data = {}
    if (req.body.name   !== undefined) data.name   = req.body.name
    if (req.body.zoneId !== undefined) data.zoneId = req.body.zoneId
    if (req.body.roleId !== undefined) data.roleId = req.body.roleId
    if (req.body.pin)                  data.pin    = req.body.pin
    const staff = await staffService.update(req.params.id, req.user.venueId, data)
    res.json({ data: staff })
  } catch (err) { next(err) }
}

async function toggleActive(req, res, next) {
  try {
    const isActive = req.body.isActive === true || req.body.isActive === 'true'
    const staff = await staffService.toggleActive(req.params.id, req.user.venueId, isActive)
    res.json({ data: staff })
  } catch (err) { next(err) }
}

module.exports = { list, create, update, toggleActive }
