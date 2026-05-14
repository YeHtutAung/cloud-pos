const { Telegraf } = require('telegraf')
const logger       = require('./logger')

let _telegram = null

function getApi() {
  if (_telegram) return _telegram
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  _telegram = new Telegraf(token).telegram
  return _telegram
}

/**
 * Send a PDF report document to a Telegram chat.
 * @param {string|number} chatId
 * @param {Buffer}        pdfBuffer
 * @param {string}        caption   Plain text caption
 */
async function sendReport(chatId, pdfBuffer, caption) {
  const tg = getApi()
  if (!tg) {
    logger.warn('Telegram: TELEGRAM_BOT_TOKEN not set — skipping send')
    return
  }
  await tg.sendDocument(
    chatId,
    { source: pdfBuffer, filename: 'shift-report.pdf' },
    { caption }
  )
  logger.info(`Telegram: report sent to chat ${chatId}`)
}

/**
 * Send a plain-text message to a Telegram chat.
 */
async function sendText(chatId, text) {
  const tg = getApi()
  if (!tg) return
  await tg.sendMessage(chatId, text)
  logger.info(`Telegram: message sent to chat ${chatId}`)
}

module.exports = { sendReport, sendText }
