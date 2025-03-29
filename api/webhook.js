const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';
const bot = new TelegramBot(token);

// Импортируем основной файл бота
const botScript = require('../bot');

module.exports = async (req, res) => {
  // Проверяем метод запроса
  if (req.method === 'POST') {
    try {
      // Проверяем наличие тела запроса
      if (!req.body) {
        return res.status(400).send('Отсутствует тело запроса');
      }

      // Обрабатываем обновление от Telegram
      if (req.body.message || req.body.callback_query) {
        await bot.processUpdate(req.body);
      }

      // Возвращаем успешный ответ
      return res.status(200).send('OK');
    } catch (error) {
      console.error('Ошибка при обработке webhook:', error);
      return res.status(500).send('Ошибка при обработке webhook');
    }
  } else {
    // Для GET запросов возвращаем информацию о статусе
    return res.status(200).json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Webhook сервер для Telegram бота хауса Sunset работает'
    });
  }
}; 