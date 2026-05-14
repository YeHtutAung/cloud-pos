const router = require('express').Router()
const { body, param, validationResult } = require('express-validator')
const { authenticate, requireRole } = require('../middlewares/auth')
const ctrl = require('../controllers/zoneController')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /api/zones — all authenticated users, scoped to req.user.venueId
router.get('/', authenticate, ctrl.list)

// POST /api/zones — supervisor+, venueId taken from JWT
router.post('/',
  authenticate,
  requireRole('owner', 'supervisor'),
  [
    body('name').trim().notEmpty().withMessage('Zone name required')
  ],
  validate,
  ctrl.create
)

// PUT /api/zones/:id — supervisor+
router.put('/:id',
  authenticate,
  requireRole('owner', 'supervisor'),
  [
    param('id').isUUID(),
    body('name').trim().notEmpty().withMessage('Zone name required')
  ],
  validate,
  ctrl.update
)

// DELETE /api/zones/:id — owner only (soft delete)
router.delete('/:id',
  authenticate,
  requireRole('owner'),
  [param('id').isUUID()],
  validate,
  ctrl.remove
)

module.exports = router
