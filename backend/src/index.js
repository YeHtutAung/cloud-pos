const http = require('http')
const app  = require('./app')
const { initSocket }   = require('./sockets')
const { initCronJobs } = require('./utils/cronJobs')
const logger           = require('./utils/logger')

const server = http.createServer(app)

initSocket(server)
initCronJobs()

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
