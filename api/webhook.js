// Упрощенный обработчик webhook для Telegram
const TelegramBot = require('node-telegram-bot-api');
const token = '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// Обработчик запросов
module.exports = async (req, res) => {
  try {
    // Для GET-запросов просто возвращаем статус
    if (req.method === 'GET') {
      return res.status(200).json({ status: 'Bot is running' });
    }
    
    // Для POST-запросов обрабатываем события от Telegram
    if (req.method === 'POST') {
      const update = req.body;
      console.log('WEBHOOK:', JSON.stringify(update).slice(0, 200));
      
      // Создаем временный экземпляр бота для ответа
      const bot = new TelegramBot(token);
      
      // Если это сообщение с текстом
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        
        console.log(`Сообщение: ${text} от ${chatId}`);
        
        // Базовые команды
        if (text === '/start') {
          await bot.sendMessage(chatId, 'Привет! Я бот для приема анкет в хаус Sunset. Бот временно на обслуживании. Попробуйте снова позже.');
        } else {
          await bot.sendMessage(chatId, 'Бот на обслуживании. Попробуйте снова позже.');
        }
      }
      
      return res.status(200).send('OK');
    }
    
    // Для всех других методов
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('ОШИБКА:', error);
    return res.status(500).json({
      error: String(error),
      location: 'webhook handler',
      stack: error.stack
    });
  }
}; 