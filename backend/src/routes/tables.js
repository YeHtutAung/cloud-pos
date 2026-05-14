const router = require('express').Router()
const { body, param, query, validationResult } = require('express-validator')
const { authenticate, requireRole } = require('../middlewares/auth')
const ctrl = require('../controllers/tableController')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /api/tables?zoneId= — all authenticated users, scoped to req.user.venueId
router.get('/',
  authenticate,
  [query('zoneId').optional().isUUID()],
  validate,
  ctrl.list
)

// POST /api/tables — supervisor+, venueId taken from JWT
router.post('/',
  authenticate,
  requireRole('owner', 'supervisor'),
  [
    body('label').trim().notEmpty().withMessage('Table label required'),
    body('zoneId').isUUID().withMessage('Valid zone ID required')
  ],
  validate,
  ctrl.create
)

// PATCH /api/tables/:id/status — all authenticated users (staff move tables)
// statusCode validated against statuses lookup table in the service
router.patch('/:id/status',
  authenticate,
  [
    param('id').isUUID(),
    body('statusCode').trim().notEmpty().withMessage('statusCode required')
  ],
  validate,
  ctrl.updateStatus
)

// DELETE /api/tables/:id — owner only
router.delete('/:id',
  authenticate,
  requireRole('owner'),
  [param('id').isUUID()],
  validate,
  ctrl.remove
)

module.exports = router
