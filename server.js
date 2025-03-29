const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

// Создаем Express приложение
const app = express();
app.use(bodyParser.json());

// Получаем токен бота из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// Определяем режим для бота в зависимости от среды
const isDevelopment = process.env.NODE_ENV !== 'production';
let bot;

if (isDevelopment) {
  // В режиме разработки используем long polling
  bot = new TelegramBot(token, { polling: true });
  console.log('Запуск бота в режиме long polling...');
} else {
  // В production используем webhook
  bot = new TelegramBot(token);
  
  // URL для webhook должен быть установлен через переменную окружения
  const webhookUrl = process.env.WEBHOOK_URL;
  
  if (webhookUrl) {
    // Установка webhook при запуске
    bot.setWebHook(webhookUrl);
    console.log(`Webhook установлен на ${webhookUrl}`);
  }
}

// Импортируем логику бота
require('./bot')(bot);

// Конечная точка для вебхуков Telegram
app.post('/api/webhook', (req, res) => {
  if (req.body.message || req.body.callback_query) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

// Статус для проверки работоспособности
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Простая домашняя страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Определяем порт
const PORT = process.env.PORT || 3000;

// Запускаем сервер Express
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

module.exports = app; 