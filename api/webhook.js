// Обработчик webhook для Vercel
module.exports = async (req, res) => {
  try {
    // Проверка на GET запрос (для проверки работоспособности)
    if (req.method !== 'POST') {
      return res.status(200).json({ status: 'Bot is running' });
    }
    
    // Получение данных обновления от Telegram
    const update = req.body;
    
    // Импорт модуля бота
    const TelegramBot = require('node-telegram-bot-api');
    const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';
    
    // Создание экземпляра бота с webhook-режимом
    const bot = new TelegramBot(token);
    
    // Передача обновления боту
    await bot.processUpdate(update);
    
    // Отправка успешного ответа
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: String(error),
      stack: error.stack
    });
  }
}; 