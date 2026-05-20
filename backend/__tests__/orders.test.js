const request = require('supertest')

// Bypass JWT auth — inject a fake user onto req.user
jest.mock('../src/middlewares/auth', () => ({
  authenticate:      (req, res, next) => { req.user = { userId: 'u1', role: 'staff', venueId: 'v1', permissions: {} }; next() },
  requirePermission: () => (req, res, next) => next(),
  requireRole:       () => (req, res, next) => next()
}))

// Stub controller to avoid DB calls
jest.mock('../src/controllers/orderController', () => ({
  list:            (req, res) => res.json({ data: [] }),
  getById:         (req, res) => res.json({ data: {} }),
  create:          (req, res) => res.status(201).json({ data: {} }),
  addItems:        (req, res) => res.json({ data: {} }),
  removeItem:      (req, res) => res.json({ data: {} }),
  voidOrder:       (req, res) => res.json({ data: {} }),
  initiatePayment: (req, res) => res.status(201).json({ data: {} }),
  confirmOrder:    (req, res) => res.json({ data: {} }),
  markReady:       (req, res) => res.json({ data: {} })
}))

const app = require('../src/app')

describe('GET /api/orders — statusCode query validation', () => {
  it('accepts statusCode=ready (added in KDS feature)', async () => {
    const res = await request(app).get('/api/orders?statusCode=ready')
    expect(res.status).not.toBe(422)
    expect(res.body.data).toEqual([])
  })

  it.each(['pending', 'confirmed', 'paid', 'void'])(
    'accepts statusCode=%s (regression)',
    async (code) => {
      const res = await request(app).get(`/api/orders?statusCode=${code}`)
      expect(res.status).not.toBe(422)
    }
  )

  it('rejects an unknown status code with 422', async () => {
    const res = await request(app).get('/api/orders?statusCode=cooking')
    expect(res.status).toBe(422)
  })

  it('accepts a request with no statusCode filter', async () => {
    const res = await request(app).get('/api/orders')
    expect(res.status).toBe(200)
  })
})
