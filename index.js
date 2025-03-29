// Главный файл для обработки всех запросов
const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

// Получаем токен бота из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// Создаем бота без polling, так как используем webhook
const bot = new TelegramBot(token);

// Инициализируем бота
const botInit = require('./bot');
botInit(bot);

// Создаем Express приложение
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка вебхука
app.post('/webhook', async (req, res) => {
  try {
    console.log('Received webhook data:', JSON.stringify(req.body));
    
    // Обрабатываем данные от Telegram
    await bot.processUpdate(req.body);
    console.log('Update processed successfully');
    
    // Отвечаем успешным статусом
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ 
      error: 'Failed to process update',
      message: error.message 
    });
  }
});

// Статус API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Sunset house Telegram bot API is running'
  });
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