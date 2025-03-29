const TelegramBot = require('node-telegram-bot-api');

module.exports = async (req, res) => {
  // Получаем токен бота из переменных окружения или используем дефолтный
  const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';
  
  // Получаем ID чата из параметров запроса или тела запроса
  const chatId = req.query.chatId || req.body?.chatId;
  const message = req.query.message || req.body?.message || "Тестовое сообщение от бота Sunset House!";
  
  // Проверяем, что ID чата предоставлен
  if (!chatId) {
    return res.status(400).json({
      status: 'error',
      message: 'Необходимо указать параметр chatId (ID чата Telegram)'
    });
  }

  // Создаем экземпляр бота
  const bot = new TelegramBot(token);
  
  try {
    // Получаем информацию о боте
    const me = await bot.getMe();
    
    // Отправляем тестовое сообщение
    const sentMessage = await bot.sendMessage(chatId, message);
    
    // Возвращаем успешный результат
    return res.json({
      status: 'ok',
      bot: me,
      message: sentMessage,
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    
    return res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : error.stack
    });
  }
}; 