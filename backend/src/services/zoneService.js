const prisma = require('../config/prisma')
const logger = require('../utils/logger')

async function list(venueId) {
  return prisma.zone.findMany({
    where:   { venueId, isActive: true },
    include: { _count: { select: { tables: true } } },
    orderBy: { name: 'asc' }
  })
}

async function create({ name, venueId }) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } })
  if (!venue) throw Object.assign(new Error('Venue not found'), { status: 404 })

  const zone = await prisma.zone.create({ data: { name, venueId } })
  logger.info(`Zone created: ${zone.id} "${zone.name}" venue:${venueId}`)
  return zone
}

async function update(id, venueId, data) {
  const zone = await prisma.zone.findFirst({ where: { id, venueId, isActive: true } })
  if (!zone) throw Object.assign(new Error('Zone not found'), { status: 404 })

  return prisma.zone.update({ where: { id }, data })
}

async function remove(id, venueId) {
  const zone = await prisma.zone.findFirst({
    where:   { id, venueId, isActive: true },
    include: { tables: { where: { statusCode: 'occupied' } } }
  })
  if (!zone) throw Object.assign(new Error('Zone not found'), { status: 404 })

  if (zone.tables.length > 0) {
    throw Object.assign(
      new Error('Zone has occupied tables — clear all orders first'),
      { status: 409 }
    )
  }

  // Soft delete — preserve historical order references
  await prisma.zone.update({ where: { id }, data: { isActive: false } })
  logger.info(`Zone soft-deleted: ${id} venue:${venueId}`)
}

module.exports = { list, create, update, remove }
