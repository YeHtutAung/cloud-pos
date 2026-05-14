const router = require('express').Router()
const { body, param, validationResult } = require('express-validator')
const { authenticate, requireRole } = require('../middlewares/auth')
const ctrl = require('../controllers/venueController')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /api/venues/types — lookup list for dropdowns (must be before /:id)
router.get('/types', authenticate, ctrl.listTypes)

// GET /api/venues/gateways — active payment gateways for this venue (must be before /:id)
router.get('/gateways', authenticate, ctrl.listGateways)

// GET /api/venues/:id — any authenticated user (scoped to their own venueId)
router.get('/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.getById
)

// POST /api/venues — owner only
router.post('/',
  authenticate,
  requireRole('owner'),
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('typeId').isUUID().withMessage('Valid venue type ID required'),
    body('operatingHours').isObject().withMessage('operatingHours must be an object')
  ],
  validate,
  ctrl.create
)

// PUT /api/venues/:id — owner only
router.put('/:id',
  authenticate,
  requireRole('owner'),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
    body('operatingHours').optional().isObject()
  ],
  validate,
  ctrl.update
)

module.exports = router
