const menuService = require('../services/menuService')

// ── Categories ───────────────────────────────────────────────

async function listCategories(req, res, next) {
  try {
    const data = await menuService.listCategories(req.user.venueId)
    res.json({ data })
  } catch (err) { next(err) }
}

async function createCategory(req, res, next) {
  try {
    const data = await menuService.createCategory({
      name:    req.body.name,
      venueId: req.user.venueId
    })
    res.status(201).json({ data })
  } catch (err) { next(err) }
}

async function updateCategory(req, res, next) {
  try {
    const data = await menuService.updateCategory(
      req.params.id,
      req.user.venueId,
      { name: req.body.name, sortOrder: req.body.sortOrder }
    )
    res.json({ data })
  } catch (err) { next(err) }
}

async function deactivateCategory(req, res, next) {
  try {
    await menuService.deactivateCategory(req.params.id, req.user.venueId)
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ── Items ────────────────────────────────────────────────────

async function listItems(req, res, next) {
  try {
    const data = await menuService.listItems(req.user.venueId, {
      categoryId: req.query.categoryId,
      isFastSell: req.query.isFastSell
    })
    res.json({ data })
  } catch (err) { next(err) }
}

async function createItem(req, res, next) {
  try {
    const { name, categoryId, isFastSell, sortOrder, price, priceType } = req.body
    const data = await menuService.createItem({
      name,
      categoryId,
      venueId:   req.user.venueId,
      isFastSell,
      sortOrder,
      price,
      priceType
    })
    res.status(201).json({ data })
  } catch (err) { next(err) }
}

async function updateItem(req, res, next) {
  try {
    const allowed = {}
    const { name, categoryId, isFastSell, sortOrder, imageUrl, metadata } = req.body
    if (name       !== undefined) allowed.name       = name
    if (categoryId !== undefined) allowed.categoryId = categoryId
    if (isFastSell !== undefined) allowed.isFastSell = Boolean(isFastSell)
    if (sortOrder  !== undefined) allowed.sortOrder  = parseInt(sortOrder, 10)
    if (imageUrl   !== undefined) allowed.imageUrl   = imageUrl
    if (metadata   !== undefined) allowed.metadata   = metadata

    const data = await menuService.updateItem(req.params.id, req.user.venueId, allowed)
    res.json({ data })
  } catch (err) { next(err) }
}

async function deactivateItem(req, res, next) {
  try {
    await menuService.deactivateItem(req.params.id, req.user.venueId)
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ── Prices ───────────────────────────────────────────────────

async function addPrice(req, res, next) {
  try {
    const data = await menuService.addPrice(
      req.params.id,
      req.user.venueId,
      req.body
    )
    res.status(201).json({ data })
  } catch (err) { next(err) }
}

async function deactivatePrice(req, res, next) {
  try {
    await menuService.deactivatePrice(
      req.params.priceId,
      req.params.id,
      req.user.venueId
    )
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ── CSV Import ───────────────────────────────────────────────

async function importCsv(req, res, next) {
  try {
    if (!req.file) {
      return res.status(422).json({ error: 'CSV file required (field name: file)' })
    }
    const data = await menuService.importFromCsv(
      req.user.venueId,
      req.user.userId,
      req.file.buffer
    )
    res.json({ data })
  } catch (err) { next(err) }
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
  importCsv
}
