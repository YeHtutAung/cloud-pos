const request = require('supertest')

// Stub controller to avoid DB calls
jest.mock('../src/controllers/authController', () => ({
  pinLogin:  (req, res) => res.json({ token: 'fake-token', refreshToken: 'fake-refresh' }),
  refresh:   (req, res) => res.json({ token: 'fake-token' }),
  logout:    (req, res) => res.json({ success: true }),
  me:        (req, res) => res.json({ user: {} }),
  listRoles: (req, res) => res.json({ data: [] })
}))

jest.mock('../src/middlewares/auth', () => ({
  authenticate:      (req, res, next) => { req.user = { userId: 'u1', role: 'owner', venueId: 'v1', permissions: {} }; next() },
  requirePermission: () => (req, res, next) => next(),
  requireRole:       () => (req, res, next) => next()
}))

const app = require('../src/app')

const VALID_BODY = {
  pin:     '1234',
  venueId: '00000000-0000-0000-0000-000000000001'
}

describe('POST /api/auth/pin-login — rate limiter', () => {
  it('allows 25 rapid requests in non-production (limit is 500, not 20)', async () => {
    // Fire 25 requests — the old limit was 20, so requests 21-25 would have been blocked
    const responses = await Promise.all(
      Array.from({ length: 25 }, () =>
        request(app).post('/api/auth/pin-login').send(VALID_BODY)
      )
    )

    const blocked = responses.filter(r => r.status === 429)
    expect(blocked).toHaveLength(0)
  })
})
