const prisma    = require('../config/prisma')
const logger    = require('../utils/logger')
const pdfSvc    = require('./pdfService')
const telegram  = require('../utils/telegram')

const REPORT_INCLUDE = {
  reportType: { select: { code: true, label: true } },
  shift:      { select: { label: true, startedAt: true, endedAt: true } }
}

async function list(venueId) {
  return prisma.report.findMany({
    where:   { venueId },
    include: REPORT_INCLUDE,
    orderBy: { createdAt: 'desc' }
  })
}

async function getById(id, venueId) {
  const report = await prisma.report.findFirst({
    where:   { id, venueId },
    include: REPORT_INCLUDE
  })
  if (!report) throw Object.assign(new Error('Report not found'), { status: 404 })
  return report
}

async function generate({ venueId, reportTypeCode, shiftId }) {
  const reportType = await prisma.reportType.findFirst({ where: { code: reportTypeCode } })
  if (!reportType) {
    throw Object.assign(new Error(`Unknown report type: ${reportTypeCode}`), { status: 422 })
  }

  const orderWhere = { venueId }
  if (shiftId) orderWhere.shiftId = shiftId

  const orders = await prisma.order.findMany({
    where:   orderWhere,
    include: {
      zone:  { select: { name: true } },
      staff: { select: { name: true } },
      items: {
        include: {
          menuItem: { include: { category: { select: { name: true } } } }
        }
      }
    }
  })

  let totalRevenue = 0
  let totalOrders  = orders.length
  let paidOrders   = 0
  let voidOrders   = 0
  let expiredQr    = 0
  let cashOrders   = 0

  const zoneMap     = {}
  const staffMap    = {}
  const categoryMap = {}

  for (const order of orders) {
    const amount = parseFloat(order.totalAmount)

    if (order.statusCode === 'void')       { voidOrders++;  continue }
    if (order.statusCode === 'expired_qr') { expiredQr++;   continue }
    if (order.statusCode === 'paid')       { paidOrders++;  totalRevenue += amount }

    // Paid and pending orders count toward breakdown
    const zoneName  = order.zone?.name  ?? 'Unknown'
    const staffName = order.staff?.name ?? 'Unknown'

    if (!zoneMap[zoneName])  zoneMap[zoneName]  = { orders: 0, revenue: 0 }
    if (!staffMap[staffName]) staffMap[staffName] = { orders: 0, revenue: 0 }

    zoneMap[zoneName].orders++
    staffMap[staffName].orders++

    if (order.statusCode === 'paid') {
      zoneMap[zoneName].revenue  += amount
      staffMap[staffName].revenue += amount
    }

    for (const item of order.items) {
      const catName  = item.menuItem?.category?.name ?? 'Uncategorized'
      const subtotal = parseFloat(item.subtotal)
      if (!categoryMap[catName]) categoryMap[catName] = { qty: 0, revenue: 0 }
      categoryMap[catName].qty     += item.quantity
      if (order.statusCode === 'paid') categoryMap[catName].revenue += subtotal
    }
  }

  return prisma.report.create({
    data: {
      venueId,
      reportTypeId: reportType.id,
      shiftId:      shiftId || null,
      totalRevenue,
      totalOrders,
      paidOrders,
      voidOrders,
      expiredQr,
      cashOrders,
      breakdown: { zones: zoneMap, staff: staffMap, categories: categoryMap }
    },
    include: REPORT_INCLUDE
  })
}

// ── Telegram helpers ──────────────────────────────────────────

async function getTelegramChatId(venueId) {
  const channel = await prisma.venueNotificationChannel.findFirst({
    where: { venueId, channel: 'telegram', isActive: true }
  })
  return channel?.config?.chat_id ?? null
}

function buildCaption(report, venue) {
  const shift = report.shift
  const lines = [
    `Shift Report — ${shift?.label ?? report.reportType?.label ?? 'Report'}`,
    shift?.startedAt
      ? `${new Date(shift.startedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '',
    '',
    `Revenue:  ${Math.round(parseFloat(report.totalRevenue)).toLocaleString()} MMK`,
    `Orders:   ${report.totalOrders} total  |  ${report.paidOrders} paid  |  ${report.voidOrders} void`,
    '',
    venue?.name ?? ''
  ]
  return lines.filter(Boolean).join('\n')
}

// ── Auto-generate + notify on shift close ─────────────────────

/**
 * Called fire-and-forget from shiftService.closeShift.
 * Generates a shift report, creates a PDF, and sends to Telegram if configured.
 * Never throws — all errors are logged and swallowed.
 */
async function generateAndNotify({ venueId, shiftId }) {
  try {
    const report  = await generate({ venueId, reportTypeCode: 'shift', shiftId })
    const venue   = await prisma.venue.findUnique({ where: { id: venueId }, select: { name: true } })
    const chatId  = await getTelegramChatId(venueId)

    if (!chatId) {
      logger.info(`No Telegram channel for venue ${venueId} — report saved, not sent`)
      return
    }

    const pdfBuffer = await pdfSvc.generatePdf(report, venue)
    await telegram.sendReport(chatId, pdfBuffer, buildCaption(report, venue))

    await prisma.report.update({
      where: { id: report.id },
      data:  { sentChannels: { ...(report.sentChannels ?? {}), telegram: true } }
    })

    logger.info(`Auto shift report generated and sent: ${report.id} venue:${venueId}`)
  } catch (err) {
    logger.error('Auto report failed', { error: err.message, venueId, shiftId })
  }
}

// ── Manual re-send ────────────────────────────────────────────

/**
 * Regenerate PDF for an existing report and send (or re-send) to Telegram.
 */
async function send(reportId, venueId) {
  const report = await getById(reportId, venueId)
  const venue  = await prisma.venue.findUnique({ where: { id: venueId }, select: { name: true } })
  const chatId = await getTelegramChatId(venueId)

  if (!chatId) {
    throw Object.assign(
      new Error('No active Telegram channel configured for this venue'),
      { status: 422 }
    )
  }

  const pdfBuffer = await pdfSvc.generatePdf(report, venue)
  await telegram.sendReport(chatId, pdfBuffer, buildCaption(report, venue))

  return prisma.report.update({
    where:   { id: reportId },
    data:    { sentChannels: { ...(report.sentChannels ?? {}), telegram: true } },
    include: REPORT_INCLUDE
  })
}

module.exports = { list, getById, generate, generateAndNotify, send }
