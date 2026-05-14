const prisma              = require('../config/prisma')
const logger              = require('../utils/logger')
const { getIo }           = require('../sockets')
const { getEffectivePrice } = require('./menuService')
const mmqr                = require('../utils/mmqr')

// ── Helpers ──────────────────────────────────────────────────

async function nextOrderNumber(venueId) {
  const last = await prisma.order.findFirst({
    where:   { venueId },
    select:  { orderNumber: true },
    orderBy: { createdAt: 'desc' }
  })
  const n = last ? parseInt(last.orderNumber.replace('ORD-', ''), 10) + 1 : 1
  return `ORD-${String(n).padStart(4, '0')}`
}

async function resolveItems(items, venueId) {
  const rows = []
  let total  = 0
  for (const { menuItemId, quantity } of items) {
    const menuItem = await prisma.menuItem.findFirst({
      where: { id: menuItemId, venueId, isActive: true }
    })
    if (!menuItem) {
      throw Object.assign(new Error(`Menu item not found: ${menuItemId}`), { status: 404 })
    }
    const priceRecord = await getEffectivePrice(menuItemId)
    const unitPrice   = parseFloat(priceRecord.price)
    const subtotal    = parseFloat((unitPrice * quantity).toFixed(2))
    total            += subtotal
    rows.push({ menuItemId, name: menuItem.name, price: unitPrice, quantity, subtotal })
  }
  return { rows, total: parseFloat(total.toFixed(2)) }
}

// ── Query ────────────────────────────────────────────────────

async function listOrders(venueId, { shiftId, tableId, statusCode } = {}) {
  const where = { venueId }
  if (shiftId)    where.shiftId    = shiftId
  if (tableId)    where.tableId    = tableId
  if (statusCode) where.statusCode = statusCode

  return prisma.order.findMany({
    where,
    include: {
      items:    { include: { menuItem: { select: { id: true, name: true } } } },
      staff:    { select: { id: true, name: true } },
      table:    { select: { id: true, label: true } },
      payments: {
        where:   { statusCode: { in: ['pending', 'paid'] } },
        orderBy: { createdAt: 'desc' },
        take:    1
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

async function getOrder(id, venueId) {
  const order = await prisma.order.findFirst({
    where: { id, venueId },
    include: {
      items:    { include: { menuItem: { select: { id: true, name: true, imageUrl: true } } } },
      staff:    { select: { id: true, name: true } },
      table:    { select: { id: true, label: true } },
      zone:     { select: { id: true, name: true } },
      shift:    { select: { id: true, label: true } },
      payments: { orderBy: { createdAt: 'desc' } }
    }
  })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  return order
}

// ── Mutations ────────────────────────────────────────────────

async function createOrder({ tableId, shiftId, staffId, venueId, items, notes }) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, zone: { venueId, isActive: true } }
  })
  if (!table) throw Object.assign(new Error('Table not found'), { status: 404 })

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, venueId, statusCode: 'open' }
  })
  if (!shift) throw Object.assign(new Error('No open shift found with that ID'), { status: 404 })

  const { rows, total } = await resolveItems(items, venueId)
  const orderNumber     = await nextOrderNumber(venueId)

  const order = await prisma.order.create({
    data: {
      orderNumber,
      tableId,
      zoneId:      table.zoneId,
      shiftId,
      staffId,
      venueId,
      statusCode:  'pending',
      totalAmount: total,
      notes:       notes || null,
      items:       { create: rows }
    },
    include: {
      items: true,
      staff: { select: { id: true, name: true } },
      table: { select: { id: true, label: true } }
    }
  })

  await prisma.table.update({ where: { id: tableId }, data: { statusCode: 'occupied' } })

  const io = getIo()
  io.to(`venue:${venueId}`).emit('order:created',  order)
  io.to(`venue:${venueId}`).emit('table:updated',  { id: tableId, statusCode: 'occupied' })

  logger.info(`Order created: ${order.orderNumber} table:${table.label} venue:${venueId}`)
  return order
}

async function addItems(orderId, venueId, items) {
  const order = await prisma.order.findFirst({ where: { id: orderId, venueId } })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (['void', 'paid'].includes(order.statusCode)) {
    throw Object.assign(new Error(`Cannot modify a ${order.statusCode} order`), { status: 409 })
  }

  const { rows, total } = await resolveItems(items, venueId)
  await prisma.orderItem.createMany({ data: rows.map(r => ({ ...r, orderId })) })

  const updated = await prisma.order.update({
    where:   { id: orderId },
    data:    { totalAmount: { increment: total } },
    include: {
      items: { include: { menuItem: { select: { id: true, name: true } } } },
      table: { select: { id: true, label: true } }
    }
  })

  getIo().to(`venue:${venueId}`).emit('order:updated', updated)
  return updated
}

