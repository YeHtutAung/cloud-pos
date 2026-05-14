const router = require('express').Router()
const { body, param, query, validationResult } = require('express-validator')
const { authenticate, requireRole, requirePermission } = require('../middlewares/auth')
const ctrl = require('../controllers/shiftController')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /api/shifts?statusCode=open|closed
router.get('/',
  authenticate,
  requireRole('owner', 'supervisor'),
  [query('statusCode').optional().isIn(['open', 'closed'])],
  validate,
  ctrl.list
)

// GET /api/shifts/open — current open shift (all staff need this)
// MUST be declared before /:id or Express matches /open as a UUID param
router.get('/open', authenticate, ctrl.getOpen)

// GET /api/shifts/:id — detailed view with summary stats
router.get('/:id',
  authenticate,
  requireRole('owner', 'supervisor'),
  [param('id').isUUID()],
  validate,
  ctrl.getById
)

// POST /api/shifts — open a new shift
router.post('/',
  authenticate,
  requireRole('owner', 'supervisor'),
  [
    body('label').trim().notEmpty().withMessage('Shift label required'),
    body('floatAmount').optional().isFloat({ min: 0 }).withMessage('Float amount must be a positive number')
  ],
  validate,
  ctrl.open
)

// PATCH /api/shifts/:id/close — close shift, audit logged
router.patch('/:id/close',
  authenticate,
  requirePermission('can_close_shift'),
  [param('id').isUUID()],
  validate,
  ctrl.close
)

module.exports = router
