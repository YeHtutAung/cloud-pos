const { Server } = require('socket.io')
const logger = require('../utils/logger')

let io

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`)

    socket.on('join:venue', (venueId) => {
      socket.join(`venue:${venueId}`)
      logger.info(`Socket ${socket.id} joined venue:${venueId}`)
    })

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`)
    })
  })

  logger.info('WebSocket server initialized')
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}

module.exports = { initSocket, getIo }
