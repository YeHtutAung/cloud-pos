const authService = require('../services/authService')
const logger      = require('../utils/logger')

async function pinLogin(req, res, next) {
  try {
    const { pin, venueId } = req.body
    const result = await authService.loginWithPin(venueId, pin)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body
    const token = authService.refreshAccessToken(refreshToken)
    res.json({ token })
  } catch (err) {
    next(err)
  }
}

async function logout(req, res, next) {
  try {
    // Stateless JWT — client discards tokens. Log the event.
    logger.info(`Logout: user ${req.user.userId} [${req.user.role}]`)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

async function me(req, res, next) {
  try {
    res.json({ user: req.user })
  } catch (err) {
    next(err)
  }
}

async function listRoles(req, res, next) {
  try {
    const roles = await authService.listRoles()
    res.json({ data: roles })
  } catch (err) { next(err) }
}

module.exports = { pinLogin, refresh, logout, me, listRoles }
