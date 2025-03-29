// Основной API файл для Vercel
const express = require('express');
const app = express();

// Используем JSON парсер
app.use(express.json());

// Корневой маршрут
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Бот хауса Sunset API работает!'
  });
});

// Webhook для Telegram
app.post('/webhook', (req, res) => {
  console.log('Webhook данные получены:', JSON.stringify(req.body));
  res.status(200).send('OK');
});

// Тестовый пинг
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Экспорт для Vercel
module.exports = app; 