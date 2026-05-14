const { parse }  = require('csv-parse/sync')
const prisma     = require('../config/prisma')
const logger     = require('../utils/logger')

// ── Categories ───────────────────────────────────────────────

async function listCategories(venueId) {
  return prisma.menuCategory.findMany({
    where:   { venueId, isActive: true },
    include: { _count: { select: { items: { where: { isActive: true } } } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  })
}

async function createCategory({ name, venueId }) {
  const existing = await prisma.menuCategory.findFirst({ where: { name, venueId } })
  if (existing) {
    throw Object.assign(new Error('Category already exists'), { status: 409 })
  }
  return prisma.menuCategory.create({ data: { name, venueId } })
}

async function updateCategory(id, venueId, data) {
  const cat = await prisma.menuCategory.findFirst({ where: { id, venueId, isActive: true } })
  if (!cat) throw Object.assign(new Error('Category not found'), { status: 404 })
  return prisma.menuCategory.update({ where: { id }, data })
}

async function deactivateCategory(id, venueId) {
  const cat = await prisma.menuCategory.findFirst({
    where:   { id, venueId, isActive: true },
    include: { items: { where: { isActive: true }, take: 1 } }
  })
  if (!cat) throw Object.assign(new Error('Category not found'), { status: 404 })
  if (cat.items.length > 0) {
    throw Object.assign(
      new Error('Category has active items — deactivate items first'),
      { status: 409 }
    )
  }
  await prisma.menuCategory.update({ where: { id }, data: { isActive: false } })
}

// ── Items ────────────────────────────────────────────────────

async function listItems(venueId, { categoryId, isFastSell } = {}) {
  const where = { venueId, isActive: true }
  if (categoryId)              where.categoryId = categoryId
  if (isFastSell !== undefined) {
    where.isFastSell = isFastSell === 'true' || isFastSell === true
  }

  return prisma.menuItem.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
      prices:   { where: { isActive: true }, orderBy: { priceType: 'asc' } }
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  })
}

async function createItem({ name, categoryId, venueId, isFastSell = false, sortOrder = 0, price, priceType = 'standard' }) {
  const category = await prisma.menuCategory.findFirst({
    where: { id: categoryId, venueId, isActive: true }
  })
  if (!category) throw Object.assign(new Error('Category not found'), { status: 404 })

  const parsed = parseFloat(price)
  if (isNaN(parsed) || parsed < 0) {
    throw Object.assign(new Error('Valid price required'), { status: 422 })
  }

  const item = await prisma.menuItem.create({
    data: {
      name,
      categoryId,
      venueId,
      isFastSell: Boolean(isFastSell),
      sortOrder:  parseInt(sortOrder, 10) || 0,
      prices:     { create: { price: parsed, priceType, isActive: true } }
    },
    include: {
      category: { select: { id: true, name: true } },
      prices:   { where: { isActive: true } }
    }
  })

  logger.info(`Menu item created: ${item.id} "${item.name}" venue:${venueId}`)
  return item
}

async function updateItem(id, venueId, data) {
  const item = await prisma.menuItem.findFirst({ where: { id, venueId, isActive: true } })
  if (!item) throw Object.assign(new Error('Menu item not found'), { status: 404 })

  if (data.categoryId) {
    const cat = await prisma.menuCategory.findFirst({
      where: { id: data.categoryId, venueId, isActive: true }
    })
    if (!cat) throw Object.assign(new Error('Category not found'), { status: 404 })
  }

  return prisma.menuItem.update({
    where:   { id },
    data,
    include: {
      category: { select: { id: true, name: true } },
      prices:   { where: { isActive: true } }
    }
  })
}

async function deactivateItem(id, venueId) {
  const item = await prisma.menuItem.findFirst({ where: { id, venueId, isActive: true } })
  if (!item) throw Object.assign(new Error('Menu item not found'), { status: 404 })
  await prisma.menuItem.update({ where: { id }, data: { isActive: false } })
  logger.info(`Menu item deactivated: ${id} venue:${venueId}`)
}

// ── Prices ───────────────────────────────────────────────────

async function addPrice(itemId, venueId, { price, priceType = 'standard', validFrom, validUntil }) {
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, venueId, isActive: true } })
  if (!item) throw Object.assign(new Error('Menu item not found'), { status: 404 })

  const parsed = parseFloat(price)
  if (isNaN(parsed) || parsed < 0) {
    throw Object.assign(new Error('Valid price required'), { status: 422 })
  }

  return prisma.menuItemPrice.create({
    data: {
      menuItemId: itemId,
      price:      parsed,
      priceType,
      validFrom:  validFrom  ? new Date(validFrom)  : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      isActive:   true
    }
  })
}

async function deactivatePrice(priceId, itemId, venueId) {
  const price = await prisma.menuItemPrice.findFirst({
    where: { id: priceId, menuItemId: itemId, menuItem: { venueId } }
  })
  if (!price) throw Object.assign(new Error('Price not found'), { status: 404 })
  await prisma.menuItemPrice.update({ where: { id: priceId }, data: { isActive: false } })
}

