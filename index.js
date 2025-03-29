// Главный файл для обработки всех запросов
const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const bodyParser = require('body-parser');

// Получаем токен бота из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// Создаем бота без polling, так как используем webhook
const bot = new TelegramBot(token, {
  webHook: {
    port: process.env.PORT || 3000
  }
});

// Устанавливаем вебхук прямо в коде, если мы не в режиме разработки
if (process.env.NODE_ENV === 'production') {
  const webhookUrl = 'https://sunset-coral.vercel.app/webhook';
  bot.setWebHook(webhookUrl)
    .then(() => console.log('Webhook set to:', webhookUrl))
    .catch(err => console.error('Failed to set webhook:', err));
}

// Прямая обработка сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  console.log('Received message:', msg.text, 'from chat:', chatId);
  
  // Тестовый ответ на любое сообщение
  bot.sendMessage(chatId, 'Я получил ваше сообщение и обрабатываю его...')
    .then(() => console.log('Test message sent to chat:', chatId))
    .catch(err => console.error('Error sending test message:', err));
});

// Инициализируем бота с основной логикой
const botInit = require('./bot');
botInit(bot);

// Создаем Express приложение
const app = express();

// Используем расширенный парсинг для обработки JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка вебхука - УВЕЛИЧИВАЕМ ЛОГИРОВАНИЕ
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received! Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', JSON.stringify(req.body));
    
    if (!req.body) {
      console.error('No request body!');
      return res.status(400).send('No request body');
    }
    
    // Обрабатываем данные от Telegram
    await bot.processUpdate(req.body);
    console.log('Update processed successfully');
    
    // Отвечаем успешным статусом
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to process update',
      message: error.message,
      stack: error.stack
    });
  }
});

// Добавляем простой пинг для проверки статуса
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Статус API с дополнительной информацией
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Sunset house Telegram bot API is running',
    bot_info: {
      token_prefix: token.split(':')[0],
      webhook_info: 'Use GET /api/webhook-info to see webhook status'
    }
  });
});

// Проверка информации о вебхуке
app.get('/api/webhook-info', async (req, res) => {
  try {
    const info = await bot.getWebHookInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обработка остальных запросов
app.use('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Порт для локальной разработки
const PORT = process.env.PORT || 3000;

// Экспортируем и запускаем приложение если не в режиме модуля
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app; 