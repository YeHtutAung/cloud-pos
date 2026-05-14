const prisma = require('../config/prisma')
const logger = require('../utils/logger')

async function getById(id, requestingVenueId) {
  if (id !== requestingVenueId) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: {
      type:  true,
      zones: {
        where:   { isActive: true },
        include: { _count: { select: { tables: true } } },
        orderBy: { name: 'asc' }
      }
    }
  })
  if (!venue) throw Object.assign(new Error('Venue not found'), { status: 404 })
  return venue
}

async function create({ name, typeId, operatingHours, ownerId }) {
  const type = await prisma.venueType.findUnique({ where: { id: typeId } })
  if (!type || !type.isActive) {
    throw Object.assign(new Error('Venue type not found'), { status: 404 })
  }
  const venue = await prisma.venue.create({
    data:    { name, typeId, operatingHours, ownerId },
    include: { type: true }
  })
  logger.info(`Venue created: ${venue.id} "${venue.name}"`)
  return venue
}

async function update(id, requestingVenueId, data) {
  if (id !== requestingVenueId) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  const venue = await prisma.venue.findUnique({ where: { id } })
  if (!venue) throw Object.assign(new Error('Venue not found'), { status: 404 })

  return prisma.venue.update({
    where:   { id },
    data,
    include: { type: true }
  })
}

async function listTypes() {
  return prisma.venueType.findMany({
    where:   { isActive: true },
    orderBy: { name: 'asc' }
  })
}

async function listGateways(venueId) {
  return prisma.paymentGateway.findMany({
    where:   { venueId, isActive: true },
    select:  { id: true, name: true, type: true },
    orderBy: { name: 'asc' }
  })
}

module.exports = { getById, create, update, listTypes, listGateways }
