const prisma         = require('../config/prisma')
const logger         = require('../utils/logger')
const { getIo }      = require('../sockets')
const reportService  = require('./reportService')

async function listShifts(venueId, { statusCode } = {}) {
  const where = { venueId }
  if (statusCode) where.statusCode = statusCode

  return prisma.shift.findMany({
    where,
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      _count:   { select: { orders: true } }
    },
    orderBy: { startedAt: 'desc' }
  })
}

async function getOpenShift(venueId) {
  const shift = await prisma.shift.findFirst({
    where:   { venueId, statusCode: 'open' },
    include: { openedBy: { select: { id: true, name: true } } }
  })
  if (!shift) throw Object.assign(new Error('No open shift'), { status: 404 })
  return shift
}

async function getShift(id, venueId) {
  const shift = await prisma.shift.findFirst({
    where: { id, venueId },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      orders:   { select: { statusCode: true, totalAmount: true } }
    }
  })
  if (!shift) throw Object.assign(new Error('Shift not found'), { status: 404 })

  const paidOrders  = shift.orders.filter(o => o.statusCode === 'paid')
  const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0)

  const { orders, ...shiftData } = shift
  return {
    ...shiftData,
    summary: {
      totalOrders:  shift.orders.length,
      paidOrders:   paidOrders.length,
      voidOrders:   shift.orders.filter(o => o.statusCode === 'void').length,
      openOrders:   shift.orders.filter(o => ['pending', 'confirmed'].includes(o.statusCode)).length,
      totalRevenue: parseFloat(totalRevenue.toFixed(2))
    }
  }
}

async function openShift({ label, venueId, openedById, floatAmount }) {
  const existing = await prisma.shift.findFirst({ where: { venueId, statusCode: 'open' } })
  if (existing) {
    throw Object.assign(
      new Error('A shift is already open — close it before opening a new one'),
      { status: 409 }
    )
  }

  const shift = await prisma.shift.create({
    data: {
      label,
      venueId,
      openedById,
      floatAmount: floatAmount != null ? parseFloat(floatAmount) : null,
      statusCode:  'open'
    },
    include: { openedBy: { select: { id: true, name: true } } }
  })

  getIo().to(`venue:${venueId}`).emit('shift:opened', shift)
  logger.info(`Shift opened: ${shift.id} "${shift.label}" venue:${venueId}`)
  return shift
}

async function closeShift(id, venueId, closedById) {
  const shift = await prisma.shift.findFirst({
    where:   { id, venueId },
    include: {
      orders: {
        where: { statusCode: { in: ['pending', 'confirmed'] } },
        take:  1
      }
    }
  })
  if (!shift) throw Object.assign(new Error('Shift not found'), { status: 404 })
  if (shift.statusCode !== 'open') {
    throw Object.assign(new Error('Shift is already closed'), { status: 409 })
  }
  if (shift.orders.length > 0) {
    throw Object.assign(
      new Error('Shift has open orders — resolve them before closing'),
      { status: 409 }
    )
  }

  const now     = new Date()
  const updated = await prisma.shift.update({
    where: { id },
    data:  { statusCode: 'closed', closedById, endedAt: now },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } }
    }
  })

  await prisma.auditLog.create({
    data: {
      venueId,
      actorId:  closedById,
      action:   'shift.close',
      entity:   'shift',
      entityId: id,
      before:   { statusCode: 'open' },
      after:    { statusCode: 'closed', endedAt: now }
    }
  })

  getIo().to(`venue:${venueId}`).emit('shift:closed', updated)
  logger.info(`Shift closed: ${id} "${updated.label}" venue:${venueId}`)

  reportService.generateAndNotify({ venueId, shiftId: id })
    .catch(err => logger.error('Auto report generation failed', { error: err.message, shiftId: id, venueId }))

  return updated
}

module.exports = { listShifts, getOpenShift, getShift, openShift, closeShift }
