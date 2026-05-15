const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Roles
  await prisma.role.createMany({
    data: [
      {
        name: 'owner',
        permissions: {
          can_void: true, can_close_shift: true, can_manage_menu: true,
          can_view_reports: true, can_manage_staff: true
        }
      },
      {
        name: 'supervisor',
        permissions: {
          can_void: true, can_close_shift: true, can_manage_menu: false,
          can_view_reports: true, can_manage_staff: false
        }
      },
      {
        name: 'staff',
        permissions: {
          can_void: false, can_close_shift: false, can_manage_menu: false,
          can_view_reports: false, can_manage_staff: false
        }
      },
      {
        name: 'kitchen',
        permissions: {
          can_void: false, can_close_shift: false, can_manage_menu: false,
          can_view_reports: false, can_manage_staff: false
        }
      }
    ],
    skipDuplicates: true
  })

  // Statuses
  await prisma.status.createMany({
    data: [
      { entity: 'table', code: 'available', label: 'Available', color: '#22c55e', sortOrder: 1 },
      { entity: 'table', code: 'occupied',  label: 'Occupied',  color: '#f59e0b', sortOrder: 2 },
      { entity: 'table', code: 'reserved',  label: 'Reserved',  color: '#3b82f6', sortOrder: 3 },

      { entity: 'order', code: 'pending',   label: 'Pending',   color: '#94a3b8', sortOrder: 1 },
      { entity: 'order', code: 'confirmed', label: 'Confirmed', color: '#3b82f6', sortOrder: 2 },
      { entity: 'order', code: 'ready',     label: 'Ready',     color: '#f59e0b', sortOrder: 3 },
      { entity: 'order', code: 'paid',      label: 'Paid',      color: '#22c55e', sortOrder: 4 },
      { entity: 'order', code: 'void',      label: 'Void',      color: '#ef4444', sortOrder: 5 },

      { entity: 'shift', code: 'open',   label: 'Open',   color: '#22c55e', sortOrder: 1 },
      { entity: 'shift', code: 'closed', label: 'Closed', color: '#94a3b8', sortOrder: 2 },

      { entity: 'payment', code: 'pending',  label: 'Pending',  color: '#94a3b8', sortOrder: 1 },
      { entity: 'payment', code: 'paid',     label: 'Paid',     color: '#22c55e', sortOrder: 2 },
      { entity: 'payment', code: 'failed',   label: 'Failed',   color: '#ef4444', sortOrder: 3 },
      { entity: 'payment', code: 'expired',  label: 'Expired',  color: '#f59e0b', sortOrder: 4 },
      { entity: 'payment', code: 'refunded', label: 'Refunded', color: '#8b5cf6', sortOrder: 5 }
    ],
    skipDuplicates: true
  })

  // Venue types
  await prisma.venueType.createMany({
    data: [
      { name: 'bar',       icon: '🍺' },
      { name: 'club',      icon: '🎵' },
      { name: 'lounge',    icon: '🛋️' },
      { name: 'festival',  icon: '🎪' },
      { name: 'hotel_bar', icon: '🏨' },
      { name: 'rooftop',   icon: '🌆' }
    ],
    skipDuplicates: true
  })

  // Report types
  await prisma.reportType.createMany({
    data: [
      { code: 'shift',   label: 'Shift Report'   },
      { code: 'nightly', label: 'Nightly Report' },
      { code: 'weekly',  label: 'Weekly Report'  },
      { code: 'monthly', label: 'Monthly Report' },
      { code: 'custom',  label: 'Custom Report'  }
    ],
    skipDuplicates: true
  })

  console.log('Seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
