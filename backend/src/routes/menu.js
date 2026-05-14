const router  = require('express').Router()
const multer  = require('multer')
const { body, param, query, validationResult } = require('express-validator')
const { authenticate, requireRole } = require('../middlewares/auth')
const ctrl = require('../controllers/menuController')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Only CSV files are accepted'), { status: 422 }))
    }
  }
})

// ── Categories ───────────────────────────────────────────────

// GET /api/menu/categories
router.get('/categories', authenticate, ctrl.listCategories)

// POST /api/menu/categories — supervisor+
router.post('/categories',
  authenticate,
  requireRole('owner', 'supervisor'),
  [body('name').trim().notEmpty().withMessage('Category name required')],
  validate,
  ctrl.createCategory
)

// PUT /api/menu/categories/:id — supervisor+
router.put('/categories/:id',
  authenticate,
  requireRole('owner', 'supervisor'),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty().withMessage('Category name required'),
    body('sortOrder').optional().isInt({ min: 0 })
  ],
  validate,
  ctrl.updateCategory
)

// DELETE /api/menu/categories/:id — owner only (soft delete)
router.delete('/categories/:id',
  authenticate,
  requireRole('owner'),
  [param('id').isUUID()],
  validate,
  ctrl.deactivateCategory
)

// ── Items ────────────────────────────────────────────────────

// GET /api/menu/items?categoryId=&isFastSell=
router.get('/items',
  authenticate,
  [
    query('categoryId').optional().isUUID(),
    query('isFastSell').optional().isBoolean()
  ],
  validate,
  ctrl.listItems
)

// POST /api/menu/items — supervisor+
router.post('/items',
  authenticate,
  requireRole('owner', 'supervisor'),
  [
    body('name').trim().notEmpty().withMessage('Item name required'),
    body('categoryId').isUUID().withMessage('Valid category ID required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
    body('priceType').optional().trim().notEmpty(),
    body('isFastSell').optional().isBoolean(),
    body('sortOrder').optional().isInt({ min: 0 })
  ],
  validate,
  ctrl.createItem
)

// PUT /api/menu/items/:id — supervisor+
router.put('/items/:id',
  authenticate,
  requireRole('owner', 'supervisor'),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('categoryId').optional().isUUID(),
    body('isFastSell').optional().isBoolean(),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('imageUrl').optional().isURL(),
    body('metadata').optional().isObject()
  ],
  validate,
  ctrl.updateItem
)

// DELETE /api/menu/items/:id — owner only (soft delete)
router.delete('/items/:id',
  authenticate,
  requireRole('owner'),
  [param('id').isUUID()],
  validate,
  ctrl.deactivateItem
)

// ── Prices ───────────────────────────────────────────────────

// POST /api/menu/items/:id/prices — supervisor+
router.post('/items/:id/prices',
  authenticate,
  requireRole('owner', 'supervisor'),
  [
    param('id').isUUID(),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
    body('priceType').optional().trim().notEmpty(),
    body('validFrom').optional().isISO8601(),
    body('validUntil').optional().isISO8601()
  ],
  validate,
  ctrl.addPrice
)

// PATCH /api/menu/items/:id/prices/:priceId — deactivate a price variant
router.patch('/items/:id/prices/:priceId',
  authenticate,
  requireRole('owner', 'supervisor'),
  [param('id').isUUID(), param('priceId').isUUID()],
  validate,
  ctrl.deactivatePrice
)

// ── CSV Import ───────────────────────────────────────────────

// POST /api/menu/import — owner only, multipart/form-data, field name: file
router.post('/import',
  authenticate,
  requireRole('owner'),
  upload.single('file'),
  ctrl.importCsv
)

module.exports = router
