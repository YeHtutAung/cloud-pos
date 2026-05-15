const router = require('express').Router()
const { body, param, query, validationResult } = require('express-validator')
const { authenticate, requirePermission } = require('../middlewares/auth')
const ctrl = require('../controllers/orderController')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /api/orders?shiftId=&tableId=&statusCode=
router.get('/',
  authenticate,
  [
    query('shiftId').optional().isUUID(),
    query('tableId').optional().isUUID(),
    query('statusCode').optional().isIn(['pending', 'confirmed', 'ready', 'paid', 'void'])
  ],
  validate,
  ctrl.list
)

// GET /api/orders/:id
router.get('/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.getById
)

// POST /api/orders — all staff can create orders
router.post('/',
  authenticate,
  [
    body('tableId').isUUID().withMessage('Valid table ID required'),
    body('shiftId').isUUID().withMessage('Valid shift ID required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.menuItemId').isUUID().withMessage('Valid menu item ID required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('notes').optional().isString()
  ],
  validate,
  ctrl.create
)

// POST /api/orders/:id/items — add items to existing order
router.post('/:id/items',
  authenticate,
  [
    param('id').isUUID(),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.menuItemId').isUUID().withMessage('Valid menu item ID required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
  ],
  validate,
  ctrl.addItems
)

// DELETE /api/orders/:id/items/:itemId
router.delete('/:id/items/:itemId',
  authenticate,
  [param('id').isUUID(), param('itemId').isUUID()],
  validate,
  ctrl.removeItem
)

// PATCH /api/orders/:id/void — requires can_void permission, audit logged
router.patch('/:id/void',
  authenticate,
  requirePermission('can_void'),
  [
    param('id').isUUID(),
    body('reason').trim().notEmpty().withMessage('Void reason required')
  ],
  validate,
  ctrl.voidOrder
)

// POST /api/orders/:id/pay — initiate payment, generate QR
router.post('/:id/pay',
  authenticate,
  [
    param('id').isUUID(),
    body('gatewayId').isUUID().withMessage('Valid gateway ID required')
  ],
  validate,
  ctrl.initiatePayment
)

// PATCH /api/orders/:id/confirm — send order to kitchen
router.patch('/:id/confirm',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.confirmOrder
)

// PATCH /api/orders/:id/ready — kitchen marks order ready
router.patch('/:id/ready',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.markReady
)

module.exports = router
