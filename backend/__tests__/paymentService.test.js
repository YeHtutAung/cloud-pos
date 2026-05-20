// Shared txMock — captures what happens inside the Prisma transaction
const txMock = {
  payment:  { update:  jest.fn().mockResolvedValue({}) },
  order:    { update:  jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
  table:    { update:  jest.fn().mockResolvedValue({}) },
  auditLog: { create:  jest.fn().mockResolvedValue({}) }
}

jest.mock('../src/config/prisma', () => ({
  order:        { findFirst: jest.fn() },
  payment:      { findFirst: jest.fn() },
  status:       { findFirst: jest.fn() },
  user:         { findFirst: jest.fn() },
  table:        { findUnique: jest.fn() },
  auditLog:     { create: jest.fn() },
  $transaction: jest.fn()
}))

jest.mock('../src/sockets', () => ({
  getIo: () => ({ to: () => ({ emit: jest.fn() }) })
}))

const prisma = require('../src/config/prisma')
const { handleCallback } = require('../src/services/paymentService')

const BASE_ORDER = {
  id: 'order-uuid-1',
  orderNumber: 'ORD-0001',
  totalAmount: 10000,
  tableId: 'table-uuid-1',
  venueId: 'venue-uuid-1'
}

const BASE_PAYMENT = {
  id: 'payment-uuid-1',
  statusCode: 'pending',
  orderId: 'order-uuid-1'
}

const SUCCESS_PARAMS = {
  orderId: 'ORD-0001',
  amount: '10000',
  status: '200',
  transactionId: 'TXN-ABC123',
  billNo: 'BILL-001',
  endToEndId: 'E2E-001',
  institutionName: 'ABank'
}

beforeEach(() => {
  prisma.order.findFirst.mockResolvedValue(BASE_ORDER)
  prisma.payment.findFirst.mockResolvedValue(BASE_PAYMENT)
  prisma.status.findFirst.mockImplementation(({ where }) =>
    Promise.resolve({ id: 'status-id', entity: where.entity, code: where.code, isActive: true })
  )
  prisma.user.findFirst.mockResolvedValue({ id: 'user-uuid-1' })
  prisma.table.findUnique.mockResolvedValue({ statusCode: 'available' })
  prisma.$transaction.mockImplementation(fn => fn(txMock))
})

describe('paymentService.handleCallback — transactionDateTime parsing', () => {
  it('parses ABank YYYYMMDDHHmmss format correctly', async () => {
    await handleCallback({
      ...SUCCESS_PARAMS,
      transactionDateTime: '20261201143000'
    })

    const updateCall = txMock.payment.update.mock.calls[0][0]
    expect(updateCall.data.paidAt).toBeInstanceOf(Date)
    expect(updateCall.data.paidAt.toISOString()).toBe('2026-12-01T14:30:00.000Z')
  })

  it('falls back gracefully for a standard ISO date string', async () => {
    await handleCallback({
      ...SUCCESS_PARAMS,
      transactionDateTime: '2026-12-01T14:30:00Z'
    })

    const updateCall = txMock.payment.update.mock.calls[0][0]
    expect(updateCall.data.paidAt).toBeInstanceOf(Date)
    expect(updateCall.data.paidAt.toISOString()).toBe('2026-12-01T14:30:00.000Z')
  })

  it('defaults paidAt to approximately now when transactionDateTime is absent', async () => {
    const before = Date.now()

    await handleCallback({
      ...SUCCESS_PARAMS,
      transactionDateTime: undefined
    })

    const after = Date.now()
    const updateCall = txMock.payment.update.mock.calls[0][0]
    const paidAt = updateCall.data.paidAt.getTime()

    expect(paidAt).toBeGreaterThanOrEqual(before)
    expect(paidAt).toBeLessThanOrEqual(after)
  })

  it('returns { received: true } for an unrecognised orderNumber', async () => {
    prisma.order.findFirst.mockResolvedValue(null)

    const result = await handleCallback({
      ...SUCCESS_PARAMS,
      transactionDateTime: '20261201143000'
    })

    expect(result).toEqual({ received: true })
    expect(txMock.payment.update).not.toHaveBeenCalled()
  })
})
