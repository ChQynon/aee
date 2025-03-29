// Файл для обработки вебхуков в Vercel
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// Получаем токен из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// Обработка запросов
module.exports = async (req, res) => {
  try {
    // Если метод не POST, возвращаем сообщение о статусе
    if (req.method !== 'POST') {
      res.status(200).json({ status: 'Bot is running' });
      return;
    }

    // Получаем данные обновления
    const update = req.body;

    // Импортируем основной код бота
    const botHandler = require('../bot');
    
    // Передаем обновление боту
    await botHandler.handleUpdate(update);
    
    // Отвечаем Telegram серверу что всё хорошо
    res.status(200).end('OK');
  } catch (error) {
    console.error('Ошибка в обработке webhook:', error);
    res.status(500).json({ error: 'Ошибка в обработке webhook' });
  }
}; 