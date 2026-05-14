import { io } from 'socket.io-client'

let socket = null

export function connectSocket(venueId) {
  if (socket?.connected) return socket
  socket = io({ autoConnect: true })
  socket.on('connect', () => {
    socket.emit('join:venue', venueId)
  })
  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
