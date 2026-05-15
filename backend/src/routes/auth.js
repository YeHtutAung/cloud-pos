const router    = require('express').Router()
const { body, validationResult } = require('express-validator')
const rateLimit = require('express-rate-limit')
const { authenticate } = require('../middlewares/auth')
const ctrl = require('../controllers/authController')

// Tighter rate limit for login endpoint to slow PIN brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 500,
  message: { error: 'Too many login attempts, please wait.' }
})

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// POST /api/auth/pin-login
router.post('/pin-login',
  loginLimiter,
  [
    body('pin').isLength({ min: 4, max: 6 }).withMessage('PIN must be 4-6 digits'),
    body('venueId').isUUID().withMessage('Valid venue ID required')
  ],
  validate,
  ctrl.pinLogin
)

// POST /api/auth/refresh
router.post('/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token required')
  ],
  validate,
  ctrl.refresh
)

// POST /api/auth/logout
router.post('/logout', authenticate, ctrl.logout)

// GET /api/auth/me
router.get('/me', authenticate, ctrl.me)

// GET /api/auth/roles — authenticated users (needed for dropdowns)
router.get('/roles', authenticate, ctrl.listRoles)

module.exports = router
