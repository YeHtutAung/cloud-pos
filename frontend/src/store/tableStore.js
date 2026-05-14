import { create } from 'zustand'

export const useTableStore = create((set) => ({
  tables: [],
  setTables: (tables) => set({ tables }),
  updateTable: (id, data) => set((s) => ({
    tables: s.tables.map((t) => t.id === id ? { ...t, ...data } : t)
  }))
}))
