const router = require('express').Router()
const { body, param, validationResult } = require('express-validator')
const { authenticate, requireRole } = require('../middlewares/auth')
const ctrl = require('../controllers/staffController')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /api/staff
router.get('/', authenticate, requireRole('owner', 'supervisor'), ctrl.list)

// POST /api/staff — owner only
router.post('/',
  authenticate,
  requireRole('owner'),
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('pin').isLength({ min: 4, max: 6 }).withMessage('PIN must be 4–6 digits')
               .isNumeric().withMessage('PIN must be numeric'),
    body('roleId').isUUID().withMessage('Valid role ID required'),
    body('zoneId').optional({ nullable: true }).isUUID().withMessage('Valid zone ID required')
  ],
  validate,
  ctrl.create
)

// PUT /api/staff/:id — owner only
router.put('/:id',
  authenticate,
  requireRole('owner'),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
    body('zoneId').optional({ nullable: true }).isUUID(),
    body('roleId').optional().isUUID(),
    body('pin').optional().isLength({ min: 4, max: 6 }).isNumeric()
  ],
  validate,
  ctrl.update
)

// PATCH /api/staff/:id/status — activate / deactivate, owner only
router.patch('/:id/status',
  authenticate,
  requireRole('owner'),
  [
    param('id').isUUID(),
    body('isActive').isBoolean().withMessage('isActive must be boolean')
  ],
  validate,
  ctrl.toggleActive
)

module.exports = router
