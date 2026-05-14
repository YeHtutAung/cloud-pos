const PDFDocument = require('pdfkit')

// ── Formatters ────────────────────────────────────────────────

const fmt     = n  => `${Math.round(parseFloat(n || 0)).toLocaleString()} MMK`
const fmtDate = dt => new Date(dt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
const fmtTime = dt => new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

function fmtDur(start, end) {
  const ms = new Date(end) - new Date(start)
  const h  = Math.floor(ms / 3_600_000)
  const m  = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── Table helper ──────────────────────────────────────────────

function drawTable(doc, title, headers, rows, colWidths) {
  const LEFT    = 50
  const ROW_H   = 16
  const TOTAL_W = colWidths.reduce((a, b) => a + b, 0)
  const needed  = (rows.length + 2) * ROW_H + 20

  if (doc.y + needed > doc.page.height - 80) doc.addPage()

  // Section heading
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#4F46E5').text(title, LEFT, doc.y)
  doc.fillColor('#000000')

  const tableTop = doc.y + 3
  let y = tableTop

  // Header row
  doc.rect(LEFT, y, TOTAL_W, ROW_H).fill('#e2e8f0')
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e293b')
  let cx = LEFT
  headers.forEach((h, i) => {
    doc.text(h, cx + 4, y + 4, { width: colWidths[i] - 8, lineBreak: false })
    cx += colWidths[i]
  })
  y += ROW_H

  // Data rows
  doc.font('Helvetica').fontSize(8).fillColor('#000000')
  rows.forEach((row, ri) => {
    if (ri % 2 === 0) doc.rect(LEFT, y, TOTAL_W, ROW_H).fill('#f8fafc')
    doc.fillColor('#000000')
    cx = LEFT
    row.forEach((cell, ci) => {
      doc.text(String(cell ?? ''), cx + 4, y + 4, { width: colWidths[ci] - 8, lineBreak: false })
      cx += colWidths[ci]
    })
    y += ROW_H
  })

  // Outer border
  doc.rect(LEFT, tableTop, TOTAL_W, y - tableTop).stroke('#cbd5e1')

  // Advance cursor below table
  doc.y = y + 10
}

// ── Main export ───────────────────────────────────────────────

/**
 * Generate a PDF shift report.
 * @param {object} report  Prisma report record with breakdown JSON
 * @param {object} venue   { name: string }
 * @returns {Promise<Buffer>}
 */
function generatePdf(report, venue) {
  return new Promise((resolve, reject) => {
    const doc  = new PDFDocument({
      size:    'A4',
      margin:  50,
      info:    { Title: 'Shift Report', Author: 'NightLife POS' }
    })
    const chunks = []
    doc.on('data',  c  => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const PAGE_W = doc.page.width - 100   // usable width
    const LEFT   = 50
    const shift  = report.shift
    const bd     = report.breakdown ?? {}

    // ── Header ────────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a')
      .text('SHIFT REPORT', LEFT, 50, { align: 'center', width: PAGE_W })
    doc.fontSize(12).font('Helvetica').fillColor('#475569')
      .text(venue?.name ?? 'Venue', LEFT, doc.y + 4, { align: 'center', width: PAGE_W })

    doc.moveDown(0.6)
    doc.moveTo(LEFT, doc.y).lineTo(doc.page.width - LEFT, doc.y).lineWidth(1).strokeColor('#e2e8f0').stroke()
    doc.fillColor('#000000').moveDown(0.6)

    // ── Shift meta ────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b').text(shift?.label ?? 'Report', LEFT, doc.y)
    doc.fillColor('#475569').fontSize(9).font('Helvetica')

    if (shift?.startedAt) {
      const dateStr = fmtDate(shift.startedAt)
      const timeStr = `${fmtTime(shift.startedAt)}${shift.endedAt ? ` → ${fmtTime(shift.endedAt)}  (${fmtDur(shift.startedAt, shift.endedAt)})` : ''}`
      doc.text(`Date:  ${dateStr}`)
      doc.text(`Time:  ${timeStr}`)
    }
    doc.moveDown(0.8)

    // ── Summary box ───────────────────────────────────────────
    const sumY = doc.y
    doc.rect(LEFT, sumY, PAGE_W, 52).fill('#f8fafc').stroke('#e2e8f0')

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4F46E5')
      .text('SUMMARY', LEFT + 10, sumY + 8)

    doc.font('Helvetica').fillColor('#000000').fontSize(10)
    doc.text(`Revenue:  ${fmt(report.totalRevenue)}`, LEFT + 10, sumY + 22)

    const orderLine = `Total: ${report.totalOrders}   Paid: ${report.paidOrders}   Void: ${report.voidOrders}   Expired QR: ${report.expiredQr}`
    doc.fontSize(8).fillColor('#475569').text(orderLine, LEFT + 10, sumY + 38)

    doc.y = sumY + 62
    doc.moveDown(0.5)

    // ── Zone breakdown ────────────────────────────────────────
    const zones = Object.entries(bd.zones ?? {})
    if (zones.length > 0) {
      drawTable(doc,
        'ZONE BREAKDOWN',
        ['Zone', 'Orders', 'Revenue (MMK)'],
        zones.map(([name, d]) => [name, d.orders, fmt(d.revenue)]),
        [220, 80, 170]
      )
    }

    // ── Staff breakdown ───────────────────────────────────────
    const staff = Object.entries(bd.staff ?? {})
    if (staff.length > 0) {
      drawTable(doc,
        'STAFF BREAKDOWN',
        ['Staff', 'Orders', 'Revenue (MMK)'],
        staff.map(([name, d]) => [name, d.orders, fmt(d.revenue)]),
        [220, 80, 170]
      )
    }

    // ── Category breakdown ────────────────────────────────────
    const cats = Object.entries(bd.categories ?? {})
    if (cats.length > 0) {
      drawTable(doc,
        'CATEGORY BREAKDOWN',
        ['Category', 'Qty', 'Revenue (MMK)'],
        cats.map(([name, d]) => [name, d.qty, fmt(d.revenue)]),
        [220, 80, 170]
      )
    }

    // ── Footer ────────────────────────────────────────────────
    const footerY = doc.page.height - 60
    doc.moveTo(LEFT, footerY).lineTo(doc.page.width - LEFT, footerY)
      .lineWidth(0.5).strokeColor('#e2e8f0').stroke()
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
      .text(
        `Generated: ${fmtDate(report.createdAt || new Date())} ${fmtTime(report.createdAt || new Date())}   ·   NightLife POS`,
        LEFT, footerY + 8,
        { align: 'center', width: PAGE_W }
      )

    doc.end()
  })
}

module.exports = { generatePdf }
