const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const prisma = require('../config/prisma')
const logger = require('../utils/logger')

// ── Token helpers ────────────────────────────────────────────

function buildPayload(user) {
  return {
    userId:      user.id,
    name:        user.name,
    role:        user.role.name,
    venueId:     user.venueId,
    zoneId:      user.zoneId ?? null,
    permissions: user.role.permissions   // { can_void: true, can_close_shift: false, ... }
  }
}

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  })
}

function signRefresh(payload) {
  return jwt.sign(
    { ...payload, tokenType: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// ── Public API ───────────────────────────────────────────────

/**
 * Find the user whose PIN matches within the given venue.
 * Runs all bcrypt comparisons in parallel (venues typically have < 30 staff).
 */
async function loginWithPin(venueId, pin) {
  const users = await prisma.user.findMany({
    where:   { venueId, isActive: true },
    include: { role: true }
  })

  if (!users.length) {
    throw Object.assign(new Error('No active users for this venue'), { status: 401 })
  }

  const checks = await Promise.all(
    users.map(async (u) => ({ user: u, match: await bcrypt.compare(pin, u.pinHash) }))
  )
  const found = checks.find((c) => c.match)

  if (!found) {
    logger.warn(`Failed PIN attempt for venue ${venueId}`)
    throw Object.assign(new Error('Invalid PIN'), { status: 401 })
  }

  const user = found.user

  // Audit log — fire-and-forget, don't fail login if audit write fails
  prisma.auditLog.create({
    data: {
      venueId,
      actorId:  user.id,
      action:   'auth.login',
      entity:   'user',
      entityId: user.id,
      after:    { role: user.role.name, at: new Date().toISOString() }
    }
  }).catch((err) => logger.error('Audit log failed on login', { error: err.message }))

  logger.info(`Login: ${user.name} [${user.role.name}] venue:${venueId}`)

  const payload = buildPayload(user)
  return {
    user: {
      id:          user.id,
      name:        user.name,
      role:        user.role.name,
      venueId:     user.venueId,
      zoneId:      user.zoneId ?? null,
      permissions: user.role.permissions
    },
    token:        signAccess(payload),
    refreshToken: signRefresh(payload)
  }
}

/**
 * Verify a refresh token and issue a new access token.
 */
function refreshAccessToken(refreshToken) {
  let payload
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_SECRET)
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 })
  }

  if (payload.tokenType !== 'refresh') {
    throw Object.assign(new Error('Not a refresh token'), { status: 401 })
  }

  // Strip JWT-internal claims before re-signing
  const { tokenType, iat, exp, ...clean } = payload
  return signAccess(clean)
}

async function listRoles() {
  return prisma.role.findMany({
    where:   { isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: 'asc' }
  })
}

module.exports = { loginWithPin, refreshAccessToken, listRoles }
