const router           = require('express').Router()
const { param, validationResult } = require('express-validator')
const { authenticate } = require('../middlewares/auth')
const ctrl             = require('../controllers/paymentController')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /api/payments/callback — APlus MMQR GET callback (no JWT, no signature)
// ABank fires this after successful or failed payment with query params:
//   orderId, amount, status(200|500), transactionId, billNo, endToEndId,
//   transactionDateTime, institutionName  [+ errorCode, errorDesc on failure]
// Must be declared before /:id to avoid Express matching "callback" as a UUID param.
router.get('/callback', ctrl.handleCallback)

// GET /api/payments/:id
router.get('/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.getById
)

// POST /api/payments/:id/qr — refresh an expired or pending QR
router.post('/:id/qr',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.refreshQr
)

module.exports = router
