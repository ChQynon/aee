const TelegramBot = require('node-telegram-bot-api');

// Получаем токен бота из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// Создаем бота без polling, так как используем webhook
const bot = new TelegramBot(token);

// Подключаем основной файл бота
const botInit = require('../bot');

// Инициализируем бота с нашим экземпляром
botInit(bot);

// Для отладки
console.log('Webhook handler initialized');

module.exports = async (req, res) => {
  // Разрешаем CORS для возможных запросов предварительной проверки
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // Для GET запросов возвращаем статус
    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Webhook endpoint for Sunset house Telegram bot'
      });
    }
    
    // Убедимся что это POST запрос и имеет тело
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    if (!req.body) {
      return res.status(400).json({ error: 'No request body' });
    }
    
    console.log('Received webhook data:', JSON.stringify(req.body));
    
    // Обрабатываем данные от Telegram
    await bot.processUpdate(req.body);
    console.log('Update processed successfully');
    
    // Отвечаем успешным статусом
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    // Логируем ошибку и отвечаем с ошибкой
    console.error('Error processing webhook:', error);
    return res.status(500).json({ 
      error: 'Failed to process update',
      message: error.message 
    });
  }
}; 