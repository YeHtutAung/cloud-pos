const router = require('express').Router()
const { body, param, validationResult } = require('express-validator')
const { authenticate, requireRole } = require('../middlewares/auth')
const ctrl = require('../controllers/reportController')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// POST /api/reports/generate — must come before /:id to avoid Express matching 'generate' as a UUID
router.post('/generate',
  authenticate,
  requireRole('owner', 'supervisor'),
  [
    body('reportTypeCode').notEmpty().withMessage('Report type required'),
    body('shiftId').optional().isUUID()
  ],
  validate,
  ctrl.generate
)

// GET /api/reports
router.get('/', authenticate, requireRole('owner', 'supervisor'), ctrl.list)

// GET /api/reports/:id
router.get('/:id',
  authenticate,
  requireRole('owner', 'supervisor'),
  [param('id').isUUID()],
  validate,
  ctrl.getById
)

// POST /api/reports/:id/send  — (re-)send to Telegram
router.post('/:id/send',
  authenticate,
  requireRole('owner', 'supervisor'),
  [param('id').isUUID()],
  validate,
  ctrl.send
)

module.exports = router