async function removeItem(orderId, itemId, venueId) {
  const order = await prisma.order.findFirst({ where: { id: orderId, venueId } })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (['void', 'paid'].includes(order.statusCode)) {
    throw Object.assign(new Error(`Cannot modify a ${order.statusCode} order`), { status: 409 })
  }

  const item = await prisma.orderItem.findFirst({ where: { id: itemId, orderId } })
  if (!item) throw Object.assign(new Error('Order item not found'), { status: 404 })

  await prisma.orderItem.delete({ where: { id: itemId } })

  const updated = await prisma.order.update({
    where:   { id: orderId },
    data:    { totalAmount: { decrement: item.subtotal } },
    include: {
      items: { include: { menuItem: { select: { id: true, name: true } } } },
      table: { select: { id: true, label: true } }
    }
  })

  getIo().to(`venue:${venueId}`).emit('order:updated', updated)
  return updated
}

async function voidOrder(orderId, venueId, actorId, reason) {
  const order = await prisma.order.findFirst({ where: { id: orderId, venueId } })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (order.statusCode === 'void') {
    throw Object.assign(new Error('Order is already voided'), { status: 409 })
  }
  if (order.statusCode === 'paid') {
    throw Object.assign(new Error('Cannot void a paid order'), { status: 409 })
  }

  await prisma.order.update({ where: { id: orderId }, data: { statusCode: 'void' } })

  // Free the table if no other non-void orders remain on it
  const otherActive = await prisma.order.count({
    where: { tableId: order.tableId, statusCode: { notIn: ['void'] }, id: { not: orderId } }
  })
  if (otherActive === 0) {
    await prisma.table.update({ where: { id: order.tableId }, data: { statusCode: 'available' } })
    getIo().to(`venue:${venueId}`).emit('table:updated', { id: order.tableId, statusCode: 'available' })
  }

  await prisma.auditLog.create({
    data: {
      venueId,
      actorId,
      action:   'order.void',
      entity:   'order',
      entityId: orderId,
      before:   { statusCode: order.statusCode },
      after:    { statusCode: 'void', reason }
    }
  })

  const voided = await prisma.order.findUnique({
    where:   { id: orderId },
    include: {
      items: true,
      table: { select: { id: true, label: true } }
    }
  })

  getIo().to(`venue:${venueId}`).emit('order:voided', voided)
  logger.info(`Order voided: ${order.orderNumber} by:${actorId} venue:${venueId}`)
  return voided
}

// ── Payment initiation ───────────────────────────────────────

async function initiatePayment(orderId, venueId, gatewayId) {
  const order = await prisma.order.findFirst({ where: { id: orderId, venueId } })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (order.statusCode === 'void') {
    throw Object.assign(new Error('Cannot pay a voided order'), { status: 409 })
  }
  if (order.statusCode === 'paid') {
    throw Object.assign(new Error('Order is already paid'), { status: 409 })
  }

  // Idempotent — return live pending payment if QR is still valid
  const existing = await prisma.payment.findFirst({
    where: { orderId, statusCode: 'pending' }
  })
  if (existing && existing.qrExpiresAt > new Date()) return existing

  const gateway = await prisma.paymentGateway.findFirst({
    where: { id: gatewayId, venueId, isActive: true }
  })
  if (!gateway) throw Object.assign(new Error('Payment gateway not found'), { status: 404 })

  const { qrCode, qrExpiresAt } = await mmqr.generateQr({
    orderNumber: order.orderNumber,
    amount:      parseFloat(order.totalAmount),
    currency:    'MMK'
  })

  const payment = await prisma.payment.create({
    data: { orderId, gatewayId, statusCode: 'pending', amount: parseFloat(order.totalAmount), qrCode, qrExpiresAt }
  })

  getIo().to(`venue:${venueId}`).emit('payment:pending', {
    orderId,
    paymentId:  payment.id,
    qrCode,
    qrExpiresAt
  })
  logger.info(`Payment initiated: ${payment.id} order:${order.orderNumber} venue:${venueId}`)
  return payment
}

module.exports = { listOrders, getOrder, createOrder, addItems, removeItem, voidOrder, initiatePayment }
