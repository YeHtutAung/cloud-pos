const bcrypt = require('bcryptjs')
const prisma  = require('../config/prisma')

const SALT_ROUNDS = 12

const STAFF_SELECT = {
  id:        true,
  name:      true,
  isActive:  true,
  createdAt: true,
  role:      { select: { id: true, name: true } },
  zone:      { select: { id: true, name: true } }
}

async function list(venueId) {
  return prisma.user.findMany({
    where:   { venueId },
    select:  STAFF_SELECT,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
  })
}

async function create({ name, pin, roleId, zoneId, venueId }) {
  const pinHash = await bcrypt.hash(pin, SALT_ROUNDS)
  return prisma.user.create({
    data:   { name, pinHash, roleId, zoneId: zoneId || null, venueId },
    select: STAFF_SELECT
  })
}

async function update(id, venueId, data) {
  const user = await prisma.user.findFirst({ where: { id, venueId } })
  if (!user) throw Object.assign(new Error('Staff member not found'), { status: 404 })

  const patch = {}
  if (data.name   !== undefined) patch.name   = data.name
  if (data.zoneId !== undefined) patch.zoneId = data.zoneId || null
  if (data.roleId !== undefined) patch.roleId = data.roleId
  if (data.pin)                  patch.pinHash = await bcrypt.hash(data.pin, SALT_ROUNDS)

  return prisma.user.update({ where: { id }, data: patch, select: STAFF_SELECT })
}

async function toggleActive(id, venueId, isActive) {
  const user = await prisma.user.findFirst({
    where:   { id, venueId },
    include: { role: true }
  })
  if (!user) throw Object.assign(new Error('Staff member not found'), { status: 404 })
  if (user.role.name === 'owner') {
    throw Object.assign(new Error('Cannot deactivate the venue owner'), { status: 403 })
  }

  return prisma.user.update({
    where:  { id },
    data:   { isActive },
    select: STAFF_SELECT
  })
}

module.exports = { list, create, update, toggleActive }
