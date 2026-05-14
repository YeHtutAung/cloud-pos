const prisma  = require('../config/prisma')
const logger  = require('../utils/logger')
const { getIo } = require('../sockets')

async function list(venueId, zoneId) {
  const where = { zone: { venueId, isActive: true } }
  if (zoneId) where.zoneId = zoneId

  return prisma.table.findMany({
    where,
    include: { zone: { select: { id: true, name: true } } },
    orderBy: [{ zone: { name: 'asc' } }, { label: 'asc' }]
  })
}

async function create({ label, zoneId, venueId }) {
  const zone = await prisma.zone.findFirst({
    where: { id: zoneId, venueId, isActive: true }
  })
  if (!zone) throw Object.assign(new Error('Zone not found'), { status: 404 })

  const table = await prisma.table.create({
    data:    { label, zoneId },
    include: { zone: { select: { id: true, name: true } } }
  })
  logger.info(`Table created: ${table.id} "${table.label}" zone:${zoneId}`)
  return table
}

async function updateStatus(id, venueId, statusCode) {
  // Validate statusCode against lookup table — no hardcoded strings
  const status = await prisma.status.findFirst({
    where: { entity: 'table', code: statusCode, isActive: true }
  })
  if (!status) {
    throw Object.assign(new Error(`Invalid table status: ${statusCode}`), { status: 422 })
  }

  const table = await prisma.table.findFirst({
    where: { id, zone: { venueId, isActive: true } }
  })
  if (!table) throw Object.assign(new Error('Table not found'), { status: 404 })

  const updated = await prisma.table.update({
    where:   { id },
    data:    { statusCode },
    include: { zone: { select: { id: true, name: true } } }
  })

  // Broadcast to all clients in this venue's socket room
  try {
    getIo().to(`venue:${venueId}`).emit('table:updated', updated)
  } catch (err) {
    logger.warn('Socket emit skipped for table:updated', { error: err.message })
  }

  return updated
}

async function remove(id, venueId) {
  const table = await prisma.table.findFirst({
    where: { id, zone: { venueId } }
  })
  if (!table) throw Object.assign(new Error('Table not found'), { status: 404 })

  if (table.statusCode === 'occupied') {
    throw Object.assign(new Error('Cannot delete an occupied table'), { status: 409 })
  }

  await prisma.table.delete({ where: { id } })
  logger.info(`Table deleted: ${id} venue:${venueId}`)
}

module.exports = { list, create, updateStatus, remove }
