const jwt = require('jsonwebtoken')

/**
 * Verifies Bearer JWT and attaches decoded payload to req.user.
 * Payload shape: { userId, name, role, venueId, zoneId, permissions }
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' })
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * SOLID permission check — reads permissions from the JWT payload
 * (populated from the roles table at login time).
 * Preferred over requireRole — no hardcoded role name strings.
 *
 * Usage: router.patch('/void', authenticate, requirePermission('can_void'), ctrl.void)
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user?.permissions?.[permission]) {
      return res.status(403).json({
        error: `Forbidden — requires permission: ${permission}`
      })
    }
    next()
  }
}

/**
 * Role-name check kept for compatibility where role-based routing
 * is more readable (e.g. owner-only setup routes).
 * Prefer requirePermission for action-level guards.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

module.exports = { authenticate, requirePermission, requireRole }
