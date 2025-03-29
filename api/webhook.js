// Обработчик webhook для Telegram
const TelegramBot = require('node-telegram-bot-api');

// Получаем токен из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// Импортируем основные компоненты бота
const {
  ADMIN_IDS,
  GROUP_CHAT_ID,
  GROUP_LINK,
  userStates,
  userForms,
  pendingForms,
  processedForms,
  STATES,
  isAdmin
} = require('../bot');

// Создаем экземпляр бота в режиме webhook
const bot = new TelegramBot(token);

// Обработчик webhook запросов
module.exports = async (req, res) => {
  // Для тестового GET-запроса
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'Bot is running' });
  }
  
  if (req.method === 'POST') {
    try {
      const update = req.body;
      console.log('Получен webhook от Telegram:', JSON.stringify(update).slice(0, 100) + '...');
      
      // Обработка текстовых сообщений
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const userId = update.message.from.id;
        
        console.log(`Получено сообщение от пользователя ${userId}: ${text}`);
        
        // Обработка команды /start
        if (text === '/start') {
          if (isAdmin(userId)) {
            await bot.sendMessage(chatId, 
              "Привет, администратор! 👋\n\n" +
              "Я бот для приема анкет в хаус Sunset. " +
              "Ждите анкеты от пользователей, я буду пересылать их вам.\n\n" +
              "Команды для администраторов:\n" +
              "/list - просмотр списка непринятых анкет\n" +
              "/history_accepted - просмотр принятых анкет\n" +
              "/history_rejected - просмотр отклоненных анкет"
            );
          } else {
            // Устанавливаем состояние "ожидание имени и ника"
            userStates[chatId] = STATES.AWAITING_NAME;
            userForms[chatId] = {}; // Инициализируем пустую анкету
            
            await bot.sendMessage(chatId, 
              "Привет! Я бот для приема анкет в хаус Sunset. " +
              "Давай начнем заполнение анкеты.\n\n" +
              "🍂 Укажи своё Имя + Ник:");
          }
        }
        
        // Другие команды можно добавить здесь
        
        // Обработка обычных текстовых сообщений от пользователей
        else if (userStates[chatId]) {
          // Переадресация в основной скрипт бота
          require('../bot').handleTextMessage(chatId, text, userId);
        }
      }
      
      // Обработка callback запросов (кнопки)
      else if (update.callback_query) {
        // Переадресация в основной скрипт бота
        require('../bot').handleCallbackQuery(update.callback_query);
      }
      
      return res.status(200).send('OK');
    } catch (error) {
      console.error('Ошибка в обработке webhook:', error);
      return res.status(500).json({ error: String(error) });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}; 