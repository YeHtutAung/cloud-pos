import { create } from 'zustand'

export const useOrderStore = create((set) => ({
  activeOrder: null,
  orders: [],
  setActiveOrder: (order) => set({ activeOrder: order }),
  setOrders: (orders) => set({ orders }),
  addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
  updateOrder: (id, data) => set((s) => ({
    orders: s.orders.map((o) => o.id === id ? { ...o, ...data } : o)
  })),
  clearActiveOrder: () => set({ activeOrder: null })
}))