// ── Effective price — exported for use by order service ──────

/**
 * Returns the price that applies right now for a given menu item.
 * Priority: time-bounded special price (happy_hour / vip / promo)
 * that covers the current moment, then standard fallback.
 */
async function getEffectivePrice(menuItemId) {
  const now = new Date()

  const special = await prisma.menuItemPrice.findFirst({
    where: {
      menuItemId,
      isActive:  true,
      priceType: { not: 'standard' },
      OR: [
        // No time bounds = always active special price
        { validFrom: null, validUntil: null },
        // Explicitly within window
        { validFrom: { lte: now }, validUntil: { gte: now } }
      ]
    },
    orderBy: { createdAt: 'desc' }
  })
  if (special) return special

  const standard = await prisma.menuItemPrice.findFirst({
    where:   { menuItemId, isActive: true, priceType: 'standard' },
    orderBy: { createdAt: 'desc' }
  })
  if (!standard) {
    throw Object.assign(new Error(`No active price for item ${menuItemId}`), { status: 422 })
  }
  return standard
}

// ── CSV Import ───────────────────────────────────────────────

/**
 * Expected CSV columns (header row required):
 *   name, category, price, priceType*, isFastSell*, sortOrder*
 *   (* optional, defaults: standard, false, 0)
 *
 * Idempotent: same item name + venue = update. Same priceType = replace price.
 * Bad rows are skipped and reported; valid rows are always committed.
 */
async function importFromCsv(venueId, actorId, csvBuffer) {
  let records
  try {
    records = parse(csvBuffer.toString('utf8'), {
      columns:          true,
      skip_empty_lines: true,
      trim:             true
    })
  } catch (err) {
    throw Object.assign(new Error(`CSV parse error: ${err.message}`), { status: 422 })
  }

  if (!records.length) {
    throw Object.assign(new Error('CSV file is empty'), { status: 422 })
  }

  const required = ['name', 'category', 'price']
  const headers  = Object.keys(records[0])
  for (const col of required) {
    if (!headers.includes(col)) {
      throw Object.assign(new Error(`CSV missing required column: "${col}"`), { status: 422 })
    }
  }

  let created = 0, updated = 0, skipped = 0
  const errors = []

  for (let i = 0; i < records.length; i++) {
    const row    = records[i]
    const rowNum = i + 2 // account for header row, 1-indexed

    const {
      name,
      category:  categoryName,
      price,
      priceType  = 'standard',
      isFastSell = 'false',
      sortOrder  = '0'
    } = row

    // Row-level validation
    if (!name?.trim() || !categoryName?.trim() || !price?.trim()) {
      errors.push({ row: rowNum, error: 'Missing required field: name, category, or price' })
      skipped++
      continue
    }
    const parsedPrice = parseFloat(price)
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      errors.push({ row: rowNum, error: `Invalid price value: "${price}"` })
      skipped++
      continue
    }

    try {
      // Find or create category
      let cat = await prisma.menuCategory.findFirst({
        where: { name: categoryName.trim(), venueId }
      })
      if (!cat) {
        cat = await prisma.menuCategory.create({
          data: { name: categoryName.trim(), venueId }
        })
      }

      // Upsert item
      let item = await prisma.menuItem.findFirst({
        where: { name: name.trim(), venueId }
      })
      if (!item) {
        item = await prisma.menuItem.create({
          data: {
            name:       name.trim(),
            categoryId: cat.id,
            venueId,
            isFastSell: isFastSell.trim().toLowerCase() === 'true',
            sortOrder:  parseInt(sortOrder, 10) || 0
          }
        })
        created++
      } else {
        await prisma.menuItem.update({
          where: { id: item.id },
          data:  {
            categoryId: cat.id,
            isFastSell: isFastSell.trim().toLowerCase() === 'true',
            sortOrder:  parseInt(sortOrder, 10) || item.sortOrder,
            isActive:   true  // re-activate if it was soft-deleted
          }
        })
        updated++
      }

      // Replace active price of same type (idempotent re-import)
      await prisma.menuItemPrice.updateMany({
        where: { menuItemId: item.id, priceType: priceType.trim() || 'standard', isActive: true },
        data:  { isActive: false }
      })
      await prisma.menuItemPrice.create({
        data: {
          menuItemId: item.id,
          price:      parsedPrice,
          priceType:  priceType.trim() || 'standard',
          isActive:   true
        }
      })
    } catch (err) {
      errors.push({ row: rowNum, error: err.message })
      skipped++
    }
  }

  // Audit log — always written even if some rows were skipped
  await prisma.auditLog.create({
    data: {
      venueId,
      actorId,
      action:   'menu.import',
      entity:   'menu_item',
      entityId: venueId,
      after:    { created, updated, skipped, total: records.length }
    }
  })

  logger.info(`Menu import: ${created} created, ${updated} updated, ${skipped} skipped venue:${venueId}`)

  return { created, updated, skipped, total: records.length, errors }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
  listItems,
  createItem,
  updateItem,
  deactivateItem,
  addPrice,
  deactivatePrice,
  getEffectivePrice,
  importFromCsv
}
